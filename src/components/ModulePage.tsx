import { type ReactNode, useState } from 'react';
import { Plus, Pencil, Trash2, Search, FileDown, Inbox, ChevronLeft, ChevronRight, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button, Card, Input, Modal, EmptyState, Badge } from './ui';
import { usePaginatedCrud } from '../lib/useCrud';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

// Fire-and-forget: notify any connected Slack/Telegram/webhook integrations
// for this tenant when something worth knowing about happens. Failure here
// must never block the actual save the user is waiting on, so this is
// deliberately not awaited by callers and swallows its own errors.
// See supabase/functions/dispatch-integration-event for the real delivery
// logic (only fires to providers the tenant has actually connected).
function notifyIntegrations(accessToken: string | undefined, tenantId: string, event: string, title: string, lines: string[]) {
  if (!accessToken) return;
  fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dispatch-integration-event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ tenant_id: tenantId, event, title, lines }),
  }).catch(() => { /* best-effort notification, never surfaced to the user */ });
}

export type FieldDef = {
  key: string; label: string; type?: 'text' | 'number' | 'date' | 'textarea' | 'select' | 'datetime-local' | 'datalist' | 'file';
  required?: boolean; options?: { value: string; label: string }[]; placeholder?: string;
};

export type ColumnDef = {
  key: string; label: string; render?: (row: any) => ReactNode;
  searchKeys?: string[]; // real DB columns this displayed column searches, if different from `key` (e.g. a combined "name" column backed by first_name + last_name)
};

type Row = { id: string; [k: string]: unknown };

// Columns whose underlying Postgres type can't be filtered with ILIKE
// (uuid foreign keys, timestamps/dates) are excluded from server-side
// search -- this is a naming-convention heuristic (every such column in
// this schema ends in _id, _at, or _date), not per-column type metadata.
function isSearchableColumn(key: string) {
  return !/_id$|_at$|_date$/.test(key);
}

