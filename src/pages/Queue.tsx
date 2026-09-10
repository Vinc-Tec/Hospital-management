import { useEffect, useMemo, useState } from 'react';
import { ListChecks, UserPlus, Clock, PlayCircle, CheckCircle2, XCircle, AlertTriangle, Search } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { supabase, type PatientQueueEntry, type Patient, type Doctor } from '../lib/supabase';
import { useCrud } from '../lib/useCrud';
import { Card, Button, Input, Select, Modal, Badge, EmptyState } from '../components/ui';

// Fire-and-forget: same helper contract as ModulePage.tsx's
// notifyIntegrations (patient.created, invoice.paid, ...) -- duplicated
// locally rather than imported since ModulePage doesn't export it.
function notifyIntegrations(accessToken: string | undefined, tenantId: string, event: string, title: string, lines: string[]) {
  if (!accessToken) return;
  fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dispatch-integration-event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ tenant_id: tenantId, event, title, lines }),
  }).catch(() => {});
}

function timeAgo(iso: string, lang: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return lang === 'fr' ? "à l'instant" : 'just now';
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  return `${hrs} ${lang === 'fr' ? (hrs > 1 ? 'heures' : 'heure') : (hrs > 1 ? 'hours' : 'hour')}`;
}

export function QueueModule({ tenantId }: { tenantId: string }) {
  const { t, lang } = useI18n();
  const { session, user } = useAuth();
  const [entries, setEntries] = useState<PatientQueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [doctorFilter, setDoctorFilter] = useState<string>('all');
  const [, forceTick] = useState(0);

  const patients = useCrud<Patient>('patients', tenantId);
  const doctors = useCrud<Doctor>('doctors', tenantId);
  const patientMap = useMemo(() => new Map(patients.rows.map((p) => [p.id, p])), [patients.rows]);
  const doctorMap = useMemo(() => new Map(doctors.rows.map((d) => [d.id, d])), [doctors.rows]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('patient_queue').select('*')
      .eq('tenant_id', tenantId).in('status', ['waiting', 'in_consultation'])
      .order('priority', { ascending: true }).order('checked_in_at', { ascending: true });
    setEntries((data as PatientQueueEntry[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tenantId]);

  // Live handoff: reception checks a patient in, every screen with this
  // module open (doctor dashboards included) sees it appear/move within
  // ~1s with no manual refresh, via Postgres change events over the
  // `patient_queue` table (enabled in
  // 20260908110000_patient_queue_realtime_module.sql). This is the whole
  // point of the module: it directly fixes the "cashier registers a
  // patient but the doctor's dashboard doesn't show it" gap.
  useEffect(() => {
    const channel = supabase.channel(`patient_queue:${tenantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patient_queue', filter: `tenant_id=eq.${tenantId}` }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId]);

  // Re-render every 30s so the "waiting Xmin" labels stay live without a reload.
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const visible = doctorFilter === 'all' ? entries
    : doctorFilter === 'unassigned' ? entries.filter((e) => !e.doctor_id)
    : entries.filter((e) => e.doctor_id === doctorFilter);
  const waiting = visible.filter((e) => e.status === 'waiting');
  const inConsultation = visible.filter((e) => e.status === 'in_consultation');

  const startConsultation = async (entry: PatientQueueEntry) => {
    await supabase.from('patient_queue').update({ status: 'in_consultation', called_at: new Date().toISOString() }).eq('id', entry.id);
    load();
  };
  const completeConsultation = async (entry: PatientQueueEntry) => {
    await supabase.from('patient_queue').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', entry.id);
    load();
  };
  const cancelEntry = async (entry: PatientQueueEntry) => {
    await supabase.from('patient_queue').update({ status: 'cancelled' }).eq('id', entry.id);
    load();
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center"><ListChecks size={22} className="text-blue-600" /></div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{t('mod.queue.title')}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{t('mod.queue.desc')}</p>
          </div>
        </div>
        <Button onClick={() => setCheckinOpen(true)}><UserPlus size={16} /> {t('queue.checkin')}</Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="w-56">
          <Select value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)}
            options={[{ value: 'all', label: t('queue.filter_all') }, { value: 'unassigned', label: t('queue.filter_unassigned') },
              ...doctors.rows.map((d) => ({ value: d.id, label: `${d.first_name} ${d.last_name}` }))]} />
        </div>
        <Badge color="blue">{t('queue.waiting')}: {waiting.length}</Badge>
        <Badge color="amber">{t('queue.section_in_progress')}: {inConsultation.length}</Badge>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-gray-400">{t('common.loading')}</div>
      ) : visible.length === 0 ? (
        <Card><EmptyState icon={ListChecks} title={t('queue.empty')} desc={t('queue.empty_desc')} /></Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5"><Clock size={14} /> {t('queue.section_waiting')}</h2>
            <div className="space-y-2.5">
              {waiting.length === 0 && <p className="text-sm text-gray-400 px-1">{t('queue.none_waiting')}</p>}
              {waiting.map((e) => {
                const p = patientMap.get(e.patient_id);
                const d = e.doctor_id ? doctorMap.get(e.doctor_id) : null;
                return (
                  <Card key={e.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">{p ? `${p.first_name} ${p.last_name}` : '—'}</p>
                        {e.priority === 'urgent' && <Badge color="red"><AlertTriangle size={11} className="inline -mt-0.5 mr-0.5" />{t('queue.urgent')}</Badge>}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {d ? `${t('queue.for')} Dr. ${d.first_name} ${d.last_name}` : t('queue.any_doctor')}
                        {e.reason ? ` · ${e.reason}` : ''} · {timeAgo(e.checked_in_at, lang)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button size="sm" onClick={() => startConsultation(e)}><PlayCircle size={14} /> {t('queue.start')}</Button>
                      <button onClick={() => cancelEntry(e)} title={t('common.cancel')} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><XCircle size={16} /></button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5"><PlayCircle size={14} /> {t('queue.section_in_progress')}</h2>
            <div className="space-y-2.5">
              {inConsultation.length === 0 && <p className="text-sm text-gray-400 px-1">{t('queue.none_in_progress')}</p>}
              {inConsultation.map((e) => {
                const p = patientMap.get(e.patient_id);
                const d = e.doctor_id ? doctorMap.get(e.doctor_id) : null;
                return (
                  <Card key={e.id} className="p-4 flex items-center justify-between gap-3 border-amber-200">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{p ? `${p.first_name} ${p.last_name}` : '—'}</p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {d ? `Dr. ${d.first_name} ${d.last_name}` : t('queue.any_doctor')} · {e.called_at ? timeAgo(e.called_at, lang) : ''}
                      </p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => completeConsultation(e)}><CheckCircle2 size={14} /> {t('queue.complete')}</Button>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {checkinOpen && (
        <CheckinModal
          tenantId={tenantId}
          patients={patients.rows}
          doctors={doctors.rows}
          onClose={() => setCheckinOpen(false)}
          onDone={(patientName) => {
            setCheckinOpen(false);
            load();
            notifyIntegrations(session?.access_token, tenantId, 'patient.checked_in', t('notify.patient_checked_in'), [patientName]);
          }}
          createdBy={user?.id ?? null}
        />
      )}
    </div>
  );
}

function CheckinModal({ tenantId, patients, doctors, onClose, onDone, createdBy }: {
  tenantId: string; patients: Patient[]; doctors: Doctor[];
  onClose: () => void; onDone: (patientName: string) => void; createdBy: string | null;
}) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [patientId, setPatientId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const filtered = search.trim()
    ? patients.filter((p) => {
        const q = search.trim().toLowerCase();
        return `${p.first_name} ${p.last_name}`.toLowerCase().includes(q)
          || (p.national_id ?? '').toLowerCase().includes(q)
          || (p.phone ?? '').toLowerCase().includes(q);
      }).slice(0, 8)
    : patients.slice(0, 8);
  const selected = patients.find((p) => p.id === patientId) ?? null;

  const submit = async () => {
    if (!patientId) { setErr(t('onb.err.required')); return; }
    setSaving(true); setErr(null);
    const { error } = await supabase.from('patient_queue').insert({
      tenant_id: tenantId, patient_id: patientId, doctor_id: doctorId || null,
      priority, reason: reason.trim() || null, created_by: createdBy,
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onDone(selected ? `${selected.first_name} ${selected.last_name}` : '');
  };

  return (
    <Modal open onClose={onClose} title={t('queue.checkin')} footer={
      <><Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button><Button onClick={submit} loading={saving}>{t('queue.checkin_confirm')}</Button></>
    }>
      <div className="space-y-4">
        <div>
          <span className="block text-sm font-medium text-gray-700 mb-1.5">{t('col.patient')} <span className="text-red-500">*</span></span>
          {selected ? (
            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-blue-200 bg-blue-50">
              <span className="text-sm font-medium text-gray-900">{selected.first_name} {selected.last_name}</span>
              <button onClick={() => { setPatientId(''); setSearch(''); }} className="text-xs text-blue-600 hover:underline">{t('common.cancel')}</button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('queue.search_placeholder')}
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {filtered.length > 0 && (
                <div className="mt-1.5 border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100 max-h-44 overflow-y-auto">
                  {filtered.map((p) => (
                    <button key={p.id} onClick={() => setPatientId(p.id)} className="w-full text-left px-3.5 py-2 text-sm hover:bg-gray-50">
                      {p.first_name} {p.last_name}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <Select label={t('queue.assign_doctor')} value={doctorId} onChange={(e) => setDoctorId(e.target.value)}
          placeholder={t('queue.any_doctor')} options={doctors.map((d) => ({ value: d.id, label: `${d.first_name} ${d.last_name}` }))} />

        <div>
          <span className="block text-sm font-medium text-gray-700 mb-1.5">{t('queue.priority')}</span>
          <div className="grid grid-cols-2 gap-2">
            {(['normal', 'urgent'] as const).map((pr) => (
              <button key={pr} type="button" onClick={() => setPriority(pr)}
                className={`py-2.5 rounded-xl border text-sm font-medium transition-colors ${priority === pr ? (pr === 'urgent' ? 'border-red-500 bg-red-50 text-red-700' : 'border-blue-500 bg-blue-50 text-blue-700') : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                {t(`queue.${pr}`)}
              </button>
            ))}
          </div>
        </div>

        <Input label={t('queue.reason')} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('fld.chief_complaint')} />

        {err && <p className="text-sm text-red-600">{err}</p>}
      </div>
    </Modal>
  );
}
