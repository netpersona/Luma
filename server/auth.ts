import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from './db';
import { users, sessions, inviteTokens } from '@shared/schema';
import type { User, Session, InviteToken, InsertUser } from '@shared/schema';
import { eq, and, gt, lt } from 'drizzle-orm';

const SALT_ROUNDS = 12;
const SESSION_DURATION_DAYS = 30;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateInviteCode(): string {
  return crypto.randomBytes(8).toString('hex').toUpperCase();
}

export async function createSession(userId: string, userAgent?: string, ipAddress?: string): Promise<Session> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);
  
  const sessionId = generateSessionId();
  
  const [session] = await db.insert(sessions).values({
    id: sessionId,
    userId,
    expiresAt,
    userAgent,
    ipAddress,
  }).returning();
  
  return session;
}

export async function getSession(sessionId: string): Promise<Session | undefined> {
  const [session] = await db.select().from(sessions)
    .where(and(
      eq(sessions.id, sessionId),
      gt(sessions.expiresAt, new Date())
    ));
  return session;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function deleteAllUserSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function cleanupExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

export async function getUserById(id: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
  return user;
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.username, username.toLowerCase()));
  return user;
}

export async function getUserByGoogleId(googleId: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
  return user;
}

export async function createUser(userData: InsertUser & { password?: string }): Promise<User> {
  const { password, ...data } = userData;
  
  const insertData: InsertUser = {
    ...data,
    email: data.email.toLowerCase(),
    username: data.username.toLowerCase(),
    passwordHash: password ? await hashPassword(password) : null,
  };
  
  const [user] = await db.insert(users).values(insertData).returning();
  return user;
}

export async function updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
  const [user] = await db.update(users)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return user;
}

export async function linkGoogleAccount(userId: string, googleId: string): Promise<User | undefined> {
  return updateUser(userId, { googleId });
}

