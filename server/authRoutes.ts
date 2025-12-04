import type { Express, Request, Response, NextFunction } from "express";
import {
  hashPassword,
  verifyPassword,
  createSession,
  getSession,
  deleteSession,
  getUserById,
  getUserByEmail,
  getUserByUsername,
  getUserByGoogleId,
  createUser,
  updateUser,
  deleteUser,
  linkGoogleAccount,
  unlinkGoogleAccount,
  updateLastLogin,
  getAllUsers,
  isFirstUser,
  createInviteToken,
  validateInviteCode,
  incrementInviteUsage,
  revokeInviteToken,
  getAllInviteTokens,
  getActiveInviteTokens,
  sanitizeUser,
  migrateDefaultUserData,
} from "./auth";
import { loadSecrets, saveSecrets } from "./config";
import type { User } from "@shared/schema";

const SESSION_COOKIE_NAME = "session_id";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      session?: { id: string; userId: string };
    }
  }
}

export function getSessionCookie(req: Request): string | undefined {
  return req.cookies?.[SESSION_COOKIE_NAME];
}

export function setSessionCookie(res: Response, sessionId: string): void {
  res.cookie(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: "/",
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const sessionId = getSessionCookie(req);
  
  if (!sessionId) {
    next();
    return;
  }
  
  const session = await getSession(sessionId);
  if (!session) {
    clearSessionCookie(res);
    next();
    return;
  }
  
  const user = await getUserById(session.userId);
  if (!user || user.status !== "active") {
    clearSessionCookie(res);
    next();
    return;
  }
  
  req.user = user;
  req.session = { id: session.id, userId: session.userId };
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (req.user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

export function registerAuthRoutes(app: Express): void {
  // Check auth status and setup state
  app.get("/api/auth/status", async (req, res) => {
    const firstUser = await isFirstUser();
    const secrets = loadSecrets();
    const googleOAuthConfigured = !!(secrets.googleClientId && secrets.googleClientSecret);
    
    if (req.user) {
      res.json({
        authenticated: true,
        user: sanitizeUser(req.user),
        needsSetup: false,
        googleOAuthConfigured,
      });
    } else {
      res.json({
        authenticated: false,
        user: null,
        needsSetup: firstUser,
        googleOAuthConfigured,
      });
    }
  });

  // Bootstrap: Create first admin user (only works if no users exist)
  app.post("/api/auth/setup", async (req, res) => {
    try {
      const firstUser = await isFirstUser();
      if (!firstUser) {
        return res.status(400).json({ error: "Setup already complete" });
      }

      const { email, username, password, displayName } = req.body;

      if (!email || !username || !password) {
        return res.status(400).json({ error: "Email, username, and password are required" });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }

      const user = await createUser({
        email,
        username,
        role: "admin",
        status: "active",
        displayName: displayName || username,
        password,
      });

      // Migrate any existing 'default' user data to the new admin
      await migrateDefaultUserData(user.id);

      const session = await createSession(
        user.id,
        req.headers["user-agent"],
        req.ip
      );

      await updateLastLogin(user.id);
      setSessionCookie(res, session.id);

      res.status(201).json({
        message: "Admin account created successfully",
        user: sanitizeUser(user),
      });
    } catch (error: any) {
      console.error("Setup error:", error);
      if (error.message?.includes("UNIQUE constraint failed")) {
        return res.status(400).json({ error: "Email or username already exists" });
      }
      res.status(500).json({ error: "Failed to create admin account" });
    }
  });

  // Register new user with invite code
  app.post("/api/auth/register", async (req, res) => {
    try {
      const firstUser = await isFirstUser();
      if (firstUser) {
        return res.status(400).json({ error: "Please complete initial setup first" });
      }

      const { email, username, password, displayName, inviteCode } = req.body;

      if (!email || !username || !password) {
        return res.status(400).json({ error: "Email, username, and password are required" });
      }

      if (!inviteCode) {
        return res.status(400).json({ error: "Invite code is required" });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }

      // Validate invite code
      const inviteValidation = await validateInviteCode(inviteCode);
      if (!inviteValidation.valid) {
        return res.status(400).json({ error: inviteValidation.reason });
      }

      // Check for existing user
      const existingEmail = await getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ error: "Email already registered" });
      }

      const existingUsername = await getUserByUsername(username);
      if (existingUsername) {
        return res.status(400).json({ error: "Username already taken" });
      }

      // Create user
      const user = await createUser({
        email,
        username,
        role: "user",
        status: "active",
        displayName: displayName || username,
        invitedBy: inviteValidation.token!.createdBy,
        inviteCodeUsed: inviteCode.toUpperCase(),
        password,
      });

      // Increment invite usage
      await incrementInviteUsage(inviteCode);

      const session = await createSession(
        user.id,
        req.headers["user-agent"],
        req.ip
      );

      await updateLastLogin(user.id);
      setSessionCookie(res, session.id);

      res.status(201).json({
        message: "Account created successfully",
        user: sanitizeUser(user),
      });
    } catch (error: any) {
      console.error("Registration error:", error);
      if (error.message?.includes("UNIQUE constraint failed")) {
        return res.status(400).json({ error: "Email or username already exists" });
      }
      res.status(500).json({ error: "Failed to create account" });
    }
  });

  // Login with password
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { emailOrUsername, password } = req.body;

      if (!emailOrUsername || !password) {
        return res.status(400).json({ error: "Email/username and password are required" });
      }

      // Find user by email or username
      let user = await getUserByEmail(emailOrUsername);
      if (!user) {
        user = await getUserByUsername(emailOrUsername);
      }

      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      if (user.status !== "active") {
        return res.status(401).json({ error: "Account is not active" });
      }

      if (!user.passwordHash) {
        return res.status(401).json({ error: "Please login with Google" });
      }

      const validPassword = await verifyPassword(password, user.passwordHash);
      if (!validPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const session = await createSession(
        user.id,
        req.headers["user-agent"],
        req.ip
      );

      await updateLastLogin(user.id);
      setSessionCookie(res, session.id);

      res.json({
        message: "Login successful",
        user: sanitizeUser(user),
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Logout
  app.post("/api/auth/logout", async (req, res) => {
    const sessionId = getSessionCookie(req);
    if (sessionId) {
      await deleteSession(sessionId);
    }
    clearSessionCookie(res);
    res.json({ message: "Logged out successfully" });
  });

  // Get current user
  app.get("/api/auth/me", requireAuth, (req, res) => {
    res.json({ user: sanitizeUser(req.user!) });
  });

  // Update password
  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: "New password must be at least 8 characters" });
      }

      const user = req.user!;

      // If user has a password, verify current password
      if (user.passwordHash) {
        if (!currentPassword) {
          return res.status(400).json({ error: "Current password is required" });
        }
        const valid = await verifyPassword(currentPassword, user.passwordHash);
        if (!valid) {
          return res.status(401).json({ error: "Current password is incorrect" });
        }
      }

      const hashedPassword = await hashPassword(newPassword);
      await updateUser(user.id, { passwordHash: hashedPassword });

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Password change error:", error);
      res.status(500).json({ error: "Failed to update password" });
    }
  });

  // ==================== GOOGLE OAUTH ====================

  // Initiate Google OAuth - redirects directly to Google
  app.get("/api/auth/google", async (req, res) => {
    try {
      const secrets = loadSecrets();
      if (!secrets.googleClientId || !secrets.googleClientSecret) {
        // OAuth not configured - redirect back to login with error
        return res.redirect("/login?error=oauth_not_configured");
      }

      const redirectUri = `${req.protocol}://${req.get("host")}/api/auth/google/callback`;
      const state = Buffer.from(JSON.stringify({
        action: req.query.action || "login", // 'login' or 'link'
        returnTo: req.query.returnTo || "/",
      })).toString("base64");

      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", secrets.googleClientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", "openid email profile");
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("access_type", "online");
      authUrl.searchParams.set("prompt", "select_account");

      res.redirect(authUrl.toString());
    } catch (error) {
      console.error("Google auth error:", error);
      res.redirect("/login?error=oauth_failed");
    }
  });

  // Google OAuth callback
  app.get("/api/auth/google/callback", async (req, res) => {
    try {
      const { code, state } = req.query;

      if (!code || typeof code !== "string") {
        return res.redirect("/?error=no_code");
      }

      let stateData = { action: "login", returnTo: "/" };
      if (state && typeof state === "string") {
        try {
          stateData = JSON.parse(Buffer.from(state, "base64").toString());
        } catch {}
      }

      const secrets = loadSecrets();
      if (!secrets.googleClientId || !secrets.googleClientSecret) {
        return res.redirect("/login?error=oauth_not_configured");
      }

      const redirectUri = `${req.protocol}://${req.get("host")}/api/auth/google/callback`;

      // Exchange code for tokens
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: secrets.googleClientId,
          client_secret: secrets.googleClientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenResponse.ok) {
        console.error("Token exchange failed:", await tokenResponse.text());
        return res.redirect("/?error=token_exchange_failed");
      }

      const tokens = await tokenResponse.json();

      // Get user info from Google
      const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (!userInfoResponse.ok) {
        return res.redirect("/?error=failed_to_get_user_info");
      }

      const googleUser = await userInfoResponse.json();
      const { id: googleId, email, name, picture } = googleUser;

      if (stateData.action === "link" && req.user) {
        // Link Google account to existing user
        const existingWithGoogle = await getUserByGoogleId(googleId);
        if (existingWithGoogle && existingWithGoogle.id !== req.user.id) {
          return res.redirect("/settings?error=google_already_linked");
        }

        await linkGoogleAccount(req.user.id, googleId);
        if (picture) {
          await updateUser(req.user.id, { avatarUrl: picture });
        }
        return res.redirect("/settings?success=google_linked");
      }

      // Login with Google - only allow if user has already linked their Google account
      let user = await getUserByGoogleId(googleId);

      if (!user) {
        // Check if this is first user - allow admin setup via Google
        const firstUser = await isFirstUser();
        if (firstUser) {
          // Create first admin user via Google
          user = await createUser({
            email,
            username: email.split("@")[0] + "_" + Math.random().toString(36).substr(2, 4),
            googleId,
            role: "admin",
            status: "active",
            displayName: name || email.split("@")[0],
            avatarUrl: picture,
          });
        } else {
          // User must first create an account and link their Google account explicitly
          // Check if there's an existing account with this email that hasn't linked Google yet
          const existingByEmail = await getUserByEmail(email);
          if (existingByEmail) {
            // Account exists but Google is not linked - redirect to login with message
            return res.redirect("/login?error=google_not_linked");
          }
          // No account exists - they need to create one first
          return res.redirect("/login?error=account_required");
        }
      }

      if (user.status !== "active") {
        return res.redirect("/login?error=account_inactive");
      }

      const session = await createSession(
        user.id,
        req.headers["user-agent"],
        req.ip
      );

      await updateLastLogin(user.id);
      setSessionCookie(res, session.id);

      res.redirect(stateData.returnTo || "/");
    } catch (error) {
      console.error("Google callback error:", error);
      res.redirect("/?error=oauth_failed");
    }
  });

  // Unlink Google account
  app.post("/api/auth/google/unlink", requireAuth, async (req, res) => {
    try {
      const user = req.user!;

      if (!user.googleId) {
        return res.status(400).json({ error: "No Google account linked" });
      }

      if (!user.passwordHash) {
        return res.status(400).json({ error: "Set a password before unlinking Google" });
      }

      await unlinkGoogleAccount(user.id);
      res.json({ message: "Google account unlinked" });
    } catch (error) {
      console.error("Google unlink error:", error);
      res.status(500).json({ error: "Failed to unlink Google account" });
    }
  });

  // ==================== PROFILE MANAGEMENT ====================

  // Change password
  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current password and new password are required" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ error: "New password must be at least 8 characters" });
      }

      const user = await getUserById(req.user!.id);
      if (!user || !user.passwordHash) {
        return res.status(400).json({ error: "Cannot change password for this account type" });
      }

      const isValid = await verifyPassword(currentPassword, user.passwordHash);
      if (!isValid) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }

      const newPasswordHash = await hashPassword(newPassword);
      await updateUser(req.user!.id, { passwordHash: newPasswordHash });

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Password change error:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // Update profile
  app.patch("/api/auth/profile", requireAuth, async (req, res) => {
    try {
      const { displayName, email } = req.body;
      const updates: any = {};

      if (displayName !== undefined) {
        updates.displayName = displayName || null;
      }

      if (email !== undefined) {
        if (email && email !== req.user!.email) {
          const existingUser = await getUserByEmail(email);
          if (existingUser) {
            return res.status(400).json({ error: "Email is already in use" });
          }
          updates.email = email;
        }
      }

      const user = await updateUser(req.user!.id, updates);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({ message: "Profile updated", user: sanitizeUser(user) });
    } catch (error) {
      console.error("Profile update error:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // ==================== INVITE CODES (Admin only) ====================

  // Get all invite codes
  app.get("/api/auth/invites", requireAdmin, async (req, res) => {
    try {
      const invites = await getAllInviteTokens();
      res.json(invites);
    } catch (error) {
      console.error("Error fetching invites:", error);
      res.status(500).json({ error: "Failed to fetch invite codes" });
    }
  });

  // Create invite code
  app.post("/api/auth/invites", requireAdmin, async (req, res) => {
    try {
      const { maxUses, expiresInDays, note } = req.body;

      let expiresAt: Date | undefined;
      if (expiresInDays && typeof expiresInDays === "number") {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);
      }

      const token = await createInviteToken(req.user!.id, {
        maxUses: maxUses ?? 1,
        expiresAt,
        note,
      });

      res.status(201).json(token);
    } catch (error) {
      console.error("Error creating invite:", error);
      res.status(500).json({ error: "Failed to create invite code" });
    }
  });

  // Revoke invite code
  app.delete("/api/auth/invites/:id", requireAdmin, async (req, res) => {
    try {
      await revokeInviteToken(req.params.id);
      res.json({ message: "Invite code revoked" });
    } catch (error) {
      console.error("Error revoking invite:", error);
      res.status(500).json({ error: "Failed to revoke invite code" });
    }
  });

  // ==================== USER MANAGEMENT (Admin only) ====================

  // Get all users
  app.get("/api/auth/users", requireAdmin, async (req, res) => {
    try {
      const users = await getAllUsers();
      res.json(users.map(sanitizeUser));
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Update user (admin)
  app.patch("/api/auth/users/:id", requireAdmin, async (req, res) => {
    try {
      const { role, status } = req.body;
      const userId = req.params.id;

      // Prevent admin from demoting themselves
      if (userId === req.user!.id && role && role !== "admin") {
        return res.status(400).json({ error: "Cannot demote your own admin account" });
      }

      const updates: any = {};
      if (role) updates.role = role;
      if (status) updates.status = status;

      const user = await updateUser(userId, updates);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(sanitizeUser(user));
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Delete user (admin)
  app.delete("/api/auth/users/:id", requireAdmin, async (req, res) => {
    try {
      const userId = req.params.id;

      // Prevent admin from deleting themselves
      if (userId === req.user!.id) {
        return res.status(400).json({ error: "Cannot delete your own account" });
      }

      const userToDelete = await getUserById(userId);
      if (!userToDelete) {
        return res.status(404).json({ error: "User not found" });
      }

      await deleteUser(userId);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // ==================== OAUTH CONFIG (Admin only) ====================

  // Get OAuth config status
  app.get("/api/auth/oauth-config", requireAdmin, async (req, res) => {
    try {
      const secrets = loadSecrets();
      res.json({
        googleConfigured: !!(secrets.googleClientId && secrets.googleClientSecret),
        googleClientId: secrets.googleClientId ? "***configured***" : null,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get OAuth config" });
    }
  });

  // Update OAuth config
  app.post("/api/auth/oauth-config", requireAdmin, async (req, res) => {
    try {
      const { googleClientId, googleClientSecret } = req.body;
      const secrets = loadSecrets();

      if (googleClientId !== undefined) {
        secrets.googleClientId = googleClientId || undefined;
      }
      if (googleClientSecret !== undefined) {
        secrets.googleClientSecret = googleClientSecret || undefined;
      }

      saveSecrets(secrets);
      res.json({ message: "OAuth configuration updated" });
    } catch (error) {
      console.error("Error updating OAuth config:", error);
      res.status(500).json({ error: "Failed to update OAuth configuration" });
    }
  });
}
