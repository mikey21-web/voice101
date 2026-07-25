import { useState } from 'react';
import { setToken, clearToken, getToken, api, setRefreshToken } from './api';
import { reset as posthogReset } from './posthog';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  tenantId: string | null;
  name?: string;
}

export function useAuth() {
  // Read any cached session synchronously on the initial render — if this
  // instead lived in a useEffect, the first render would see `user: null`
  // (isLoggedIn: false) before the effect had a chance to run, and any
  // code gating on isLoggedIn on that first render (e.g. redirecting to
  // the login page) would fire incorrectly even for an already-logged-in
  // user.
  const [user, setUser] = useState<AuthUser | null>(() => {
    const cached = sessionStorage.getItem('user');
    return cached ? JSON.parse(cached) : null;
  });
  const [loading, setLoading] = useState(false);

  async function login(email: string, password: string) {
    setLoading(true);
    try {
      const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      setToken(data.accessToken);
      if (data.refreshToken) setRefreshToken(data.refreshToken);
      const u = data.user;
      setUser(u);
      sessionStorage.setItem('user', JSON.stringify(u));
      return u;
    } finally {
      setLoading(false);
    }
  }

  async function fetchProfile() {
    if (!getToken()) return null;
    try {
      const u = await api('/auth/me');
      setUser(u);
      sessionStorage.setItem('user', JSON.stringify(u));
      return u;
    } catch (err: any) {
      // Only clear session on 401 (Unauthorized), not on transient 5xx
      if (err.message === 'Session expired') {
        clearToken();
        sessionStorage.removeItem('user');
        setUser(null);
      }
      return null;
    }
  }

  function logout() {
    posthogReset();
    api('/auth/logout', { method: 'POST' }).catch(() => {});
    clearToken();
    sessionStorage.removeItem('user');
    setUser(null);
  }

  return { user, login, logout, fetchProfile, loading, isLoggedIn: !!user };
}
