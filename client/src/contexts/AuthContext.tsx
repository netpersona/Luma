import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface User {
  id: string;
  email: string;
  username: string;
  googleId: string | null;
  role: "admin" | "user";
  status: "active" | "suspended";
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

interface AuthStatus {
  authenticated: boolean;
  user: User | null;
  needsSetup: boolean;
  googleOAuthConfigured: boolean;
}

interface LoginData {
  emailOrUsername: string;
  password: string;
}

interface RegisterData {
  email: string;
  username: string;
  password: string;
  displayName?: string;
  inviteCode: string;
}

interface SetupData {
  email: string;
  username: string;
  password: string;
  displayName?: string;
}

interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

interface UpdateProfileData {
  displayName?: string;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  needsSetup: boolean;
  googleOAuthConfigured: boolean;
  isLoading: boolean;
  login: (data: LoginData) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  setup: (data: SetupData) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (data: ChangePasswordData) => Promise<void>;
  updateProfile: (data: UpdateProfileData) => Promise<void>;
  unlinkGoogle: () => Promise<void>;
  refetch: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: authStatus, isLoading, refetch } = useQuery<AuthStatus>({
    queryKey: ["/api/auth/status"],
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginData) => {
      const res = await apiRequest("POST", "/api/auth/login", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/status"] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      const res = await apiRequest("POST", "/api/auth/register", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/status"] });
    },
  });

  const setupMutation = useMutation({
    mutationFn: async (data: SetupData) => {
      const res = await apiRequest("POST", "/api/auth/setup", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/status"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/logout", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/status"] });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: ChangePasswordData) => {
      const res = await apiRequest("POST", "/api/auth/change-password", data);
      return res.json();
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: UpdateProfileData) => {
      const res = await apiRequest("PATCH", "/api/auth/profile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/status"] });
    },
  });

  const unlinkGoogleMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/google/unlink", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/status"] });
    },
  });

  const login = async (data: LoginData) => {
    await loginMutation.mutateAsync(data);
  };

  const register = async (data: RegisterData) => {
    await registerMutation.mutateAsync(data);
  };

  const setup = async (data: SetupData) => {
    await setupMutation.mutateAsync(data);
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  const changePassword = async (data: ChangePasswordData) => {
    await changePasswordMutation.mutateAsync(data);
  };

  const updateProfile = async (data: UpdateProfileData) => {
    await updateProfileMutation.mutateAsync(data);
  };

  const unlinkGoogle = async () => {
    await unlinkGoogleMutation.mutateAsync();
  };

  return (
    <AuthContext.Provider
      value={{
        user: authStatus?.user ?? null,
        isAuthenticated: authStatus?.authenticated ?? false,
        needsSetup: authStatus?.needsSetup ?? false,
        googleOAuthConfigured: authStatus?.googleOAuthConfigured ?? false,
        isLoading,
        login,
        register,
        setup,
        logout,
        changePassword,
        updateProfile,
        unlinkGoogle,
        refetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
