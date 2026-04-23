"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import api from "@/lib/api";
import { clearToken, setToken } from "@/lib/auth";
import type { LoginCredentials, TokenWithUser, User } from "@/types/auth";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Persiste role em cookie para leitura pelo middleware.ts (server-side). */
function setRoleCookie(role: string) {
  document.cookie = `rotavenda_role=${role}; path=/; SameSite=Lax`;
}

function clearRoleCookie() {
  document.cookie = `rotavenda_role=; path=/; max-age=0`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Ao montar, tenta restaurar sessão usando o cookie de refresh token
  useEffect(() => {
    async function restoreSession() {
      try {
        const { data } = await api.post<TokenWithUser>("/auth/refresh");
        setToken(data.access_token);
        setUser(data.user);
        setRoleCookie(data.user.role);
      } catch {
        // Sem sessão válida — usuário precisa fazer login
      } finally {
        setIsLoading(false);
      }
    }
    restoreSession();
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const { data } = await api.post<TokenWithUser>("/auth/login", credentials);
    setToken(data.access_token);
    setUser(data.user);
    setRoleCookie(data.user.role);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      clearToken();
      clearRoleCookie();
      setUser(null);
      window.location.href = "/login";
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return context;
}
