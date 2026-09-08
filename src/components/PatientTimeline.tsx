import { useEffect, useState } from 'react';
import { Activity, FileText, ClipboardList, FlaskConical, ScanLine, Pill } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { supabase, type MedicalRecord, type LabOrder, type RadiologyOrder, type Prescription } from '../lib/supabase';
import { Modal, Badge } from './ui';

type Consultation = {
  id: string; patient_id: string; doctor_id: string | null; consult_date: string;
  subjective: string | null; objective: string | null; assessment: string | null; plan: string | null;
};

type TimelineEntry = {
  id: string; date: string;
  kind: 'record' | 'consultation' | 'lab' | 'radiology' | 'prescription';
  title: string; detail: string; status?: string;
};

// Pulls medical_records, consultations, lab_orders, radiology_orders and
// prescriptions for one patient and merges them into a single
// chronological feed. This is the real fix for the "lab results live in
// one module, the doctor's notes live in another, nothing connects
// them" gap: instead of a doctor checking 3-5 separate module tabs to
// piece together one patient's story, it's one read-only view. RLS
// still applies per table -- a module the tenant hasn't enabled simply
// contributes nothing to the merged feed, no special-casing needed here.
async function loadTimeline(tenantId: string, patientId: string): Promise<TimelineEntry[]> {
  const [records, consultations, labs, radiology, prescriptions] = await Promise.all([
    supabase.from('medical_records').select('*').eq('tenant_id', tenantId).eq('patient_id', patientId).order('record_date', { ascending: false }),
    supabase.from('consultations').select('*').eq('tenant_id', tenantId).eq('patient_id', patientId).order('consult_date', { ascending: false }),
    supabase.from('lab_orders').select('*').eq('tenant_id', tenantId).eq('patient_id', patientId).order('ordered_at', { ascending: false }),
    supabase.from('radiology_orders').select('*').eq('tenant_id', tenantId).eq('patient_id', patientId).order('ordered_at', { ascending: false }),
    supabase.from('prescriptions').select('*').eq('tenant_id', tenantId).eq('patient_id', patientId).order('created_at', { ascending: false }),
  ]);

  const entries: TimelineEntry[] = [];
  for (const r of (records.data as MedicalRecord[] | null) ?? []) {
    entries.push({ id: `record-${r.id}`, date: r.record_date, kind: 'record', title: r.diagnosis || r.chief_complaint || '—', detail: [r.icd10_code, r.chief_complaint].filter(Boolean).join(' · ') });
  }
  for (const c of (consultations.data as Consultation[] | null) ?? []) {
    entries.push({ id: `consult-${c.id}`, date: c.consult_date, kind: 'consultation', title: c.assessment || '—', detail: c.plan || '' });
  }
  for (const l of (labs.data as LabOrder[] | null) ?? []) {
    entries.push({ id: `lab-${l.id}`, date: l.ordered_at, kind: 'lab', title: l.test_name, detail: l.result || '', status: l.status });
  }
  for (const rd of (radiology.data as RadiologyOrder[] | null) ?? []) {
    entries.push({ id: `rad-${rd.id}`, date: rd.ordered_at, kind: 'radiology', title: `${rd.modality} — ${rd.body_part}`, detail: rd.report || '', status: rd.status });
  }
  for (const p of (prescriptions.data as Prescription[] | null) ?? []) {
    entries.push({ id: `rx-${p.id}`, date: p.created_at, kind: 'prescription', title: p.medication, detail: [p.dosage, p.frequency].filter(Boolean).join(' · '), status: p.status });
  }

  return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

const KIND_ICON = { record: FileText, consultation: ClipboardList, lab: FlaskConical, radiology: ScanLine, prescription: Pill };
const KIND_ICON_CLASSES: Record<TimelineEntry['kind'], { bg: string; text: string }> = {
  record: { bg: 'bg-blue-50', text: 'text-blue-600' },
  consultation: { bg: 'bg-purple-50', text: 'text-purple-600' },
  lab: { bg: 'bg-amber-50', text: 'text-amber-600' },
  radiology: { bg: 'bg-green-50', text: 'text-green-600' },
  prescription: { bg: 'bg-gray-100', text: 'text-gray-600' },
};

export function PatientTimelineModal({ tenantId, patientId, patientName, onClose }: {
  tenantId: string; patientId: string; patientName: string; onClose: () => void;
}) {
  const { t } = useI18n();
  const [entries, setEntries] = useState<TimelineEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadTimeline(tenantId, patientId).then((data) => { if (!cancelled) setEntries(data); });
    return () => { cancelled = true; };
  }, [tenantId, patientId]);

  return (
    <Modal open onClose={onClose} title={`${t('timeline.title')} — ${patientName}`}>
      {entries === null ? (
        <p className="text-sm text-gray-400 py-4">{t('common.loading')}</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-gray-400 py-4">{t('timeline.empty')}</p>
      ) : (
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {entries.map((e) => {
            const Icon = KIND_ICON[e.kind];
            return (
              <div key={e.id} className="flex gap-3">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${KIND_ICON_CLASSES[e.kind].bg}`}>
                    <Icon size={15} className={KIND_ICON_CLASSES[e.kind].text} />
                  </div>
                </div>
                <div className="flex-1 min-w-0 pb-3 border-b border-gray-50">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t(`timeline.kind.${e.kind}`)}</span>
                    <span className="text-xs text-gray-400">{new Date(e.date).toLocaleDateString()}</span>
                    {e.status && <Badge color={e.status === 'validated' || e.status === 'dispensed' || e.status === 'active' ? 'green' : e.status === 'cancelled' ? 'gray' : 'amber'}>{e.status}</Badge>}
                  </div>
                  <p className="text-sm font-medium text-gray-900 mt-0.5">{e.title}</p>
                  {e.detail && <p className="text-sm text-gray-500 mt-0.5">{e.detail}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

export const TimelineIcon = Activity;
