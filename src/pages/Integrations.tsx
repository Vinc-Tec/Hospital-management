import { useState } from 'react';
import {
  MessageCircle, Smartphone, CalendarDays, Slack, Webhook as WebhookIcon,
  Wallet, Plug, Key, Plus, Trash2, ExternalLink, CheckCircle2, Loader2,
} from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useCrud } from '../lib/useCrud';
import { supabase, type Integration, type Webhook } from '../lib/supabase';
import { Card, Button, Input, Select, Modal, Badge, EmptyState, PageHeader } from '../components/ui';

type ProviderKey = Integration['provider'];

const PROVIDER_META: Record<ProviderKey, { icon: typeof Plug; color: string; fields: { key: string; label: string; placeholder?: string }[] }> = {
  whatsapp: { icon: MessageCircle, color: 'text-emerald-600 bg-emerald-50', fields: [{ key: 'phone_number', label: 'Phone number', placeholder: '+237 6XX XXX XXX' }, { key: 'api_token', label: 'API token' }] },
  sms: { icon: Smartphone, color: 'text-blue-600 bg-blue-50', fields: [{ key: 'sender_id', label: 'Sender ID' }, { key: 'api_key', label: 'API key' }] },
  google_calendar: { icon: CalendarDays, color: 'text-red-600 bg-red-50', fields: [{ key: 'calendar_id', label: 'Calendar ID', placeholder: 'you@company.com' }] },
  slack: { icon: Slack, color: 'text-purple-600 bg-purple-50', fields: [{ key: 'webhook_url', label: 'Incoming webhook URL' }, { key: 'channel', label: 'Channel', placeholder: '#front-desk' }] },
  flutterwave: { icon: Wallet, color: 'text-amber-600 bg-amber-50', fields: [{ key: 'public_key', label: 'Public key' }] },
  webhook_generic: { icon: WebhookIcon, color: 'text-gray-600 bg-gray-100', fields: [{ key: 'target_url', label: 'Target URL' }] },
};

const CATALOG: { provider: ProviderKey; name: string; desc: string }[] = [
  { provider: 'whatsapp', name: 'WhatsApp Business', desc: 'Send appointment reminders and confirmations over WhatsApp' },
  { provider: 'sms', name: 'SMS Gateway', desc: 'Send SMS reminders and alerts to patients and staff' },
  { provider: 'google_calendar', name: 'Google Calendar', desc: 'Sync doctor schedules and appointments two-way' },
  { provider: 'slack', name: 'Slack', desc: 'Post new appointments, admissions and payments to a channel' },
  { provider: 'flutterwave', name: 'Flutterwave', desc: 'Payment provider used for your subscription billing' },
  { provider: 'webhook_generic', name: 'Custom webhook', desc: 'Forward events to any URL you control' },
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
  const integrations = useCrud<Integration>('integrations', tenantId);
  const webhooks = useCrud<Webhook>('webhooks', tenantId);

  const [configuring, setConfiguring] = useState<ProviderKey | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

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
    if (existing) {
      await supabase.from('integrations').update({ config: form, status: 'active', updated_at: new Date().toISOString() }).eq('id', existing.id).eq('tenant_id', tenantId);
    } else {
      await supabase.from('integrations').insert({ tenant_id: tenantId, provider: configuring, name: meta.name, config: form, status: 'active' });
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CATALOG.map((c) => {
            const meta = PROVIDER_META[c.provider];
            const Icon = meta.icon;
            const row = byProvider.get(c.provider);
            const connected = row?.status === 'active';
            return (
              <div key={c.provider} className="rounded-2xl border border-gray-200 p-4 flex flex-col hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${meta.color}`}>
                    <Icon size={18} />
                  </div>
                  {row && <Badge color={statusColor(row.status)}>{connected ? <span className="inline-flex items-center gap-1"><CheckCircle2 size={12} />{t('integrations.connected')}</span> : t('integrations.not_connected')}</Badge>}
                </div>
                <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                <p className="text-xs text-gray-500 mt-1 mb-4 flex-1">{c.desc}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant={connected ? 'outline' : 'primary'} className="flex-1" onClick={() => openConfigure(c.provider)}>
                    {t('integrations.configure')}
                  </Button>
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
        ) : webhooks.rows.length === 0 ? (
          <EmptyState icon={WebhookIcon} title={t('integrations.webhooks.empty')} />
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
        title={configuring ? CATALOG.find((c) => c.provider === configuring)!.name : ''}
        footer={<>
          <Button variant="outline" onClick={() => setConfiguring(null)}>Cancel</Button>
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
          <Button variant="outline" onClick={() => setWebhookModal(false)}>Cancel</Button>
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
