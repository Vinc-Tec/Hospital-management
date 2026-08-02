import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth, hasModuleAccess } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { supabase, type Tenant, type SubscriptionPlan, type Branch } from '../lib/supabase';
import { Button, Card, Input, Badge, Select, Modal } from '../components/ui';
import { Settings as SettingsIcon, Building2, User, CreditCard, AlertTriangle, Check, Plus, Pencil, Trash2, X, HeadphonesIcon, ShieldCheck, Key, Users } from 'lucide-react';
import { sha256Hex, generateApiKey } from '../lib/apiKeys';

export function SettingsPage() {
  const { t } = useI18n();
  const { activeTenant, activePlan, user, profile, refresh } = useAuth();
  const [tab, setTab] = useState<'general' | 'profile' | 'billing' | 'branches' | 'support' | 'api' | 'team'>('general');
  const [searchParams, setSearchParams] = useSearchParams();
  const [paymentReturn, setPaymentReturn] = useState(false);

  useEffect(() => {
    if (searchParams.get('billing') === 'complete') {
      setPaymentReturn(true);
      refresh();
      searchParams.delete('billing');
      setSearchParams(searchParams, { replace: true });
      setTab('billing');
    }
  }, []);
  const [form, setForm] = useState({ legal_name: '', commercial_name: '', email: '', phone: '', website: '', address: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (activeTenant) {
      setForm({
        legal_name: activeTenant.legal_name ?? '',
        commercial_name: activeTenant.commercial_name ?? '',
        email: activeTenant.email ?? '',
        phone: activeTenant.phone ?? '',
        website: activeTenant.website ?? '',
        address: activeTenant.address ?? '',
      });
    }
  }, [activeTenant]);

  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    if (!activeTenant) return;
    setSaving(true); setSaved(false); setErr(null);
    const { error } = await supabase.from('tenants').update({
      legal_name: form.legal_name,
      commercial_name: form.commercial_name || null,
      email: form.email,
      phone: form.phone || null,
      website: form.website || null,
      address: form.address || null,
    }).eq('id', activeTenant.id);
    if (error) { setErr(error.message); setSaving(false); return; }
    await refresh();
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (!activeTenant) return null;

  const tabs = [
    { key: 'general' as const, icon: Building2, label: t('settings.general') },
    { key: 'profile' as const, icon: User, label: t('settings.profile') },
    { key: 'billing' as const, icon: CreditCard, label: t('settings.billing') },
    { key: 'branches' as const, icon: Building2, label: t('settings.branches') },
    ...(activeTenant?.owner_user_id === user?.id ? [{ key: 'team' as const, icon: Users, label: t('settings.team') }] : []),
    { key: 'support' as const, icon: HeadphonesIcon, label: t('settings.support') },
    ...(hasModuleAccess(activePlan, 'api') ? [{ key: 'api' as const, icon: Key, label: t('settings.api') }] : []),
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center"><SettingsIcon size={22} className="text-blue-600" /></div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('settings.subtitle')}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {tabs.map((tb) => (
          <button key={tb.key} onClick={() => setTab(tb.key)} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === tb.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <tb.icon size={16} /> {tb.label}
          </button>
        ))}
      </div>

      {paymentReturn && (
        <div className="mb-6 p-4 rounded-xl border border-blue-200 bg-blue-50 text-sm text-blue-800">
          {activeTenant?.status === 'approved' ? t('billing.payment_confirmed') : t('billing.payment_processing')}
        </div>
      )}

      {tab === 'general' && (
        <Card className="p-6 max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label={t('settings.tenant_name')} required value={form.legal_name} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} />
            <Input label={t('onb.commercial')} value={form.commercial_name} onChange={(e) => setForm({ ...form, commercial_name: e.target.value })} />
            <Input label={t('settings.tenant_email')} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label={t('settings.tenant_phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input label={t('settings.tenant_website')} value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            <Input label={t('settings.tenant_address')} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="mt-6 flex items-center gap-3">
            <Button onClick={save} loading={saving}>{t('settings.save')}</Button>
            {saved && <span className="flex items-center gap-1 text-sm text-emerald-600"><Check size={16} /> {t('settings.saved')}</span>}
            {err && <span className="text-sm text-red-600">{err}</span>}
          </div>
        </Card>
      )}

      {tab === 'profile' && (
        <div className="space-y-6 max-w-2xl">
          <Card className="p-6">
            <div className="space-y-4">
              <Input label={t('settings.profile_name')} value={profile?.full_name ?? ''} disabled />
              <Input label={t('settings.profile_email')} value={user?.email ?? ''} disabled />
            </div>
            <p className="mt-4 text-xs text-gray-400">{t('settings.profile_managed_note')}</p>
          </Card>
          <MfaSection />
        </div>
      )}

      {tab === 'billing' && (
        <BillingTab tenant={activeTenant} onUpdated={refresh} />
      )}

      {tab === 'branches' && (
        <BranchesTab tenant={activeTenant} onUpdated={refresh} />
      )}

      {tab === 'support' && <SupportTab />}
      {tab === 'team' && <TeamTab tenantId={activeTenant.id} />}
      {tab === 'api' && <ApiTab tenantId={activeTenant.id} />}
    </div>
  );
}

