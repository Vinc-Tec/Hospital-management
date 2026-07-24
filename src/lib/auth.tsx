import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, type Profile, type Tenant, type Membership } from './supabase';

type AuthState = {
  session: Session | null; user: User | null; profile: Profile | null;
  memberships: Membership[]; activeTenant: Tenant | null; loading: boolean;
  signIn: (email: string, password: string, remember?: boolean) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null; needsVerification?: boolean; emailExists?: boolean }>;
  signOut: () => Promise<void>; refresh: () => Promise<void>; setActiveTenantId: (id: string | null) => void;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  resendVerification: (email: string) => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfileAndTenants = async (currentUser: User) => {
    const { data: prof } = await supabase.from('profiles').select('id, full_name, is_super_admin').eq('id', currentUser.id).maybeSingle();
    setProfile(prof as Profile | null);
    const { data: mems } = await supabase.from('tenant_memberships').select('id, tenant_id, user_id, role, permissions').eq('user_id', currentUser.id);
    setMemberships((mems as Membership[]) ?? []);
    const storedId = localStorage.getItem('hc_active_tenant_id');
    const tenantIds = (mems as Membership[])?.map((m) => m.tenant_id) ?? [];
    const { data: owned } = await supabase.from('tenants').select('*').eq('owner_user_id', currentUser.id);
    const ownedTenants = (owned as Tenant[]) ?? [];
    const allTenantIds = Array.from(new Set([...tenantIds, ...ownedTenants.map((t) => t.id)]));
    const targetId = storedId && allTenantIds.includes(storedId) ? storedId : allTenantIds[0] ?? null;
    if (targetId) {
      const { data: t } = await supabase.from('tenants').select('*').eq('id', targetId).maybeSingle();
      setActiveTenant(t as Tenant | null);
    } else { setActiveTenant(null); }
  };

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session); setUser(data.session?.user ?? null);
      if (data.session?.user) { loadProfileAndTenants(data.session.user).finally(() => mounted && setLoading(false)); }
      else { setLoading(false); }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      (async () => {
        setSession(sess); setUser(sess?.user ?? null);
        if (sess?.user) { await loadProfileAndTenants(sess.user); }
        else { setProfile(null); setMemberships([]); setActiveTenant(null); localStorage.removeItem('hc_active_tenant_id'); }
      })();
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    // Check if email already exists
    const { data: existing } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    }).catch(() => ({ data: null, error: null as any }));

    // Try to sign up — if user exists, Supabase returns the user without creating a duplicate
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/signin`,
      },
    });

    if (error) {
      // User already registered
      if (error.message.toLowerCase().includes('already') || error.message.toLowerCase().includes('registered')) {
        return { error: null, emailExists: true };
      }
      return { error: error.message };
    }

    // If user already exists (Supabase returns a fake user object without session)
    if (data.user && !data.session && data.user.id) {
      return { error: null, emailExists: true };
    }

    return { error: null, needsVerification: true };
  };

  const signIn = async (email: string, password: string, remember?: boolean) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: remember ? { } : { },
    });
    return { error: error ? error.message : null };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error ? error.message : null };
  };

  const resendVerification = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/signin` },
    });
    return { error: error ? error.message : null };
  };

  const signOut = async () => { await supabase.auth.signOut(); localStorage.removeItem('hc_active_tenant_id'); setProfile(null); setMemberships([]); setActiveTenant(null); };
  const refresh = async () => { if (user) await loadProfileAndTenants(user); };
  const setActiveTenantId = (id: string | null) => { if (id) localStorage.setItem('hc_active_tenant_id', id); else localStorage.removeItem('hc_active_tenant_id'); };

  const value = useMemo<AuthState>(() => ({ session, user, profile, memberships, activeTenant, loading, signIn, signUp, signOut, refresh, setActiveTenantId, resetPassword, resendVerification }), [session, user, profile, memberships, activeTenant, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
