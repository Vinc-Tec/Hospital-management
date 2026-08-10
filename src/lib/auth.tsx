import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, type Profile, type Tenant, type Membership, type SubscriptionPlan } from './supabase';

// Protected super-admin emails are no longer hardcoded in the bundle.
// They live in the `protected_admin_emails` table (admin-managed) and are
// fetched once per session for the cosmetic gate below. The REAL authority
// is `profiles.is_super_admin`, enforced server-side by handle_new_user()
// and the RLS policies -- this client check only hides UI meant for
// platform operators and must never be a security boundary.
let protectedAdminEmails: Set<string> = new Set();

export async function loadProtectedAdminEmails(): Promise<void> {
  const { data } = await supabase.from('protected_admin_emails').select('email');
  protectedAdminEmails = new Set((data ?? []).map((r: { email: string }) => r.email.toLowerCase()));
}

export function isProtectedSuperAdminEmail(email: string | null | undefined): boolean {
  return !!email && protectedAdminEmails.has(email.toLowerCase());
}

// Modules that every plan (including no plan / trial) can always access.
// Everything else must be explicitly enabled in the plan's module_flags.
const ALWAYS_ALLOWED_MODULES = new Set(['overview', 'settings']);

export function hasModuleAccess(plan: { module_flags?: Record<string, boolean> } | null, moduleKey: string): boolean {
  if (ALWAYS_ALLOWED_MODULES.has(moduleKey)) return true;
  if (!plan?.module_flags) return false;
  return plan.module_flags[moduleKey] === true;
}

// A membership with empty permissions ({}) is unrestricted -- this is the
// default for every membership today (including the tenant's own owner),
// so an empty object must mean "full access", not "no access", or every
// existing account would suddenly lose access to everything. Only once a
// tenant admin explicitly assigns a named role (copying that role's
// permissions onto the membership, see the Team management screen) does
// this actually restrict anything.
export function hasRoleAccess(permissions: Record<string, unknown> | null | undefined, moduleKey: string): boolean {
  if (ALWAYS_ALLOWED_MODULES.has(moduleKey)) return true;
  if (!permissions || Object.keys(permissions).length === 0) return true;
  return permissions[`${moduleKey}.view`] === true;
}

