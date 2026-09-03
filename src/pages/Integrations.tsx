import { useState } from 'react';
import {
  Smartphone, Plug, Key, Plus, Trash2, ExternalLink,
  CheckCircle2, Loader2, AlertTriangle, RefreshCw, Send,
} from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useCrud } from '../lib/useCrud';
import { useAuth } from '../lib/auth';
import { supabase, type Integration, type Webhook } from '../lib/supabase';
import { Card, Button, Input, Select, Modal, Badge, EmptyState, PageHeader } from '../components/ui';
import whatsappLogo from '../assets/integrations/whatsapp.png';
import slackLogo from '../assets/integrations/slack.png';
import googleCalendarLogo from '../assets/integrations/google-calendar.png';
import flutterwaveLogo from '../assets/integrations/flutterwave.png';
import telegramLogo from '../assets/integrations/telegram.jpg';

type ProviderKey = Integration['provider'];

const PROVIDER_META: Record<ProviderKey, { icon?: typeof Plug; logo?: string; color: string; fields: { key: string; label: string; placeholder?: string }[]; testable?: boolean }> = {
  whatsapp: { logo: whatsappLogo, color: 'bg-emerald-50', fields: [{ key: 'phone_number_id', label: 'Phone number ID (Meta)', placeholder: '109xxxxxxxxxxxx' }, { key: 'api_token', label: 'Access token (Meta)' }] },
  sms: { icon: Smartphone, color: 'text-blue-600 bg-blue-50', fields: [{ key: 'sender_id', label: 'Sender ID' }, { key: 'api_key', label: 'API key' }] },
  google_calendar: { logo: googleCalendarLogo, color: 'bg-red-50', fields: [{ key: 'calendar_id', label: 'Calendar ID', placeholder: 'you@company.com' }] },
  slack: { logo: slackLogo, color: 'bg-purple-50', fields: [{ key: 'webhook_url', label: 'Incoming webhook URL', placeholder: 'https://hooks.slack.com/services/…' }], testable: true },
  flutterwave: { logo: flutterwaveLogo, color: 'bg-amber-50', fields: [{ key: 'public_key', label: 'Public key' }] },
  webhook_generic: { icon: Plug, color: 'text-gray-600 bg-gray-100', fields: [{ key: 'target_url', label: 'Target URL' }] },
  telegram: { logo: telegramLogo, color: 'bg-sky-50', fields: [{ key: 'bot_token', label: 'Bot token', placeholder: '123456:ABC-DEF...' }, { key: 'chat_id', label: 'Chat ID', placeholder: '-100123456789' }], testable: true },
};

const CATALOG: { provider: ProviderKey; nameKey: string; descKey: string }[] = [
  { provider: 'whatsapp', nameKey: 'integrations.name.whatsapp', descKey: 'integrations.use.whatsapp' },
  { provider: 'telegram', nameKey: 'integrations.name.telegram', descKey: 'integrations.telegram.desc' },
  { provider: 'slack', nameKey: 'integrations.name.slack', descKey: 'integrations.slack.desc' },
  { provider: 'sms', nameKey: 'integrations.name.sms', descKey: 'integrations.sms.desc' },
  { provider: 'google_calendar', nameKey: 'integrations.name.calendar', descKey: 'integrations.use.calendar' },
  { provider: 'flutterwave', nameKey: 'integrations.name.flutterwave', descKey: 'integrations.flutterwave.desc' },
  { provider: 'webhook_generic', nameKey: 'integrations.name.webhook', descKey: 'integrations.webhook.desc' },
];

const EVENT_OPTIONS = (t: (k: string) => string) => [
  { value: 'all', label: t('integrations.event.all') },
  { value: 'appointment.created', label: t('integrations.event.appointment') },
  { value: 'invoice.paid', label: t('integrations.event.invoice') },
  { value: 'patient.created', label: t('integrations.event.patient') },
];

function statusColor(status: string): 'green' | 'gray' | 'red' {
  if (status === 'active') return 'green';
  if (status === 'error') return 'red';
  return 'gray';
}