function ApiTab({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const [keys, setKeys] = useState<{ id: string; name: string; scopes: string[]; is_active: boolean; last_used_at: string | null; created_at: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', scopes: 'read' });
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = () => {
    supabase.from('api_keys').select('id, name, scopes, is_active, last_used_at, created_at').eq('tenant_id', tenantId).order('created_at', { ascending: false })
      .then(({ data }) => setKeys((data as typeof keys) ?? []));
  };
  useEffect(() => { load(); }, [tenantId]);

  const createKey = async () => {
    setErr(null);
    const keyValue = generateApiKey();
    const hash = await sha256Hex(keyValue);
    const { error } = await supabase.from('api_keys').insert({ name: form.name, key_hash: hash, scopes: form.scopes.split(','), is_active: true, tenant_id: tenantId });
    if (error) { setErr(error.message); return; }
    setForm({ name: '', scopes: 'read' }); setOpen(false); load();
    setRevealedKey(keyValue);
  };

  const toggle = async (k: { id: string; is_active: boolean }) => {
    setErr(null);
    const { error } = await supabase.from('api_keys').update({ is_active: !k.is_active }).eq('id', k.id);
    if (error) { setErr(error.message); return; }
    load();
  };

  const remove = async (id: string) => {
    setErr(null);
    const { error } = await supabase.from('api_keys').delete().eq('id', id);
    if (error) { setErr(error.message); return; }
    load();
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="p-3 rounded-xl border border-blue-200 bg-blue-50 text-sm text-blue-800">{t('settings.api_desc')}</div>
      {err && !open && <p className="text-sm text-red-600">{err}</p>}
      <div className="flex justify-end"><Button onClick={() => setOpen(true)}><Key size={16} /> {t('sa.generate_api_key')}</Button></div>
      {keys.length === 0 ? (
        <Card className="p-8 text-center text-sm text-gray-400">{t('common.none')}</Card>
      ) : (
        <div className="space-y-3">
          {keys.map((k) => (
            <Card key={k.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">{k.name}</p>
                <p className="text-xs text-gray-400">{Array.isArray(k.scopes) ? k.scopes.join(', ') : k.scopes} — {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : t('settings.api_never_used')}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge color={k.is_active ? 'green' : 'gray'}>{k.is_active ? t('opt.active') : t('opt.inactive')}</Badge>
                <Button size="sm" variant="outline" onClick={() => toggle(k)}>{k.is_active ? t('sa.deactivate') : t('sa.activate')}</Button>
                <Button size="sm" variant="outline" onClick={() => remove(k.id)}><Trash2 size={14} /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={t('sa.generate_api_key')} footer={<><Button variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button><Button onClick={createKey}>{t('common.save')}</Button></>}>
        <div className="space-y-3">
          {err && <p className="text-sm text-red-600">{err}</p>}
          <Input label={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Select label={t('sa.scopes')} value={form.scopes} onChange={(e) => setForm({ ...form, scopes: e.target.value })}
            options={[{ value: 'read', label: t('sa.scope_read') }, { value: 'read,write', label: t('sa.scope_read_write') }]} />
        </div>
      </Modal>
      <Modal open={!!revealedKey} onClose={() => setRevealedKey(null)} title={t('sa.key_generated')} footer={<Button onClick={() => setRevealedKey(null)}>{t('sa.key_saved_it')}</Button>}>
        <div className="space-y-3">
          <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded-xl">{t('sa.key_shown_once')}</p>
          <code className="block p-3 bg-gray-900 text-emerald-400 rounded-xl text-sm break-all select-all">{revealedKey}</code>
        </div>
      </Modal>
    </div>
  );
}

function MfaSection() {
  const { t } = useI18n();
  const [factors, setFactors] = useState<{ id: string; status: string }[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.totp ?? []).map((f) => ({ id: f.id, status: f.status })));
  };
  useEffect(() => { load(); }, []);

  const verifiedFactor = factors.find((f) => f.status === 'verified');

  const startEnroll = async () => {
    setErr(null); setLoading(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setPendingFactorId(data.id);
    setEnrolling(true);
  };

  const confirmEnroll = async () => {
    if (!pendingFactorId) return;
    setErr(null); setLoading(true);
    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: pendingFactorId });
    if (challengeErr) { setErr(challengeErr.message); setLoading(false); return; }
    const { error } = await supabase.auth.mfa.verify({ factorId: pendingFactorId, challengeId: challenge.id, code });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    setEnrolling(false); setQrCode(null); setSecret(null); setPendingFactorId(null); setCode('');
    load();
  };

  const disable = async (factorId: string) => {
    setLoading(true);
    await supabase.auth.mfa.unenroll({ factorId });
    setLoading(false);
    load();
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-2">
        <ShieldCheck size={20} className={verifiedFactor ? 'text-emerald-600' : 'text-gray-400'} />
        <h3 className="font-semibold text-gray-900">{t('settings.mfa_title')}</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">{t('settings.mfa_desc')}</p>

      {verifiedFactor ? (
        <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200">
          <span className="text-sm text-emerald-800 font-medium">{t('settings.mfa_enabled')}</span>
          <Button variant="outline" onClick={() => disable(verifiedFactor.id)} loading={loading}>{t('settings.mfa_disable')}</Button>
        </div>
      ) : enrolling ? (
        <div className="space-y-4">
          {qrCode && <div className="flex justify-center p-4 bg-white border border-gray-200 rounded-xl" dangerouslySetInnerHTML={{ __html: qrCode }} />}
          {secret && <p className="text-xs text-gray-400 text-center break-all">{t('settings.mfa_manual_key')}: {secret}</p>}
          <Input label={t('auth.mfa.code_label')} value={code} onChange={(e) => setCode(e.target.value)} placeholder="000000" maxLength={6} />
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex gap-2">
            <Button onClick={confirmEnroll} loading={loading}>{t('settings.mfa_confirm')}</Button>
            <Button variant="outline" onClick={() => { setEnrolling(false); setErr(null); }}>{t('common.cancel')}</Button>
          </div>
        </div>
      ) : (
        <>
          {err && <p className="text-sm text-red-600 mb-3">{err}</p>}
          <Button onClick={startEnroll} loading={loading}>{t('settings.mfa_enable')}</Button>
        </>
      )}
    </Card>
  );
}

function TeamTab({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const [members, setMembers] = useState<{ id: string; user_id: string; role: string; profiles: { full_name: string; email: string } | null }[]>([]);
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ email: '', role_name: 'admin' });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = () => {
    supabase.from('tenant_memberships').select('id, user_id, role, profiles(full_name, email)').eq('tenant_id', tenantId)
      .then(({ data }) => setMembers((data as any) ?? []));
    supabase.from('roles').select('id, name').eq('tenant_id', tenantId).order('name')
      .then(({ data }) => setRoles((data as typeof roles) ?? []));
  };
  useEffect(() => { load(); }, [tenantId]);

  const invite = async () => {
    if (!form.email.trim()) return;
    setSubmitting(true); setErr(null); setMsg(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) { setErr(t('billing.error_no_session')); setSubmitting(false); return; }

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-team-member`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email: form.email.trim(), role_name: form.role_name }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) { setErr(data.message || t('settings.team_error_generic')); return; }
    setMsg(data.status === 'invited' ? t('settings.team_invited') : t('settings.team_added'));
    setForm({ email: '', role_name: 'admin' });
    load();
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Card className="p-6">
        <h3 className="font-semibold text-gray-900 mb-1">{t('settings.team_invite_title')}</h3>
        <p className="text-xs text-gray-400 mb-4">{t('settings.team_invite_desc')}</p>
        <div className="space-y-3">
          <Input label={t('common.email')} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Select label={t('fld.role_name')} value={form.role_name} onChange={(e) => setForm({ ...form, role_name: e.target.value })}
            options={[{ value: 'admin', label: t('settings.team_role_admin') }, ...roles.map((r) => ({ value: r.name, label: r.name }))]} />
          {err && <p className="text-sm text-red-600">{err}</p>}
          {msg && <p className="text-sm text-emerald-600">{msg}</p>}
          <Button onClick={invite} loading={submitting}>{t('settings.team_invite_cta')}</Button>
        </div>
      </Card>

      <div>
        <h3 className="font-semibold text-gray-900 mb-3">{t('settings.team_members')}</h3>
        <div className="space-y-2">
          {members.map((m) => (
            <Card key={m.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{m.profiles?.full_name || m.profiles?.email || m.user_id}</p>
                <p className="text-xs text-gray-400">{m.profiles?.email}</p>
              </div>
              <Badge>{m.role}</Badge>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function SupportTab() {
  const { t } = useI18n();
  const { user, activeTenant } = useAuth();
  const [tickets, setTickets] = useState<{ id: string; subject: string; description: string; priority: string; status: string; resolution: string | null; created_at: string }[]>([]);
  const [form, setForm] = useState({ subject: '', description: '', priority: 'low' });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = () => {
    supabase.from('support_tickets').select('*').eq('user_id', user!.id).order('created_at', { ascending: false })
      .then(({ data }) => setTickets((data as typeof tickets) ?? []));
  };
  useEffect(() => { if (user) load(); }, [user]);

  const submit = async () => {
    if (!form.subject.trim()) return;
    setSubmitting(true); setErr(null);
    const { error } = await supabase.from('support_tickets').insert({
      tenant_id: activeTenant?.id ?? null, user_id: user!.id,
      subject: form.subject, description: form.description, priority: form.priority, status: 'open',
    });
    setSubmitting(false);
    if (error) { setErr(error.message); return; }
    setForm({ subject: '', description: '', priority: 'low' });
    load();
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Card className="p-6">
        <h3 className="font-semibold text-gray-900 mb-4">{t('settings.support_new_ticket')}</h3>
        <div className="space-y-3">
          <Input label={t('settings.support_subject')} required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1.5">{t('settings.support_description')}</span>
            <textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </label>
          <Select label={t('settings.support_priority')} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
            options={[{ value: 'low', label: t('opt.low') }, { value: 'medium', label: t('opt.medium') }, { value: 'high', label: t('opt.high') }]} />
          {err && <p className="text-sm text-red-600">{err}</p>}
          <Button onClick={submit} loading={submitting}>{t('settings.support_submit')}</Button>
        </div>
      </Card>

      <div>
        <h3 className="font-semibold text-gray-900 mb-3">{t('settings.support_my_tickets')}</h3>
        {tickets.length === 0 ? (
          <p className="text-sm text-gray-400">{t('common.none')}</p>
        ) : (
          <div className="space-y-3">
            {tickets.map((tk) => (
              <Card key={tk.id} className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-gray-900">{tk.subject}</p>
                  <Badge color={tk.status === 'open' ? 'blue' : tk.status === 'resolved' ? 'green' : 'gray'}>{tk.status}</Badge>
                </div>
                <p className="text-sm text-gray-500">{tk.description}</p>
                {tk.resolution && (
                  <div className="mt-2 p-2.5 rounded-lg bg-emerald-50 text-sm text-emerald-800">
                    <span className="font-medium">{t('settings.support_resolution')}: </span>{tk.resolution}
                  </div>
                )}
                <p className="text-xs text-gray-300 mt-2">{new Date(tk.created_at).toLocaleString()}</p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BillingTab({ tenant, onUpdated }: { tenant: Tenant; onUpdated: () => void }) {
  const { t } = useI18n();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('subscription_plans').select('*').eq('is_active', true).order('sort_order');
      setPlans((data as SubscriptionPlan[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const [err, setErr] = useState<string | null>(null);
  const selectPlan = async (planId: string) => {
    setSaving(true); setErr(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) { setErr(t('billing.error_no_session')); setSaving(false); return; }

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/flutterwave-initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ plan_id: planId, billing_cycle: 'monthly' }),
    });
    const data = await res.json();
    setSaving(false);

    if (data.status === 'not_configured') { setErr(t('billing.error_not_configured')); return; }
    if (!res.ok || !data.payment_link) { setErr(data.message || t('billing.error_generic')); return; }

    // Real access change happens server-side in flutterwave-webhook once
    // Flutterwave confirms payment -- this redirect just takes the admin
    // to actually pay, it does not grant anything itself.
    window.location.href = data.payment_link;
  };

  const currentPlan = plans.find((p) => p.id === tenant.plan_id);

  return (
    <div className="space-y-6">
      <Card className="p-6 max-w-2xl">
        <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50">
          <div>
            <p className="text-sm text-gray-500">{t('settings.billing_plan')}</p>
            <p className="text-lg font-bold text-gray-900">{currentPlan?.name ?? t('settings.trial')}</p>
          </div>
          <Badge color={tenant.status === 'approved' ? 'green' : 'amber'}>{tenant.status}</Badge>
        </div>
        <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 mt-3">
          <div>
            <p className="text-sm text-gray-500">{t('dash.trial')}</p>
            <p className="text-lg font-bold text-gray-900">{new Date(tenant.trial_ends_at).toLocaleDateString()}</p>
          </div>
        </div>
      </Card>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-4">{t('settings.choose_plan')}</h3>
        {loading ? <p className="text-sm text-gray-400">{t('common.loading')}</p> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl">
            {plans.map((p) => {
              const isCurrent = p.id === tenant.plan_id;
              return (
                <Card key={p.id} className={`p-5 ${isCurrent ? 'border-blue-500 ring-2 ring-blue-100' : ''}`}>
                  <p className="font-semibold text-gray-900">{p.name}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">${p.price_monthly}<span className="text-sm font-normal text-gray-400">/{t('plan.month')}</span></p>
                  {p.features && p.features.length > 0 && <ul className="mt-3 space-y-1">{p.features.slice(0, 4).map((f, i) => <li key={i} className="text-xs text-gray-500 flex items-start gap-1"><Check size={12} className="text-emerald-500 mt-0.5" /> {f}</li>)}</ul>}
                  <Button variant={isCurrent ? 'outline' : 'primary'} size="sm" className="w-full mt-4" disabled={isCurrent || saving} onClick={() => selectPlan(p.id)}>
                    {isCurrent ? t('settings.current_plan') : t('plan.choose')}
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
        {saved && <p className="mt-3 text-sm text-emerald-600 flex items-center gap-1"><Check size={16} /> {t('settings.saved')}</p>}
        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      </div>
    </div>
  );
}

function BranchesTab({ tenant, onUpdated }: { tenant: Tenant | null; onUpdated: () => Promise<void> }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [maxBranches, setMaxBranches] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState({ name: '', healthcare_type: 'hospital', address: '', phone: '', email: '', manager_name: '', manager_phone: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    if (!tenant) return;
    setLoading(true);
    const { data } = await supabase.from('branches').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: true });
    setBranches((data as Branch[]) ?? []);
    if (tenant.plan_id) {
      const { data: plan } = await supabase.from('subscription_plans').select('max_branches').eq('id', tenant.plan_id).single();
      setMaxBranches(plan?.max_branches ?? 1);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [tenant?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const canAdd = branches.length < maxBranches;

  const openAdd = () => { setEditing(null); setForm({ name: '', healthcare_type: 'hospital', address: '', phone: '', email: '', manager_name: '', manager_phone: '' }); setShowModal(true); setErr(null); };
  const openEdit = (b: Branch) => { setEditing(b); setForm({ name: b.name, healthcare_type: b.healthcare_type, address: b.address ?? '', phone: b.phone ?? '', email: b.email ?? '', manager_name: b.manager_name ?? '', manager_phone: b.manager_phone ?? '' }); setShowModal(true); setErr(null); };

  const save = async () => {
    if (!tenant || !form.name) { setErr(t('onb.err.required')); return; }
    setSaving(true); setErr(null);
    let saveError: string | null = null;
    if (editing) {
      const { error } = await supabase.from('branches').update({ name: form.name, healthcare_type: form.healthcare_type, address: form.address, phone: form.phone, email: form.email, manager_name: form.manager_name, manager_phone: form.manager_phone }).eq('id', editing.id);
      saveError = error?.message ?? null;
    } else {
      const { error } = await supabase.from('branches').insert({ tenant_id: tenant.id, name: form.name, healthcare_type: form.healthcare_type, is_head_office: false, address: form.address, phone: form.phone, email: form.email, manager_name: form.manager_name, manager_phone: form.manager_phone, status: 'active' });
      saveError = error?.message ?? null;
    }
    setSaving(false);
    if (saveError) { setErr(saveError); return; }
    setShowModal(false); await load(); await onUpdated();
  };

  const remove = async (id: string) => {
    setErr(null);
    const { error } = await supabase.from('branches').delete().eq('id', id);
    if (error) { setErr(error.message); return; }
    await load();
  };

  const [accountingErr, setAccountingErr] = useState<string | null>(null);
  const updateAccountingMode = async (mode: string) => {
    if (!tenant) return;
    setAccountingErr(null);
    const { error } = await supabase.from('tenants').update({ accounting_mode: mode }).eq('id', tenant.id);
    if (error) { setAccountingErr(error.message); return; }
    await onUpdated();
  };

  return (
    <div className="space-y-6">
      {/* Accounting mode */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">{t('settings.accounting_mode')}</p>
        <div className="flex gap-2">
          {['per_branch', 'consolidated', 'both'].map((m) => (
            <button key={m} onClick={() => updateAccountingMode(m)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all ${tenant?.accounting_mode === m ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
              {t(`settings.accounting.${m}`)}
            </button>
          ))}
        </div>
        {accountingErr && <p className="text-sm text-red-600 mt-2">{accountingErr}</p>}
      </div>

      {/* Branches list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-gray-700">{t('settings.branches.title')}</p>
            <p className="text-xs text-gray-400">{branches.length} / {maxBranches === 999 ? '∞' : maxBranches}</p>
          </div>
          {canAdd && <Button size="sm" onClick={openAdd}><Plus size={14} /> {t('settings.branches.add')}</Button>}
        </div>

        {!canAdd && branches.length > 0 && (
          <p className="text-xs text-amber-600 mb-3">{t('settings.branches.max_reached')}</p>
        )}
        {err && !showModal && <p className="text-sm text-red-600 mb-3">{err}</p>}

        {loading ? <p className="text-sm text-gray-400">{t('common.loading')}</p> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {branches.map((b) => (
              <div key={b.id} className="p-4 rounded-xl border border-gray-200">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 text-sm">{b.name}</span>
                      {b.is_head_office && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">{t('settings.branches.head_office')}</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 capitalize">{b.healthcare_type}</p>
                    {b.address && <p className="text-xs text-gray-500 mt-1">{b.address}</p>}
                    {b.manager_name && <p className="text-xs text-gray-500 mt-1">{t('settings.branches.manager')}: {b.manager_name}</p>}
                  </div>
                  {!b.is_head_office && (
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(b)} className="p-1.5 rounded-lg hover:bg-gray-100"><Pencil size={14} className="text-gray-400" /></button>
                      <button onClick={() => remove(b.id)} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 size={14} className="text-red-400" /></button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">{editing ? t('common.edit') : t('settings.branches.add')}</h3>
              <button onClick={() => setShowModal(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <Input label={t('settings.branches.name')} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Select label={t('settings.branches.type')} value={form.healthcare_type}
                options={[{ value: 'hospital', label: 'Hospital' }, { value: 'clinic', label: 'Clinic' }, { value: 'pharmacy', label: 'Pharmacy' }, { value: 'lab', label: 'Lab' }, { value: 'health_center', label: 'Health Center' }]}
                onChange={(e) => setForm({ ...form, healthcare_type: e.target.value })} />
              <Input label={t('settings.branches.address')} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              <Input label={t('settings.branches.manager')} value={form.manager_name} onChange={(e) => setForm({ ...form, manager_name: e.target.value })} />
              <Input label={t('col.phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
            <Button className="w-full mt-4" onClick={save} loading={saving}>{t('common.save')}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