type AuthState = {
  session: Session | null; user: User | null; profile: Profile | null;
  memberships: Membership[]; activeTenant: Tenant | null; activeMembership: Membership | null; activePlan: SubscriptionPlan | null; loading: boolean;
  signIn: (email: string, password: string, remember?: boolean) => Promise<{ error: string | null; mfaRequired?: boolean; mfaFactorId?: string }>;
  verifyMfaChallenge: (factorId: string, code: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null; needsVerification?: boolean; emailExists?: boolean }>;
  signOut: () => Promise<void>; refresh: () => Promise<void>; setActiveTenantId: (id: string | null) => void;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  resendVerification: (email: string) => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

function parseUserAgent(ua: string): { device: string; browser: string } {
  let browser = 'Unknown';
  if (/Edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua)) browser = 'Safari';
  else if (/OPR\//i.test(ua)) browser = 'Opera';

  let device = 'Desktop';
  if (/iPhone|iPad|iPod/i.test(ua)) device = 'iOS';
  else if (/Android/i.test(ua)) device = 'Android';
  else if (/Mobile|Windows Phone/i.test(ua)) device = 'Mobile';

  return { device, browser };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);
  const [activePlan, setActivePlan] = useState<SubscriptionPlan | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfileAndTenants = async (currentUser: User) => {
    // Ensure the cosmetic super-admin email gate reflects the DB-managed
    // list (kept out of the static bundle). Best-effort: a failure here
    // just leaves the gate conservative (no extra UI shown).
    loadProtectedAdminEmails().catch(() => {});

    const { data: prof } = await supabase.from('profiles')
      .select('id, full_name, is_super_admin, email')
      .eq('id', currentUser.id).maybeSingle();
    setProfile(prof as Profile | null);

    const { data: mems } = await supabase.from('tenant_memberships')
      .select('id, tenant_id, user_id, role, permissions').eq('user_id', currentUser.id);
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

  useEffect(() => {
    let mounted = true;
    if (!activeTenant?.plan_id) { setActivePlan(null); return; }
    supabase.from('subscription_plans').select('*').eq('id', activeTenant.plan_id).maybeSingle()
      .then(({ data }) => { if (mounted) setActivePlan((data as SubscriptionPlan) ?? null); });
    return () => { mounted = false; };
  }, [activeTenant?.plan_id]);

  const recordLoginActivity = async (userId: string, success: boolean, tenantId?: string | null, failureReason?: string) => {
    const ua = navigator.userAgent;
    const { device, browser } = parseUserAgent(ua);
    try {
      await supabase.from('login_activity').insert({
        user_id: userId,
        tenant_id: tenantId ?? null,
        login_at: new Date().toISOString(),
        device,
        browser,
        user_agent: ua,
        success,
        failure_reason: failureReason ?? null,
      });
    } catch {
      // Non-critical; don't block login on tracking failure
    }
  };

  const recordLogout = async (userId: string, loginAt: Date) => {
    const now = new Date();
    const durationSec = Math.round((now.getTime() - loginAt.getTime()) / 1000);
    try {
      await supabase.from('login_activity')
        .update({ logout_at: now.toISOString(), session_duration_sec: durationSec })
        .eq('user_id', userId)
        .is('logout_at', null)
        .order('login_at', { ascending: false })
        .limit(1);
    } catch {
      // Non-critical
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    // Protected super admins should never sign up through the normal flow
    // — but if they do, they'll be auto-marked by the DB trigger.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/signin`,
      },
    });

    if (error) {
      if (error.message.toLowerCase().includes('already') || error.message.toLowerCase().includes('registered')) {
        return { error: null, emailExists: true };
      }
      return { error: error.message };
    }

    if (data.user && !data.session && data.user.id) {
      return { error: null, emailExists: true };
    }

    return { error: null, needsVerification: true };
  };

  const signIn = async (email: string, password: string, _remember?: boolean) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // Record failed login — but we don't have a user_id for failed attempts,
      // so we skip recording here. Only successful logins are tracked.
      return { error: error.message };
    }

    // Check if this account has MFA enrolled and still needs to complete the
    // second factor before the session is fully authenticated (AAL2).
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== aal.nextLevel) {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const factorId = factors?.totp?.[0]?.id;
      return { error: null, mfaRequired: true, mfaFactorId: factorId };
    }

    // Record successful login
    if (data.user) {
      // Load profile to get tenant info
      const { data: prof } = await supabase.from('profiles')
        .select('id, is_super_admin').eq('id', data.user.id).maybeSingle();
      let tenantId: string | null = null;
      if (!prof?.is_super_admin) {
        const { data: mem } = await supabase.from('tenant_memberships')
          .select('tenant_id').eq('user_id', data.user.id).limit(1).maybeSingle();
        tenantId = mem?.tenant_id ?? null;
      }
      await recordLoginActivity(data.user.id, true, tenantId);
    }

    return { error: null };
  };

  const verifyMfaChallenge = async (factorId: string, code: string) => {
    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeErr) return { error: challengeErr.message };
    const { data, error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
    if (error) return { error: error.message };

    if (data.user) {
      const { data: prof } = await supabase.from('profiles')
        .select('id, is_super_admin').eq('id', data.user.id).maybeSingle();
      let tenantId: string | null = null;
      if (!prof?.is_super_admin) {
        const { data: mem } = await supabase.from('tenant_memberships')
          .select('tenant_id').eq('user_id', data.user.id).limit(1).maybeSingle();
        tenantId = mem?.tenant_id ?? null;
      }
      await recordLoginActivity(data.user.id, true, tenantId);
    }
    return { error: null };
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

  const signOut = async () => {
    if (user) {
      // Find the most recent login to record logout
      const { data: lastLogin } = await supabase.from('login_activity')
        .select('login_at').eq('user_id', user.id).is('logout_at', null)
        .order('login_at', { ascending: false }).limit(1).maybeSingle();
      if (lastLogin) {
        await recordLogout(user.id, new Date(lastLogin.login_at));
      }
    }
    await supabase.auth.signOut();
    localStorage.removeItem('hc_active_tenant_id');
    setProfile(null); setMemberships([]); setActiveTenant(null); setActivePlan(null);
  };

  const refresh = async () => { if (user) await loadProfileAndTenants(user); };
  const setActiveTenantId = (id: string | null) => { if (id) localStorage.setItem('hc_active_tenant_id', id); else localStorage.removeItem('hc_active_tenant_id'); };

  const activeMembership = useMemo(() => memberships.find((m) => m.tenant_id === activeTenant?.id) ?? null, [memberships, activeTenant]);

  const value = useMemo<AuthState>(() => ({ session, user, profile, memberships, activeTenant, activeMembership, activePlan, loading, signIn, verifyMfaChallenge, signUp, signOut, refresh, setActiveTenantId, resetPassword, resendVerification }), [session, user, profile, memberships, activeTenant, activeMembership, activePlan, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
