import { useEffect, useState } from 'react';
import { Wallet, Banknote, CreditCard, Smartphone, Building2, ShieldCheck, MoreHorizontal, CheckCircle2 } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { supabase, type Invoice } from '../lib/supabase';
import { Card, Button, Input, Modal, Badge } from '../components/ui';

type PatientLite = { id: string; first_name: string; last_name: string };
type PaymentMethod = 'cash' | 'card' | 'mobile_money' | 'bank_transfer' | 'insurance' | 'other';

const METHOD_ICONS: Record<PaymentMethod, typeof Wallet> = {
  cash: Banknote, card: CreditCard, mobile_money: Smartphone, bank_transfer: Building2, insurance: ShieldCheck, other: MoreHorizontal,
};

// Fire-and-forget: same helper contract as ModulePage.tsx's
// notifyIntegrations, duplicated locally rather than imported since
// ModulePage doesn't export it and this is the only other call site.
function notifyIntegrations(accessToken: string | undefined, tenantId: string, event: string, title: string, lines: string[]) {
  if (!accessToken) return;
  fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dispatch-integration-event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ tenant_id: tenantId, event, title, lines }),
  }).catch(() => {});
}

export function CashDeskModule({ tenantId }: { tenantId: string }) {
  const { t, lang } = useI18n();
  const { session, profile } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [collected, setCollected] = useState<Record<string, number>>({});
  const [patients, setPatients] = useState<Record<string, PatientLite>>({});
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState<Invoice | null>(null);
  const [todayTotals, setTodayTotals] = useState<{ method: PaymentMethod; total: number }[]>([]);
  const [todayGrandTotal, setTodayGrandTotal] = useState(0);

  const load = async () => {
    setLoading(true);
    const { data: invs } = await supabase.from('invoices').select('*').eq('tenant_id', tenantId).in('status', ['unpaid', 'partial']).order('issue_date', { ascending: false });
    setInvoices((invs as Invoice[]) ?? []);

    const ids = (invs ?? []).map((i) => i.id);
    if (ids.length > 0) {
      const { data: pays } = await supabase.from('patient_payments').select('invoice_id, amount').in('invoice_id', ids);
      const sums: Record<string, number> = {};
      for (const p of pays ?? []) sums[p.invoice_id as string] = (sums[p.invoice_id as string] ?? 0) + Number(p.amount);
      setCollected(sums);
    } else {
      setCollected({});
    }

    const patientIds = Array.from(new Set((invs ?? []).map((i) => i.patient_id).filter(Boolean))) as string[];
    if (patientIds.length > 0) {
      const { data: pts } = await supabase.from('patients').select('id, first_name, last_name').in('id', patientIds);
      const map: Record<string, PatientLite> = {};
      for (const p of pts ?? []) map[p.id as string] = p as PatientLite;
      setPatients(map);
    }

    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const { data: todays } = await supabase.from('patient_payments').select('amount, method').eq('tenant_id', tenantId).gte('created_at', startOfDay.toISOString());
    const byMethod = new Map<PaymentMethod, number>();
    let grand = 0;
    for (const row of todays ?? []) {
      const m = row.method as PaymentMethod;
      byMethod.set(m, (byMethod.get(m) ?? 0) + Number(row.amount));
      grand += Number(row.amount);
    }
    setTodayTotals(Array.from(byMethod.entries()).map(([method, total]) => ({ method, total })));
    setTodayGrandTotal(grand);

    setLoading(false);
  };

  useEffect(() => { load(); }, [tenantId]);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Wallet size={24} className="text-blue-600" /> {t('mod.cashdesk.title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('mod.cashdesk.desc')}</p>
      </div>

      {/* Today's takings -- the real cashier summary, grouped by method */}
      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-gray-900">{t('cashdesk.today_summary')}</p>
          <p className="text-lg font-bold text-emerald-600">${todayGrandTotal.toFixed(2)}</p>
        </div>
        {todayTotals.length === 0 ? (
          <p className="text-sm text-gray-400">{t('cashdesk.no_payments_today')}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {todayTotals.map(({ method, total }) => {
              const Icon = METHOD_ICONS[method];
              return (
                <div key={method} className="rounded-xl border border-gray-100 p-3 text-center">
                  <Icon size={16} className="mx-auto text-gray-400 mb-1" />
                  <p className="text-xs text-gray-500">{t(`cashdesk.method.${method}`)}</p>
                  <p className="text-sm font-bold text-gray-900">${total.toFixed(2)}</p>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Outstanding invoices -- the actual "encaisser" queue */}
      <Card className="overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-900">{t('cashdesk.outstanding')}</p>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">{t('common.loading')}</div>
        ) : invoices.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">{t('cashdesk.all_settled')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('col.invoice_no')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('col.patient')}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{t('col.total')}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{t('cashdesk.balance_due')}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {invoices.map((inv) => {
                  const paid = collected[inv.id] ?? 0;
                  const balance = Number(inv.total) - paid;
                  const pt = inv.patient_id ? patients[inv.patient_id] : null;
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{inv.invoice_number}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{pt ? `${pt.first_name} ${pt.last_name}` : '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">${Number(inv.total).toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-right"><Badge color={inv.status === 'partial' ? 'amber' : 'gray'}>${balance.toFixed(2)}</Badge></td>
                      <td className="px-4 py-3 text-right"><Button size="sm" onClick={() => setCollecting(inv)}>{t('cashdesk.collect')}</Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {collecting && (
        <CollectPaymentModal
          invoice={collecting}
          balanceDue={Number(collecting.total) - (collected[collecting.id] ?? 0)}
          patientName={collecting.patient_id && patients[collecting.patient_id] ? `${patients[collecting.patient_id].first_name} ${patients[collecting.patient_id].last_name}` : null}
          onClose={() => setCollecting(null)}
          onDone={async (newlyPaidInFull) => {
            setCollecting(null);
            await load();
            if (newlyPaidInFull) {
              notifyIntegrations(session?.access_token, tenantId, 'invoice.paid', t('notify.invoice_paid'), [collecting.invoice_number]);
            }
          }}
          tenantId={tenantId}
          receivedByName={profile?.full_name ?? null}
          lang={lang}
        />
      )}
    </div>
  );
}

function CollectPaymentModal({ invoice, balanceDue, patientName, onClose, onDone, tenantId, receivedByName }: {
  invoice: Invoice; balanceDue: number; patientName: string | null; onClose: () => void;
  onDone: (newlyPaidInFull: boolean) => void; tenantId: string; receivedByName: string | null; lang: 'fr' | 'en';
}) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [amount, setAmount] = useState(balanceDue.toFixed(2));
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [tendered, setTendered] = useState('');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const amountNum = Number(amount) || 0;
  const tenderedNum = Number(tendered) || 0;
  const change = method === 'cash' && tenderedNum > amountNum ? tenderedNum - amountNum : 0;

  const submit = async () => {
    setErr(null);
    if (amountNum <= 0) { setErr(t('cashdesk.err.amount')); return; }
    if (amountNum > balanceDue + 0.01) { setErr(t('cashdesk.err.exceeds')); return; }
    if (method === 'cash' && tenderedNum > 0 && tenderedNum < amountNum) { setErr(t('cashdesk.err.tendered')); return; }

    setSaving(true);
    const { error } = await supabase.from('patient_payments').insert({
      tenant_id: tenantId,
      invoice_id: invoice.id,
      amount: amountNum,
      method,
      amount_tendered: method === 'cash' && tenderedNum > 0 ? tenderedNum : null,
      change_given: method === 'cash' && change > 0 ? change : null,
      reference: reference || null,
      received_by: user?.id ?? null,
      received_by_name: receivedByName,
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setDone(true);
    setTimeout(() => onDone(amountNum >= balanceDue - 0.01), 900);
  };

  return (
    <Modal open onClose={onClose} title={t('cashdesk.collect')} footer={done ? null : <><Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button><Button onClick={submit} loading={saving}>{t('cashdesk.confirm_collect')}</Button></>}>
      {done ? (
        <div className="text-center py-6">
          <CheckCircle2 size={40} className="mx-auto text-emerald-500 mb-3" />
          <p className="text-sm font-semibold text-gray-900">{t('cashdesk.collected_success')}</p>
          {change > 0 && <p className="text-sm text-gray-500 mt-1">{t('cashdesk.change_due')}: <span className="font-bold text-gray-900">${change.toFixed(2)}</span></p>}
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">{invoice.invoice_number}{patientName ? ` — ${patientName}` : ''}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t('cashdesk.balance_due')}: <span className="font-semibold text-gray-700">${balanceDue.toFixed(2)}</span></p>
          </div>

          <Input label={t('cashdesk.amount')} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />

          <div>
            <span className="block text-sm font-medium text-gray-700 mb-1.5">{t('cashdesk.method')}</span>
            <div className="grid grid-cols-3 gap-2">
              {(['cash', 'card', 'mobile_money', 'bank_transfer', 'insurance', 'other'] as PaymentMethod[]).map((m) => {
                const Icon = METHOD_ICONS[m];
                return (
                  <button key={m} type="button" onClick={() => setMethod(m)}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-colors ${method === m ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                    <Icon size={16} />
                    {t(`cashdesk.method.${m}`)}
                  </button>
                );
              })}
            </div>
          </div>

          {method === 'cash' ? (
            <div>
              <Input label={t('cashdesk.tendered')} type="number" value={tendered} onChange={(e) => setTendered(e.target.value)} placeholder={amount} />
              {change > 0 && <p className="text-xs text-emerald-600 mt-1.5">{t('cashdesk.change_due')}: <span className="font-bold">${change.toFixed(2)}</span></p>}
            </div>
          ) : (
            <Input label={t('cashdesk.reference')} value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t('cashdesk.reference_placeholder')} />
          )}

          {err && <p className="text-sm text-red-600">{err}</p>}
        </div>
      )}
    </Modal>
  );
}
