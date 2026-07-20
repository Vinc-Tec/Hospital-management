import { type ReactNode, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search, FileDown, Inbox } from 'lucide-react';
import { Button, Card, Input, Modal, EmptyState, Badge } from './ui';
import { useCrud } from '../lib/useCrud';
import { useI18n } from '../lib/i18n';

export type FieldDef = {
  key: string; label: string; type?: 'text' | 'number' | 'date' | 'textarea' | 'select' | 'datetime-local';
  required?: boolean; options?: { value: string; label: string }[]; placeholder?: string;
};

export type ColumnDef = {
  key: string; label: string; render?: (row: any) => ReactNode;
};

type Row = { id: string; [k: string]: unknown };

export function ModulePage({
  table, tenantId, title, desc, columns, formFields, icon: Icon, pdfAction,
}: {
  table: string; tenantId: string; title: string; desc?: string;
  columns: ColumnDef[]; formFields: FieldDef[]; icon: typeof Plus;
  pdfAction?: (row: any) => void;
}) {
  const { t } = useI18n();
  const crud = useCrud<Row>(table, tenantId);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [delId, setDelId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search) return crud.rows;
    const q = search.toLowerCase();
    return crud.rows.filter((r) => columns.some((c) => String(r[c.key] ?? '').toLowerCase().includes(q)));
  }, [crud.rows, search, columns]);

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
    else setModalOpen(false);
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
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('common.search')} className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        {crud.loading ? (
          <div className="p-8 text-center text-sm text-gray-400">{t('common.loading')}</div>
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
        {crud.error && <div className="p-4 text-sm text-red-600 bg-red-50">{crud.error}</div>}
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