export async function unlinkGoogleAccount(userId: string): Promise<User | undefined> {
  const [user] = await db.update(users)
    .set({ googleId: null, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return user;
}

export async function updateLastLogin(userId: string): Promise<void> {
  await db.update(users)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function getAllUsers(): Promise<User[]> {
  return db.select().from(users);
}

export async function deleteUser(id: string): Promise<void> {
  // Delete user's sessions first
  await db.delete(sessions).where(eq(sessions.userId, id));
  // Delete the user
  await db.delete(users).where(eq(users.id, id));
}

export async function getUserCount(): Promise<number> {
  const result = await db.select().from(users);
  return result.length;
}

export async function isFirstUser(): Promise<boolean> {
  const count = await getUserCount();
  return count === 0;
}

export async function createInviteToken(createdBy: string, options: {
  maxUses?: number;
  expiresAt?: Date;
  note?: string;
} = {}): Promise<InviteToken> {
  const code = generateInviteCode();
  
  const [token] = await db.insert(inviteTokens).values({
    code,
    createdBy,
    maxUses: options.maxUses ?? 1,
    expiresAt: options.expiresAt ?? null,
    note: options.note ?? null,
  }).returning();
  
  return token;
}

export async function getInviteToken(code: string): Promise<InviteToken | undefined> {
  const [token] = await db.select().from(inviteTokens)
    .where(eq(inviteTokens.code, code.toUpperCase()));
  return token;
}

export async function validateInviteCode(code: string): Promise<{ valid: boolean; reason?: string; token?: InviteToken }> {
  const token = await getInviteToken(code);
  
  if (!token) {
    return { valid: false, reason: 'Invalid invite code' };
  }
  
  if (!token.isActive) {
    return { valid: false, reason: 'Invite code has been revoked' };
  }
  
  if (token.expiresAt && new Date(token.expiresAt) < new Date()) {
    return { valid: false, reason: 'Invite code has expired' };
  }
  
  if (token.maxUses && (token.usageCount ?? 0) >= token.maxUses) {
    return { valid: false, reason: 'Invite code has reached maximum uses' };
  }
  
  return { valid: true, token };
}

export async function incrementInviteUsage(code: string): Promise<void> {
  const token = await getInviteToken(code);
  if (token) {
    const currentCount = token.usageCount ?? 0;
    await db.update(inviteTokens)
      .set({ usageCount: currentCount + 1 })
      .where(eq(inviteTokens.code, code.toUpperCase()));
  }
}

export async function revokeInviteToken(id: string): Promise<void> {
  await db.update(inviteTokens)
    .set({ isActive: false })
    .where(eq(inviteTokens.id, id));
}

export async function getAllInviteTokens(): Promise<InviteToken[]> {
  return db.select().from(inviteTokens);
}

export async function getActiveInviteTokens(userId: string): Promise<InviteToken[]> {
  return db.select().from(inviteTokens)
    .where(and(
      eq(inviteTokens.createdBy, userId),
      eq(inviteTokens.isActive, true)
    ));
}

export function sanitizeUser(user: User): Omit<User, 'passwordHash'> {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

// Migrate 'default' user data to a real user (called during admin bootstrap)
export async function migrateDefaultUserData(newUserId: string): Promise<void> {
  const { sqlite } = await import('./db');
  
  // Tables with user_id column that can have legacy data
  const tablesToCheck = [
    'reader_preferences',
    'user_ratings',
    'recommendation_cache',
    'reading_goals',
    'reading_sessions',
    'book_club_members',
    'book_club_discussions',
  ];
  
  // First, check if there's any legacy data to migrate
  let hasLegacyData = false;
  
  for (const table of tablesToCheck) {
    try {
      const count = sqlite.prepare(`SELECT COUNT(*) as count FROM ${table} WHERE user_id = 'default'`).get() as { count: number };
      if (count && count.count > 0) {
        hasLegacyData = true;
        break;
      }
    } catch {
      // Table might not exist yet - that's fine
    }
  }
  
  // Also check book_clubs created_by field
  if (!hasLegacyData) {
    try {
      const count = sqlite.prepare(`SELECT COUNT(*) as count FROM book_clubs WHERE created_by = 'default'`).get() as { count: number };
      if (count && count.count > 0) {
        hasLegacyData = true;
      }
    } catch {
      // Table might not exist yet - that's fine
    }
  }
  
  // Short-circuit if no legacy data exists
  if (!hasLegacyData) {
    console.log('No legacy default user data found, skipping migration');
    return;
  }
  
  // Wrap all updates in a transaction for atomicity
  const migration = sqlite.transaction(() => {
    let totalMigrated = 0;
    
    for (const table of tablesToCheck) {
      try {
        const stmt = sqlite.prepare(`UPDATE ${table} SET user_id = ? WHERE user_id = 'default'`);
        const result = stmt.run(newUserId);
        if (result.changes > 0) {
          console.log(`Migrated ${result.changes} rows in ${table}`);
          totalMigrated += result.changes;
        }
      } catch (error) {
        console.log(`Note: Could not migrate ${table}:`, error instanceof Error ? error.message : 'unknown error');
      }
    }
    
    // Handle book_clubs which uses created_by instead of user_id
    try {
      const stmt = sqlite.prepare(`UPDATE book_clubs SET created_by = ? WHERE created_by = 'default'`);
      const result = stmt.run(newUserId);
      if (result.changes > 0) {
        console.log(`Migrated ${result.changes} rows in book_clubs`);
        totalMigrated += result.changes;
      }
    } catch (error) {
      console.log('Note: Could not migrate book_clubs:', error instanceof Error ? error.message : 'unknown error');
    }
    
    return totalMigrated;
  });
  
  try {
    const totalMigrated = migration();
    console.log(`Migration complete: Transferred ${totalMigrated} records from 'default' user to admin ${newUserId}`);
  } catch (error) {
    console.error('Migration failed:', error instanceof Error ? error.message : 'unknown error');
    throw error;
  }
}