export function IntegrationsModule({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const { session } = useAuth();
  const integrations = useCrud<Integration>('integrations', tenantId);
  const webhooks = useCrud<Webhook>('webhooks', tenantId);

  const [configuring, setConfiguring] = useState<ProviderKey | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<ProviderKey | null>(null);
  const [testResult, setTestResult] = useState<{ provider: ProviderKey; ok: boolean; message: string } | null>(null);

  const [webhookModal, setWebhookModal] = useState(false);
  const [whForm, setWhForm] = useState<{ name: string; url: string; event: string; secret: string }>({ name: '', url: '', event: 'all', secret: '' });
  const [whSaving, setWhSaving] = useState(false);

  const byProvider = new Map(integrations.rows.map((i) => [i.provider, i]));

  function openConfigure(provider: ProviderKey) {
    const existing = byProvider.get(provider);
    setForm((existing?.config as Record<string, string>) ?? {});
    setConfiguring(provider);
  }

  async function saveIntegration() {
    if (!configuring) return;
    setSaving(true);
    const existing = byProvider.get(configuring);
    const meta = CATALOG.find((c) => c.provider === configuring)!;
    const name = t(meta.nameKey);
    if (existing) {
      await supabase.from('integrations').update({ config: form, status: 'active', updated_at: new Date().toISOString() }).eq('id', existing.id).eq('tenant_id', tenantId);
    } else {
      await supabase.from('integrations').insert({ tenant_id: tenantId, provider: configuring, name, config: form, status: 'active' });
    }
    await integrations.load();
    setSaving(false);
    setConfiguring(null);
  }

  async function disconnect(provider: ProviderKey) {
    const existing = byProvider.get(provider);
    if (!existing) return;
    await supabase.from('integrations').update({ status: 'inactive' }).eq('id', existing.id).eq('tenant_id', tenantId);
    await integrations.load();
  }

  // Actually fires a real message through dispatch-integration-event, so a
  // tenant can confirm right here that a connected provider works -- not
  // just that a form saved. See supabase/functions/dispatch-integration-event.
  async function sendTest(provider: ProviderKey) {
    if (!session) return;
    setTesting(provider);
    setTestResult(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dispatch-integration-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          tenant_id: tenantId,
          event: 'integration.test',
          title: t('integrations.test.message_title'),
          lines: [t('integrations.test.message_body')],
        }),
      });
      const data = await res.json();
      const key = provider === 'slack' ? 'slack' : provider === 'telegram' ? 'telegram' : null;
      const outcome = key ? data.results?.[key] : undefined;
      const ok = outcome === 'sent';
      setTestResult({ provider, ok, message: ok ? t('integrations.test.success') : `${t('integrations.test.failed')}${outcome ? ` (${outcome})` : ''}` });
    } catch (e) {
      setTestResult({ provider, ok: false, message: e instanceof Error ? e.message : t('integrations.test.failed') });
    }
    setTesting(null);
  }

  async function addWebhook() {
    setWhSaving(true);
    await webhooks.insert({ name: whForm.name, url: whForm.url, event: whForm.event, secret: whForm.secret || null, is_active: true } as Partial<Webhook>);
    setWhSaving(false);
    setWebhookModal(false);
    setWhForm({ name: '', url: '', event: 'all', secret: '' });
  }

  async function toggleWebhook(w: Webhook) {
    await webhooks.update(w.id, { is_active: !w.is_active } as Partial<Webhook>);
  }

  async function removeWebhook(id: string) {
    await webhooks.remove(id);
  }

  return (
    <div>
      <PageHeader title={t('mod.integrations.title')} desc={t('mod.integrations.desc')} />

      {/* Connector catalog */}
      <Card className="p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900">{t('integrations.catalog')}</h2>
        <p className="text-sm text-gray-500 mt-1 mb-5">{t('integrations.catalog.desc')}</p>
        {integrations.error && (
          <div className="mb-4 flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
            <AlertTriangle size={15} className="flex-shrink-0" />
            <span className="flex-1">{t('common.load_failed')}: {integrations.error}</span>
            <button onClick={() => integrations.load()} className="font-medium underline flex-shrink-0">{t('common.retry')}</button>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CATALOG.map((c) => {
            const meta = PROVIDER_META[c.provider];
            const Icon = meta.icon;
            const row = byProvider.get(c.provider);
            const connected = row?.status === 'active';
            const result = testResult?.provider === c.provider ? testResult : null;
            return (
              <div key={c.provider} className="rounded-2xl border border-gray-200 p-4 flex flex-col hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden ${meta.color}`}>
                    {meta.logo ? <img src={meta.logo} alt="" className="w-full h-full object-contain p-1.5" /> : Icon ? <Icon size={18} className="text-gray-600" /> : null}
                  </div>
                  {row && <Badge color={statusColor(row.status)}>{connected ? <span className="inline-flex items-center gap-1"><CheckCircle2 size={12} />{t('integrations.connected')}</span> : t('integrations.not_connected')}</Badge>}
                </div>
                <p className="text-sm font-semibold text-gray-900">{t(c.nameKey)}</p>
                <p className="text-xs text-gray-500 mt-1 mb-4 flex-1">{t(c.descKey)}</p>
                {result && (
                  <p className={`text-xs mb-2 ${result.ok ? 'text-emerald-600' : 'text-red-600'}`}>{result.message}</p>
                )}
                <div className="flex gap-2">
                  <Button size="sm" variant={connected ? 'outline' : 'primary'} className="flex-1" onClick={() => openConfigure(c.provider)}>
                    {t('integrations.configure')}
                  </Button>
                  {connected && meta.testable && (
                    <Button size="sm" variant="outline" loading={testing === c.provider} onClick={() => sendTest(c.provider)}>
                      <Send size={13} />
                    </Button>
                  )}
                  {connected && (
                    <Button size="sm" variant="ghost" onClick={() => disconnect(c.provider)}>{t('integrations.disconnect')}</Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Webhooks */}
      <Card className="p-6 mb-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{t('integrations.webhooks')}</h2>
            <p className="text-sm text-gray-500 mt-1">{t('integrations.webhooks.desc')}</p>
          </div>
          <Button size="sm" onClick={() => setWebhookModal(true)}><Plus size={14} />{t('integrations.webhooks.add')}</Button>
        </div>
        {webhooks.loading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-300" size={24} /></div>
        ) : webhooks.error ? (
          <div className="p-8 flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center"><AlertTriangle size={22} className="text-red-500" /></div>
            <div><p className="text-sm font-semibold text-gray-900">{t('common.load_failed')}</p><p className="text-xs text-gray-500 mt-1 max-w-md">{webhooks.error}</p></div>
            <Button variant="outline" size="sm" onClick={() => webhooks.load()}><RefreshCw size={14} /> {t('common.retry')}</Button>
          </div>
        ) : webhooks.rows.length === 0 ? (
          <EmptyState icon={Plug} title={t('integrations.webhooks.empty')} />
        ) : (
          <div className="divide-y divide-gray-100">
            {webhooks.rows.map((w) => (
              <div key={w.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{w.name}</p>
                  <p className="text-xs text-gray-500 truncate">{w.url}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <Badge color="blue">{EVENT_OPTIONS(t).find((e) => e.value === w.event)?.label ?? w.event}</Badge>
                  <Badge color={w.is_active ? 'green' : 'gray'}>{w.is_active ? t('integrations.status.active') : t('integrations.status.inactive')}</Badge>
                  <button onClick={() => toggleWebhook(w)} className="text-xs font-medium text-blue-600 hover:underline">{w.is_active ? t('integrations.status.inactive') : t('integrations.status.active')}</button>
                  <button onClick={() => removeWebhook(w.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* API keys pointer */}
      <Card className="p-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center"><Key size={18} className="text-gray-600" /></div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{t('integrations.api.title')}</p>
            <p className="text-xs text-gray-500">{t('integrations.api.desc')}</p>
          </div>
        </div>
        <a href="/app/settings#api" className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline">
          {t('integrations.api.manage')} <ExternalLink size={14} />
        </a>
      </Card>

      {/* Configure connector modal */}
      <Modal
        open={!!configuring}
        onClose={() => setConfiguring(null)}
        title={configuring ? t(CATALOG.find((c) => c.provider === configuring)!.nameKey) : ''}
        footer={<>
          <Button variant="outline" onClick={() => setConfiguring(null)}>{t('common.cancel')}</Button>
          <Button loading={saving} onClick={saveIntegration}>{t('integrations.save')}</Button>
        </>}
      >
        <div className="space-y-4">
          {configuring && PROVIDER_META[configuring].fields.map((f) => (
            <Input key={f.key} label={f.label} placeholder={f.placeholder} value={form[f.key] ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))} />
          ))}
        </div>
      </Modal>

      {/* Add webhook modal */}
      <Modal
        open={webhookModal}
        onClose={() => setWebhookModal(false)}
        title={t('integrations.webhooks.add')}
        footer={<>
          <Button variant="outline" onClick={() => setWebhookModal(false)}>{t('common.cancel')}</Button>
          <Button loading={whSaving} disabled={!whForm.name || !whForm.url} onClick={addWebhook}>{t('integrations.save')}</Button>
        </>}
      >
        <div className="space-y-4">
          <Input label={t('integrations.webhooks.name')} value={whForm.name} onChange={(e) => setWhForm({ ...whForm, name: e.target.value })} required />
          <Input label={t('integrations.webhooks.url')} placeholder="https://" value={whForm.url} onChange={(e) => setWhForm({ ...whForm, url: e.target.value })} required />
          <Select label={t('integrations.webhooks.event')} options={EVENT_OPTIONS(t)} value={whForm.event} onChange={(e) => setWhForm({ ...whForm, event: e.target.value })} />
          <Input label={t('integrations.webhooks.secret')} value={whForm.secret} onChange={(e) => setWhForm({ ...whForm, secret: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
