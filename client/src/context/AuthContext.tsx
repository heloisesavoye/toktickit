import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../api/client";

export type Role = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";

export type CurrentUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
  requiresPasswordChange: boolean;
};

type AuthContextValue = {
  status: "loading" | "anonymous" | "authenticated";
  user: CurrentUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  loginError: string | null;
};

// FR-01, FR-05, FR-06: authenticated session identity, replacing the Lab 2
// Development Requester context entirely.
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);

  async function refresh() {
    try {
      const res = await api.me();
      setUser(res.data);
      setStatus("authenticated");
    } catch {
      setUser(null);
      setStatus("anonymous");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function login(email: string, password: string) {
    setLoginError(null);
    try {
      const res = await api.login(email, password);
      setUser(res.data);
      setStatus("authenticated");
    } catch {
      // BR-06: one generic message, never revealing which part was wrong.
      setLoginError("Invalid email or password. Please try again.");
      throw new Error("login-failed");
    }
  }

  async function logout() {
    await api.logout().catch(() => {});
    setUser(null);
    setStatus("anonymous");
  }

  return (
    <AuthContext.Provider value={{ status, user, login, logout, refresh, loginError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
