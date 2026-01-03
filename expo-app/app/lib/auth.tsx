import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as api from './api';
import { clearToken, getToken, setToken } from './authStorage';

export type AuthState = {
  loading: boolean;
  token: string | null;
  user: api.AppUser | null;
  isLoggedIn: boolean;
  hasProfileName: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  updateProfile: (patch: Partial<api.AppUser['profile']>) => Promise<void>;
  uploadPhoto: (uri: string) => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [token, setTok] = useState<string | null>(null);
  const [user, setUser] = useState<api.AppUser | null>(null);

  async function refreshMe() {
    if (!token) {
      setUser(null);
      return;
    }
    const me = await api.getMe();
    if (me?.user) setUser(me.user);
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const t = await getToken();
        if (!mounted) return;
        if (t) {
          setTok(t);
          api.setAuthToken(t);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    // hydrate /me after token loads
    if (!token) return;
    refreshMe().catch(() => {
      // if token is bad, clear it
      logout().catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function login(email: string, password: string) {
    const resp = await api.login(email, password);
    const t = resp?.token as string | undefined;
    if (!t) throw new Error(resp?.error || 'login failed');
    await setToken(t);
    api.setAuthToken(t);
    setTok(t);
    if (resp?.user) setUser(resp.user);
    else await refreshMe();
  }

  async function register(email: string, password: string) {
    const resp = await api.register(email, password);
    const t = resp?.token as string | undefined;
    if (!t) throw new Error(resp?.error || 'register failed');
    await setToken(t);
    api.setAuthToken(t);
    setTok(t);
    if (resp?.user) setUser(resp.user);
    else await refreshMe();
  }

  async function logout() {
    await clearToken();
    api.setAuthToken(null);
    setTok(null);
    setUser(null);
  }

  async function updateProfile(patch: Partial<api.AppUser['profile']>) {
    const resp = await api.updateProfile(patch);
    if (resp?.user) setUser(resp.user);
    else await refreshMe();
  }

  async function uploadPhoto(uri: string) {
    const resp = await api.uploadProfilePhoto(uri);
    if (resp?.user) setUser(resp.user);
    else await refreshMe();
  }

  const value = useMemo<AuthState>(
    () => ({
      loading,
      token,
      user,
      isLoggedIn: Boolean(token),
      hasProfileName: Boolean(user?.profile?.name && user.profile.name.trim().length >= 2),
      login,
      register,
      logout,
      refreshMe,
      updateProfile,
      uploadPhoto,
    }),
    [loading, token, user]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used within AuthProvider');
  return v;
}