export function ModulePage({
  table, tenantId, title, desc, columns, formFields, icon: Icon, pdfAction,
}: {
  table: string; tenantId: string; title: string; desc?: string;
  columns: ColumnDef[]; formFields: FieldDef[]; icon: typeof Plus;
  pdfAction?: (row: any) => void;
}) {
  const { t } = useI18n();
  const { session } = useAuth();
  const searchableColumns = columns.flatMap((c) => c.searchKeys ?? [c.key]).filter(isSearchableColumn);
  const crud = usePaginatedCrud<Row>(table, tenantId, searchableColumns);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  const uploadFile = async (fieldKey: string, file: File) => {
    const MAX_SIZE = 20 * 1024 * 1024;
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (file.size > MAX_SIZE) { setUploadErr(t('upload.too_large')); return; }
    if (!ALLOWED_TYPES.includes(file.type)) { setUploadErr(t('upload.bad_type')); return; }
    setUploading(fieldKey); setUploadErr(null);
    const path = `${tenantId}/${table}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from('clinical-attachments').upload(path, file, { upsert: false });
    if (error) { setUploadErr(error.message); setUploading(null); return; }
    setForm((f) => ({ ...f, [fieldKey]: path }));
    setUploading(null);
  };

  const filtered = crud.rows;

  const openAdd = () => {
    setEditing(null);
    setForm({});
    setErr(null);
    setModalOpen(true);
  };
  const openEdit = (row: Row) => {
    setEditing(row);
    setForm({ ...row });
    setErr(null);
    setModalOpen(true);
  };

  const submit = async () => {
    setSaving(true); setErr(null);
    for (const f of formFields) {
      if (f.required && !form[f.key]) { setErr(t('onb.err.required')); setSaving(false); return; }
    }
    const payload: Record<string, unknown> = {};
    for (const f of formFields) {
      if (form[f.key] !== undefined && form[f.key] !== '') payload[f.key] = form[f.key];
    }
    const res = editing ? await crud.update(editing.id, payload) : await crud.insert(payload);
    if (res.error) setErr(res.error);
    else {
      setModalOpen(false);
      // Notify connected integrations for the events tenants can actually
      // subscribe to from Settings > Integrations (see EVENT_OPTIONS there).
      if (table === 'patients' && !editing) {
        notifyIntegrations(session?.access_token, tenantId, 'patient.created', t('notify.patient_created'),
          [String(payload.first_name ?? '')].concat(payload.last_name ? [String(payload.last_name)] : []));
      } else if (table === 'appointments' && !editing) {
        notifyIntegrations(session?.access_token, tenantId, 'appointment.created', t('notify.appointment_created'),
          payload.scheduled_at ? [String(payload.scheduled_at)] : []);
      }
      // Note: invoices are no longer marked 'paid' through this generic
      // form -- see src/pages/CashDesk.tsx, which is the only place
      // that can actually change an invoice to 'paid' (a database
      // trigger enforces this), and fires the 'invoice.paid'
      // notification itself once a payment is actually recorded.
    }
    setSaving(false);
  };

  const confirmDelete = async () => {
    if (!delId) return;
    await crud.remove(delId);
    setDelId(null);
  };

  const renderCell = (col: ColumnDef, row: Row) => {
    if (col.render) return col.render(row);
    const val = row[col.key];
    if (col.key === 'status' && typeof val === 'string') return <Badge color="gray">{val.replace(/_/g, ' ')}</Badge>;
    return <span className="text-sm text-gray-700">{val === null || val === undefined ? '—' : String(val)}</span>;
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center"><Icon size={22} className="text-blue-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            {desc && <p className="text-sm text-gray-500 mt-0.5">{desc}</p>}
          </div>
        </div>
        <Button onClick={openAdd}><Plus size={16} /> {t('common.add')}</Button>
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="relative max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={crud.search} onChange={(e) => crud.setSearch(e.target.value)} placeholder={t('common.search')} className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        {crud.loading ? (
          <div className="p-8 text-center text-sm text-gray-400">{t('common.loading')}</div>
        ) : crud.error ? (
          <div className="p-8 flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center"><AlertTriangle size={22} className="text-red-500" /></div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{t('common.load_failed')}</p>
              <p className="text-xs text-gray-500 mt-1 max-w-md">{crud.error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => crud.load()}><RefreshCw size={14} /> {t('common.retry')}</Button>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Inbox} title={t('common.none')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {columns.map((c) => <th key={c.key} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{c.label}</th>)}
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                    {columns.map((c) => <td key={c.key} className="px-4 py-3">{renderCell(c, row)}</td>)}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {pdfAction && (
                          <button onClick={() => pdfAction(row)} title={t('common.pdf')} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><FileDown size={16} /></button>
                        )}
                        <button onClick={() => openEdit(row)} title={t('common.edit')} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Pencil size={16} /></button>
                        <button onClick={() => setDelId(row.id)} title={t('common.delete')} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!crud.loading && !crud.error && crud.totalCount > crud.pageSize && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
            <span>{crud.page * crud.pageSize + 1}–{Math.min((crud.page + 1) * crud.pageSize, crud.totalCount)} / {crud.totalCount}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => crud.setPage(crud.page - 1)} disabled={!crud.hasPrevPage} className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50"><ChevronLeft size={16} /></button>
              <button onClick={() => crud.setPage(crud.page + 1)} disabled={!crud.hasNextPage} className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('common.edit') : t('common.add')} footer={
        <>
          <Button variant="outline" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={submit} loading={saving}>{t('common.save')}</Button>
        </>
      }>
        <div className="space-y-4">
          {formFields.map((f) => {
            const val = form[f.key] as string ?? '';
            if (f.type === 'textarea') return <textarea key={f.key} placeholder={f.placeholder ?? f.label} value={val} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={3} />;
            if (f.type === 'file') return (
              <label key={f.key} className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1.5">{f.label}{f.required && <span className="text-red-500"> *</span>}</span>
                <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => e.target.files?.[0] && uploadFile(f.key, e.target.files[0])}
                  className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:bg-blue-50 file:text-blue-700 file:text-sm file:font-medium hover:file:bg-blue-100" />
                {uploading === f.key && <p className="text-xs text-blue-500 mt-1">{t('common.loading')}</p>}
                {!!val && uploading !== f.key && <p className="text-xs text-emerald-600 mt-1">✓ {val.split('/').pop()}</p>}
              </label>
            );
            if (f.type === 'datalist') return (
              <label key={f.key} className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1.5">{f.label}{f.required && <span className="text-red-500"> *</span>}</span>
                <input list={`${f.key}-list`} value={val} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} placeholder={f.placeholder}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <datalist id={`${f.key}-list`}>
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </datalist>
              </label>
            );
            if (f.type === 'select') return (
              <label key={f.key} className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1.5">{f.label}{f.required && <span className="text-red-500"> *</span>}</span>
                <select value={val} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">...</option>
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            );
            return <Input key={f.key} label={f.label} required={f.required} type={f.type ?? 'text'} value={val} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />;
          })}
          {err && <p className="text-sm text-red-600">{err}</p>}
          {uploadErr && <p className="text-sm text-red-600">{uploadErr}</p>}
        </div>
      </Modal>

      <Modal open={!!delId} onClose={() => setDelId(null)} title={t('common.confirm.delete')} footer={
        <>
          <Button variant="outline" onClick={() => setDelId(null)}>{t('common.cancel')}</Button>
          <Button variant="danger" onClick={confirmDelete}>{t('common.delete')}</Button>
        </>
      }>
        <p className="text-sm text-gray-600">{t('common.confirm.delete')}</p>
      </Modal>
    </div>
  );
}
