import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth } from '../services/api';

export type UserRole = 'student' | 'instructor' | 'admin';

export interface User {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  avatar_url?: string;
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: any) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const res = await auth.me();
      setUser(res.data);
    } catch {
      localStorage.removeItem('vertexlearn_token');
      localStorage.removeItem('vertexlearn_refresh_token');
      setUser(null);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('vertexlearn_token');
    if (token) {
      refreshUser().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (credentials: any) => {
    const res = await auth.login(credentials);
    const { access_token, refresh_token, user: userData } = res.data;
    localStorage.setItem('vertexlearn_token', access_token);
    if (refresh_token) {
      localStorage.setItem('vertexlearn_refresh_token', refresh_token);
    }
    setUser(userData);
  };

  const register = async (data: any) => {
    const res = await auth.register(data);
    const { access_token, refresh_token, user: userData } = res.data;
    localStorage.setItem('vertexlearn_token', access_token);
    if (refresh_token) {
      localStorage.setItem('vertexlearn_refresh_token', refresh_token);
    }
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('vertexlearn_token');
    localStorage.removeItem('vertexlearn_refresh_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
