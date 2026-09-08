import { useState, useEffect, useMemo } from 'react';
import {
  Users, Users2, CalendarDays, Stethoscope, FileText, ClipboardList, Pill, FlaskConical, ScanLine,
  BedDouble, Receipt, UserCog, ShieldCheck, LogIn, FileBarChart, Pencil, Trash2, AlertTriangle, RefreshCw, PackageCheck, ListChecks,
} from 'lucide-react';
import { ModulePage, type ColumnDef, type FieldDef } from '../components/ModulePage';
import { useCrud } from '../lib/useCrud';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { Badge, Card, Button, Input, Modal, EmptyState } from '../components/ui';
import {
  generateInvoicePDF, generatePrescriptionPDF, generateLabReportPDF, generateRadiologyReportPDF, generateMedicalRecordPDF, generateGenericReportPDF,
} from '../lib/pdf';
import { supabase, type Patient, type Doctor, type Invoice, type InvoiceItem, type Prescription, type LabOrder, type RadiologyOrder, type MedicalRecord, type Role, type PharmacyItem, type Bed } from '../lib/supabase';
import { formatTenantCurrency } from '../lib/currency';
import { PatientTimelineModal, TimelineIcon } from '../components/PatientTimeline';
import { FileDown, MessageCircle, Plus, TrendingUp } from 'lucide-react';

function usePatientDoctorMaps(tenantId: string) {
  const patients = useCrud<Patient>('patients', tenantId);
  const doctors = useCrud<Doctor>('doctors', tenantId);
  const pMap = new Map(patients.rows.map((p) => [p.id, p]));
  const dMap = new Map(doctors.rows.map((d) => [d.id, d]));
  return { pMap, dMap };
}

// Reusable "search by patient name" for every module that references a
// patient by id but doesn't store their name as a real, searchable
// column itself (appointments, records, consultations, prescriptions,
// lab, radiology, admissions, invoices, and more) -- resolves the typed
// name to matching patient ids client-side against the map ModulePage
// already has loaded, then passes those ids to ModulePage's
// extraFilter so the actual row list is still fetched server-side.
function usePatientSearch(pMap: Map<string, Patient>) {
  const { t } = useI18n();
  const [patientSearch, setPatientSearch] = useState('');
  const matchingIds = patientSearch.trim()
    ? Array.from(pMap.values())
        .filter((p) => `${p.first_name} ${p.last_name}`.toLowerCase().includes(patientSearch.trim().toLowerCase()) || (p.national_id ?? '').toLowerCase().includes(patientSearch.trim().toLowerCase()))
        .map((p) => p.id)
    : null;
  const extraFilter = matchingIds ? { column: 'patient_id', in: matchingIds } : null;
  const searchBox = (
    <div className="relative max-w-xs w-full">
      <Users2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} placeholder={t('invoices.search_patient')} className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  );
  return { extraFilter, searchBox };
}

const statusOpts = (keys: string[], t: (k: string) => string) =>
  keys.map((k) => ({ value: k, label: t(`opt.${k}`) }));

export function PatientsModule({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const [timelineFor, setTimelineFor] = useState<{ id: string; name: string } | null>(null);
  const cols: ColumnDef[] = [
    { key: 'first_name', label: t('col.name'), searchKeys: ['first_name', 'last_name', 'national_id'], render: (r) => <span className="text-sm font-medium text-gray-900">{String(r.first_name ?? '')} {String(r.last_name ?? '')}</span> },
    { key: 'national_id', label: t('col.national_id') },
    { key: 'gender', label: t('col.gender') },
    { key: 'phone', label: t('col.phone') },
    { key: 'email', label: t('col.email') },
    { key: 'blood_group', label: t('col.blood') },
  ];
  const fields: FieldDef[] = [
    { key: 'first_name', label: t('fld.firstname'), required: true },
    { key: 'last_name', label: t('fld.lastname'), required: true },
    { key: 'national_id', label: t('fld.national_id'), placeholder: t('fld.national_id_placeholder') },
    { key: 'date_of_birth', label: t('fld.dob'), type: 'date' },
    { key: 'gender', label: t('fld.gender'), type: 'select', options: statusOpts(['male', 'female', 'other'], t) },
    { key: 'phone', label: t('col.phone') },
    { key: 'email', label: t('col.email'), type: 'text' },
    { key: 'blood_group', label: t('fld.blood_group'), type: 'select', options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((v) => ({ value: v, label: v })) },
    { key: 'allergies', label: t('fld.allergies'), type: 'textarea' },
  ];
  return (
    <>
      <ModulePage table="patients" tenantId={tenantId} title={t('mod.patients.title')} desc={t('mod.patients.desc')} icon={Users} columns={cols} formFields={fields}
        rowActions={(row) => (
          <button onClick={() => setTimelineFor({ id: row.id, name: `${String(row.first_name ?? '')} ${String(row.last_name ?? '')}`.trim() })}
            title={t('timeline.title')} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><TimelineIcon size={16} /></button>
        )} />
      {timelineFor && (
        <PatientTimelineModal tenantId={tenantId} patientId={timelineFor.id} patientName={timelineFor.name} onClose={() => setTimelineFor(null)} />
      )}
    </>
  );
}

export function DoctorsModule({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const cols: ColumnDef[] = [
    { key: 'first_name', label: t('col.name'), searchKeys: ['first_name', 'last_name'], render: (r) => <span className="text-sm font-medium text-gray-900">{String(r.first_name ?? '')} {String(r.last_name ?? '')}</span> },
    { key: 'specialty', label: t('col.specialty') },
    { key: 'phone', label: t('col.phone') },
    { key: 'email', label: t('col.email') },
    { key: 'license_number', label: t('col.license') },
    { key: 'status', label: t('col.status') },
  ];
  const fields: FieldDef[] = [
    { key: 'first_name', label: t('fld.firstname'), required: true },
    { key: 'last_name', label: t('fld.lastname'), required: true },
    { key: 'specialty', label: t('fld.specialty') },
    { key: 'phone', label: t('col.phone') },
    { key: 'email', label: t('col.email'), type: 'text' },
    { key: 'license_number', label: t('fld.license_number') },
    { key: 'status', label: t('col.status'), type: 'select', options: statusOpts(['active', 'suspended', 'inactive'], t) },
  ];
  return <ModulePage table="doctors" tenantId={tenantId} title={t('mod.doctors.title')} desc={t('mod.doctors.desc')} icon={Stethoscope} columns={cols} formFields={fields} />;
}

export function AppointmentsModule({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const { pMap, dMap } = usePatientDoctorMaps(tenantId);
  const { extraFilter, searchBox } = usePatientSearch(pMap);
  const cols: ColumnDef[] = [
    { key: 'patient_id', label: t('col.patient'), render: (r) => <span>{pMap.get(r.patient_id as string)?.first_name ?? '—'} {pMap.get(r.patient_id as string)?.last_name ?? ''}</span> },
    { key: 'doctor_id', label: t('col.doctor'), render: (r) => <span>{dMap.get(r.doctor_id as string)?.first_name ?? '—'} {dMap.get(r.doctor_id as string)?.last_name ?? ''}</span> },
    { key: 'scheduled_at', label: t('col.scheduled') },
    { key: 'reason', label: t('col.reason') },
    { key: 'status', label: t('col.status') },
  ];
  const fields: FieldDef[] = [
    { key: 'patient_id', label: t('fld.patient'), type: 'select', required: true, options: Array.from(pMap.values()).map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` })) },
    { key: 'doctor_id', label: t('fld.doctor'), type: 'select', options: Array.from(dMap.values()).map((d) => ({ value: d.id, label: `${d.first_name} ${d.last_name}` })) },
    { key: 'scheduled_at', label: t('fld.scheduled_at'), type: 'datetime-local', required: true },
    { key: 'duration_min', label: t('fld.duration'), type: 'number' },
    { key: 'reason', label: t('col.reason') },
    { key: 'status', label: t('col.status'), type: 'select', options: statusOpts(['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'], t) },
  ];
  return <ModulePage table="appointments" tenantId={tenantId} title={t('mod.appointments.title')} desc={t('mod.appointments.desc')} icon={CalendarDays} columns={cols} formFields={fields} extraFilter={extraFilter} extraToolbar={searchBox} />;
}

function useIcd10Reference(lang: 'fr' | 'en') {
  const [rows, setRows] = useState<{ code: string; label_en: string; label_fr: string }[]>([]);
  useEffect(() => {
    supabase.from('icd10_reference').select('code, label_en, label_fr').order('code')
      .then(({ data }) => setRows((data as typeof rows) ?? []));
  }, []);
  return rows.map((r) => ({ value: r.code, label: `${r.code} — ${lang === 'fr' ? r.label_fr : r.label_en}` }));
}

export function MedicalRecordsModule({ tenantId }: { tenantId: string }) {
  const { t, lang } = useI18n();
  const { activeTenant } = useAuth();
  const { pMap, dMap } = usePatientDoctorMaps(tenantId);
  const { extraFilter, searchBox } = usePatientSearch(pMap);
  const icd10Options = useIcd10Reference(lang);
  const cols: ColumnDef[] = [
    { key: 'patient_id', label: t('col.patient'), render: (r) => <span>{pMap.get(r.patient_id as string)?.first_name ?? '—'} {pMap.get(r.patient_id as string)?.last_name ?? ''}</span> },
    { key: 'record_date', label: t('col.date') },
    { key: 'diagnosis', label: t('col.diagnosis') },
    { key: 'icd10_code', label: t('col.icd10') },
  ];
  const fields: FieldDef[] = [
    { key: 'patient_id', label: t('fld.patient'), type: 'select', required: true, options: Array.from(pMap.values()).map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` })) },
    { key: 'doctor_id', label: t('fld.doctor'), type: 'select', options: Array.from(dMap.values()).map((d) => ({ value: d.id, label: `${d.first_name} ${d.last_name}` })) },
    { key: 'record_date', label: t('fld.record_date'), type: 'date', required: true },
    { key: 'chief_complaint', label: t('fld.chief_complaint'), type: 'textarea' },
    { key: 'history', label: t('fld.history'), type: 'textarea' },
    { key: 'examination', label: t('fld.examination'), type: 'textarea' },
    { key: 'diagnosis', label: t('fld.diagnosis'), type: 'textarea' },
    { key: 'icd10_code', label: t('fld.icd10_code'), type: 'datalist', options: icd10Options, placeholder: t('fld.icd10_placeholder') },
    { key: 'notes', label: t('fld.notes'), type: 'textarea' },
  ];
  return <ModulePage table="medical_records" tenantId={tenantId} title={t('mod.records.title')} desc={t('mod.records.desc')} icon={FileText} columns={cols} formFields={fields}
    extraFilter={extraFilter} extraToolbar={searchBox}
    pdfAction={(row) => generateMedicalRecordPDF(activeTenant!, row as unknown as MedicalRecord, pMap.get(row.patient_id as string) ?? null, dMap.get(row.doctor_id as string) ?? null)} />;
}

export function ConsultationsModule({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const { pMap, dMap } = usePatientDoctorMaps(tenantId);
  const { extraFilter, searchBox } = usePatientSearch(pMap);
  const cols: ColumnDef[] = [
    { key: 'patient_id', label: t('col.patient'), render: (r) => <span>{pMap.get(r.patient_id as string)?.first_name ?? '—'} {pMap.get(r.patient_id as string)?.last_name ?? ''}</span> },
    { key: 'consult_date', label: t('col.date') },
    { key: 'assessment', label: t('col.assessment') },
  ];
  const fields: FieldDef[] = [
    { key: 'patient_id', label: t('fld.patient'), type: 'select', required: true, options: Array.from(pMap.values()).map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` })) },
    { key: 'doctor_id', label: t('fld.doctor'), type: 'select', options: Array.from(dMap.values()).map((d) => ({ value: d.id, label: `${d.first_name} ${d.last_name}` })) },
    { key: 'consult_date', label: t('fld.consult_date'), type: 'date', required: true },
    { key: 'subjective', label: t('fld.subjective'), type: 'textarea' },
    { key: 'objective', label: t('fld.objective'), type: 'textarea' },
    { key: 'assessment', label: t('fld.assessment'), type: 'textarea' },
    { key: 'plan', label: t('fld.plan'), type: 'textarea' },
    { key: 'follow_up', label: t('fld.follow_up') },
  ];
  return <ModulePage table="consultations" tenantId={tenantId} title={t('mod.consultations.title')} desc={t('mod.consultations.desc')} icon={ClipboardList} columns={cols} formFields={fields} extraFilter={extraFilter} extraToolbar={searchBox} />;
}

type DrugInteraction = { drug_a: string; drug_b: string; severity: 'minor' | 'moderate' | 'major'; description_en: string; description_fr: string };

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- lang kept in the signature; description_fr/description_en selected but not yet branched on
function useDrugInteractionWarnings(tenantId: string, lang: 'fr' | 'en') {
  const { rows: prescriptions } = useCrud<Prescription>('prescriptions', tenantId);
  const [interactions, setInteractions] = useState<DrugInteraction[]>([]);
  useEffect(() => {
    supabase.from('drug_interactions').select('drug_a, drug_b, severity, description_en, description_fr')
      .then(({ data }) => setInteractions((data as DrugInteraction[]) ?? []));
  }, []);

  const activeByPatient = new Map<string, string[]>();
  for (const rx of prescriptions) {
    if (rx.status !== 'active' || !rx.medication) continue;
    const list = activeByPatient.get(rx.patient_id) ?? [];
    list.push(rx.medication.toLowerCase());
    activeByPatient.set(rx.patient_id, list);
  }

  const warnings: { patientId: string; interaction: DrugInteraction }[] = [];
  for (const [patientId, meds] of activeByPatient) {
    for (const interaction of interactions) {
      const hasA = meds.some((m) => m.includes(interaction.drug_a));
      const hasB = meds.some((m) => m.includes(interaction.drug_b));
      if (hasA && hasB) warnings.push({ patientId, interaction });
    }
  }
  return warnings;
}

export function PrescriptionsModule({ tenantId }: { tenantId: string }) {
  const { t, lang } = useI18n();
  const { activeTenant } = useAuth();
  const { pMap, dMap } = usePatientDoctorMaps(tenantId);
  const { extraFilter, searchBox } = usePatientSearch(pMap);
  const warnings = useDrugInteractionWarnings(tenantId, lang as 'fr' | 'en');
  const pharmacy = useCrud<PharmacyItem>('pharmacy_items', tenantId);
  const pharmacyMap = useMemo(() => new Map(pharmacy.rows.map((p) => [p.id, p])), [pharmacy.rows]);
  const [dispenseRow, setDispenseRow] = useState<Prescription | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const cols: ColumnDef[] = [
    { key: 'patient_id', label: t('col.patient'), render: (r) => <span>{pMap.get(r.patient_id as string)?.first_name ?? '—'} {pMap.get(r.patient_id as string)?.last_name ?? ''}</span> },
    { key: 'medication', label: t('col.medication') },
    { key: 'dosage', label: t('col.dosage') },
    { key: 'status', label: t('col.status'), render: (r) => (
      <div className="flex items-center gap-1.5">
        <Badge color={r.status === 'dispensed' ? 'green' : r.status === 'cancelled' ? 'gray' : 'amber'}>{String(r.status ?? '')}</Badge>
        {r.status === 'dispensed' && Boolean(r.pharmacy_item_id) && <span className="text-xs text-gray-400">({t('rx.stock_linked')})</span>}
      </div>
    ) },
  ];
  const fields: FieldDef[] = [
    { key: 'patient_id', label: t('fld.patient'), type: 'select', required: true, options: Array.from(pMap.values()).map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` })) },
    { key: 'doctor_id', label: t('fld.doctor'), type: 'select', options: Array.from(dMap.values()).map((d) => ({ value: d.id, label: `${d.first_name} ${d.last_name}` })) },
    { key: 'medication', label: t('fld.medication'), required: true },
    { key: 'pharmacy_item_id', label: t('rx.link_stock'), type: 'select', options: pharmacy.rows.map((p) => ({ value: p.id, label: `${p.name}${p.strength ? ' ' + p.strength : ''} (${p.quantity} ${t('rx.in_stock')})` })) },
    { key: 'dosage', label: t('col.dosage') },
    { key: 'frequency', label: t('fld.frequency') },
    { key: 'duration', label: t('fld.duration_tx') },
    { key: 'notes', label: t('fld.notes'), type: 'textarea' },
    { key: 'status', label: t('col.status'), type: 'select', options: statusOpts(['active', 'dispensed', 'cancelled'], t) },
  ];
  return (
    <div key={refreshKey}>
      {warnings.length > 0 && (
        <div className="mb-4 space-y-2">
          {warnings.map((w, i) => (
            <div key={i} className={`p-3 rounded-xl border text-sm flex items-start gap-2 ${w.interaction.severity === 'major' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
              <span className="text-lg leading-none">⚠️</span>
              <div>
                <p className="font-semibold">
                  {t('rx.interaction_warning_title')} — {pMap.get(w.patientId)?.first_name ?? '—'} {pMap.get(w.patientId)?.last_name ?? ''} ({w.interaction.drug_a} + {w.interaction.drug_b})
                </p>
                <p>{lang === 'fr' ? w.interaction.description_fr : w.interaction.description_en}</p>
              </div>
            </div>
          ))}
          <p className="text-xs text-gray-400 italic">{t('rx.interaction_disclaimer')}</p>
        </div>
      )}
      <ModulePage table="prescriptions" tenantId={tenantId} title={t('mod.prescriptions.title')} desc={t('mod.prescriptions.desc')} icon={Pill} columns={cols} formFields={fields}
    extraFilter={extraFilter} extraToolbar={searchBox}
        pdfAction={(row) => generatePrescriptionPDF(activeTenant!, row as unknown as Prescription, pMap.get(row.patient_id as string) ?? null, dMap.get(row.doctor_id as string) ?? null)}
        rowActions={(row) => (row.status === 'active' && row.pharmacy_item_id) ? (
          <button onClick={() => setDispenseRow(row as unknown as Prescription)} title={t('rx.dispense')} className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"><PackageCheck size={16} /></button>
        ) : null} />
      {dispenseRow && (
        <DispenseModal
          prescription={dispenseRow}
          item={pharmacyMap.get(dispenseRow.pharmacy_item_id!) ?? null}
          patientName={`${pMap.get(dispenseRow.patient_id)?.first_name ?? ''} ${pMap.get(dispenseRow.patient_id)?.last_name ?? ''}`.trim()}
          onClose={() => setDispenseRow(null)}
          onDone={() => { setDispenseRow(null); pharmacy.load(); setRefreshKey((k) => k + 1); }}
        />
      )}
    </div>
  );
}

function DispenseModal({ prescription, item, patientName, onClose, onDone }: {
  prescription: Prescription; item: PharmacyItem | null; patientName: string;
  onClose: () => void; onDone: () => void;
}) {
  const { t } = useI18n();
  const [qty, setQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true); setErr(null);
    const { error } = await supabase.rpc('dispense_prescription', { p_prescription_id: prescription.id, p_quantity: qty });
    setSaving(false);
    if (error) {
      const known: Record<string, string> = {
        insufficient_stock: t('rx.err_insufficient_stock'),
        already_dispensed: t('rx.err_already_dispensed'),
        no_pharmacy_item_linked: t('rx.err_no_stock_linked'),
      };
      setErr(known[error.message] ?? error.message);
      return;
    }
    onDone();
  };

  return (
    <Modal open onClose={onClose} title={t('rx.dispense')} footer={
      <><Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button><Button onClick={submit} loading={saving}>{t('rx.dispense_confirm')}</Button></>
    }>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">{t('rx.dispense_for')} <span className="font-semibold text-gray-900">{patientName}</span></p>
        {item && (
          <div className="px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm">
            <p className="font-medium text-gray-900">{item.name} {item.strength}</p>
            <p className="text-gray-500 mt-0.5">{t('rx.in_stock')}: {item.quantity} · {t('col.price')}: {item.unit_price}</p>
          </div>
        )}
        <Input label={t('fld.quantity')} type="number" min={1} max={item?.quantity ?? undefined} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
        <p className="text-xs text-gray-400">{t('rx.dispense_note')}</p>
        {err && <p className="text-sm text-red-600">{err}</p>}
      </div>
    </Modal>
  );
}

function AttachmentLink({ path, label }: { path: string | null | undefined; label: string }) {
  const [loading, setLoading] = useState(false);
  if (!path) return <span className="text-sm text-gray-300">—</span>;
  const open = async () => {
    setLoading(true);
    const { data } = await supabase.storage.from('clinical-attachments').createSignedUrl(path, 60);
    setLoading(false);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };
  return <button onClick={open} disabled={loading} className="text-sm text-blue-600 hover:underline flex items-center gap-1">📎 {loading ? '...' : label}</button>;
}

export function LabModule({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const { activeTenant } = useAuth();
  const { pMap, dMap } = usePatientDoctorMaps(tenantId);
  const { extraFilter, searchBox } = usePatientSearch(pMap);
  const cols: ColumnDef[] = [
    { key: 'patient_id', label: t('col.patient'), render: (r) => <span>{pMap.get(r.patient_id as string)?.first_name ?? '—'} {pMap.get(r.patient_id as string)?.last_name ?? ''}</span> },
    { key: 'test_name', label: t('col.test') },
    { key: 'status', label: t('col.status') },
    { key: 'ordered_at', label: t('col.ordered') },
    { key: 'attachment_path', label: t('col.attachment'), render: (r) => <AttachmentLink path={r.attachment_path as string} label={t('common.download')} /> },
  ];
  const fields: FieldDef[] = [
    { key: 'patient_id', label: t('fld.patient'), type: 'select', required: true, options: Array.from(pMap.values()).map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` })) },
    { key: 'doctor_id', label: t('fld.doctor'), type: 'select', options: Array.from(dMap.values()).map((d) => ({ value: d.id, label: `${d.first_name} ${d.last_name}` })) },
    { key: 'test_name', label: t('fld.test_name'), required: true },
    { key: 'test_code', label: t('fld.test_code') },
    { key: 'status', label: t('col.status'), type: 'select', options: statusOpts(['ordered', 'collected', 'resulted', 'validated', 'cancelled'], t) },
    { key: 'result', label: t('fld.result'), type: 'textarea' },
    { key: 'reference_values', label: t('fld.reference_values'), type: 'textarea' },
    { key: 'attachment_path', label: t('fld.attachment'), type: 'file' },
  ];
  return <ModulePage table="lab_orders" tenantId={tenantId} title={t('mod.lab.title')} desc={t('mod.lab.desc')} icon={FlaskConical} columns={cols} formFields={fields}
    extraFilter={extraFilter} extraToolbar={searchBox}
    pdfAction={(row) => generateLabReportPDF(activeTenant!, row as unknown as LabOrder, pMap.get(row.patient_id as string) ?? null, dMap.get(row.doctor_id as string) ?? null)} />;
}

export function RadiologyModule({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const { activeTenant } = useAuth();
  const { pMap, dMap } = usePatientDoctorMaps(tenantId);
  const { extraFilter, searchBox } = usePatientSearch(pMap);
  const cols: ColumnDef[] = [
    { key: 'patient_id', label: t('col.patient'), render: (r) => <span>{pMap.get(r.patient_id as string)?.first_name ?? '—'} {pMap.get(r.patient_id as string)?.last_name ?? ''}</span> },
    { key: 'modality', label: t('col.modality') },
    { key: 'body_part', label: t('col.body_part') },
    { key: 'status', label: t('col.status') },
    { key: 'attachment_path', label: t('col.attachment'), render: (r) => <AttachmentLink path={r.attachment_path as string} label={t('common.download')} /> },
  ];
  const fields: FieldDef[] = [
    { key: 'patient_id', label: t('fld.patient'), type: 'select', required: true, options: Array.from(pMap.values()).map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` })) },
    { key: 'doctor_id', label: t('fld.doctor'), type: 'select', options: Array.from(dMap.values()).map((d) => ({ value: d.id, label: `${d.first_name} ${d.last_name}` })) },
    { key: 'modality', label: t('fld.modality'), required: true, type: 'select', options: ['X-Ray', 'CT', 'MRI', 'Ultrasound', 'Mammography', 'PET'].map((v) => ({ value: v, label: v })) },
    { key: 'body_part', label: t('fld.body_part'), required: true },
    { key: 'status', label: t('col.status'), type: 'select', options: statusOpts(['ordered', 'performed', 'reported', 'validated', 'cancelled'], t) },
    { key: 'report', label: t('fld.report'), type: 'textarea' },
    { key: 'attachment_path', label: t('fld.attachment'), type: 'file' },
  ];
  return <ModulePage table="radiology_orders" tenantId={tenantId} title={t('mod.radiology.title')} desc={t('mod.radiology.desc')} icon={ScanLine} columns={cols} formFields={fields}
    extraFilter={extraFilter} extraToolbar={searchBox}
    pdfAction={(row) => generateRadiologyReportPDF(activeTenant!, row as unknown as RadiologyOrder, pMap.get(row.patient_id as string) ?? null, dMap.get(row.doctor_id as string) ?? null)} />;
}

export function PharmacyModule({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const crud = useCrud<PharmacyItem>('pharmacy_items', tenantId);
  const cols: ColumnDef[] = [
    { key: 'name', label: t('fld.name') },
    { key: 'generic_name', label: t('col.generic') },
    { key: 'quantity', label: t('col.qty'), render: (r) => <Badge color={Number(r.quantity) <= Number(r.reorder_level) ? 'red' : 'green'}>{String(r.quantity ?? '')}</Badge> },
    { key: 'unit_price', label: t('col.price') },
    { key: 'expiry_date', label: t('col.expiry') },
  ];
  const fields: FieldDef[] = [
    { key: 'name', label: t('fld.name'), required: true },
    { key: 'generic_name', label: t('fld.generic_name') },
    { key: 'form', label: t('fld.form'), type: 'select', options: ['tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops'].map((v) => ({ value: v, label: v })) },
    { key: 'strength', label: t('fld.strength') },
    { key: 'batch_number', label: t('fld.batch_number') },
    { key: 'expiry_date', label: t('fld.expiry_date'), type: 'date' },
    { key: 'quantity', label: t('fld.quantity'), type: 'number', required: true },
    { key: 'reorder_level', label: t('fld.reorder_level'), type: 'number' },
    { key: 'unit_price', label: t('fld.unit_price'), type: 'number' },
  ];
  const lowStock = crud.rows.filter((r) => r.quantity <= r.reorder_level).length;
  return (
    <>
      {lowStock > 0 && <div className="mb-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">{lowStock} {t('settings.low_stock')}</div>}
      <ModulePage table="pharmacy_items" tenantId={tenantId} title={t('mod.pharmacy.title')} desc={t('mod.pharmacy.desc')} icon={Pill} columns={cols} formFields={fields} />
    </>
  );
}

export function BedsModule({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const cols: ColumnDef[] = [
    { key: 'ward', label: t('col.ward') },
    { key: 'room', label: t('col.room') },
    { key: 'bed_number', label: t('col.bed') },
    { key: 'status', label: t('col.status') },
  ];
  const fields: FieldDef[] = [
    { key: 'ward', label: t('fld.ward'), required: true },
    { key: 'room', label: t('fld.room'), required: true },
    { key: 'bed_number', label: t('fld.bed_number'), required: true },
    { key: 'status', label: t('col.status'), type: 'select', options: statusOpts(['available', 'occupied', 'cleaning', 'maintenance', 'reserved'], t) },
  ];
  return <ModulePage table="beds" tenantId={tenantId} title={t('mod.beds.title')} desc={t('mod.beds.desc')} icon={BedDouble} columns={cols} formFields={fields} />;
}

export function AdmissionsModule({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const { pMap, dMap } = usePatientDoctorMaps(tenantId);
  const { extraFilter, searchBox } = usePatientSearch(pMap);
  const beds = useCrud<Bed>('beds', tenantId);
  const bedMap = useMemo(() => new Map(beds.rows.map((b) => [b.id, b])), [beds.rows]);
  const bedLabel = (b: Bed) => `${b.ward} — ${b.room}/${b.bed_number}`;
  const cols: ColumnDef[] = [
    { key: 'patient_id', label: t('col.patient'), render: (r) => <span>{pMap.get(r.patient_id as string)?.first_name ?? '—'} {pMap.get(r.patient_id as string)?.last_name ?? ''}</span> },
    { key: 'bed_id', label: t('col.bed'), render: (r) => <span>{r.bed_id ? bedLabel(bedMap.get(r.bed_id as string) ?? { ward: '—', room: '', bed_number: '' } as Bed) : '—'}</span> },
    { key: 'admission_date', label: t('col.admitted') },
    { key: 'reason', label: t('col.reason') },
    { key: 'status', label: t('col.status') },
  ];
  const fields: FieldDef[] = [
    { key: 'patient_id', label: t('fld.patient'), type: 'select', required: true, options: Array.from(pMap.values()).map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` })) },
    { key: 'doctor_id', label: t('fld.doctor'), type: 'select', options: Array.from(dMap.values()).map((d) => ({ value: d.id, label: `${d.first_name} ${d.last_name}` })) },
    // Only beds that are free (or already assigned to this same
    // admission when editing) are offered here -- assigning an already-
    // occupied bed to a different patient is additionally blocked at
    // the database level (see 20260908130000_admissions_beds_sync.sql)
    // in case of concurrent edits or API writes.
    { key: 'bed_id', label: t('fld.bed'), type: 'select', options: beds.rows.filter((b) => b.status === 'available' || b.status === 'occupied').map((b) => ({ value: b.id, label: `${bedLabel(b)}${b.status === 'occupied' ? ` (${t('opt.occupied')})` : ''}` })) },
    { key: 'admission_date', label: t('fld.admission_date'), type: 'datetime-local', required: true },
    { key: 'reason', label: t('col.reason') },
    { key: 'status', label: t('col.status'), type: 'select', options: statusOpts(['admitted', 'discharged', 'transferred'], t) },
    { key: 'notes', label: t('fld.notes'), type: 'textarea' },
  ];
  return <ModulePage table="admissions" tenantId={tenantId} title={t('mod.admissions.title')} desc={t('mod.admissions.desc')} icon={LogIn} columns={cols} formFields={fields} extraFilter={extraFilter} extraToolbar={searchBox} />;
}

export function InvoicesModule({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const { activeTenant } = useAuth();
  const { pMap } = usePatientDoctorMaps(tenantId);
  const { extraFilter, searchBox } = usePatientSearch(pMap);
  const currency = activeTenant?.currency_code ?? 'USD';
  const taxRate = activeTenant?.tax_rate ?? 0;
  const [itemsForInvoice, setItemsForInvoice] = useState<Invoice | null>(null);

  const cols: ColumnDef[] = [
    { key: 'invoice_number', label: t('col.invoice_no') },
    { key: 'patient_id', label: t('col.patient'), render: (r) => <span>{pMap.get(r.patient_id as string)?.first_name ?? '—'} {pMap.get(r.patient_id as string)?.last_name ?? ''}</span> },
    { key: 'issue_date', label: t('col.issue_date') },
    { key: 'total', label: t('col.total'), render: (r) => <span>{formatTenantCurrency(Number(r.total), currency)}</span> },
    { key: 'status', label: t('col.status') },
  ];
  const fields: FieldDef[] = [
    { key: 'patient_id', label: t('fld.patient'), type: 'select', options: Array.from(pMap.values()).map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` })) },
    // invoice_number is no longer entered by hand -- a database trigger
    // fills it in automatically (INV-<year>-<sequence>) whenever it's
    // left blank on insert, so duplicate or inconsistent numbering
    // between staff is no longer possible.
    { key: 'issue_date', label: t('fld.issue_date'), type: 'date', required: true },
    { key: 'due_date', label: t('fld.due_date'), type: 'date' },
    { key: 'subtotal', label: t('fld.subtotal'), type: 'number', required: true },
    { key: 'tax', label: `${t('fld.tax')} (${taxRate}%)`, type: 'number' },
    { key: 'total', label: t('fld.total'), type: 'number', required: true },
    { key: 'notes', label: t('fld.notes'), type: 'textarea' },
  ];
  return (
    <>
      <ModulePage table="invoices" tenantId={tenantId} title={t('mod.invoices.title')} desc={t('mod.invoices.desc')} icon={Receipt} columns={cols} formFields={fields}
    extraFilter={extraFilter}
    extraToolbar={searchBox}
    // Auto-calculates tax and total from the institution's onboarding
    // tax rate as the subtotal is typed; editing tax by hand afterwards
    // still recalculates the total, for the rare exception that needs
    // a different rate on one invoice.
    rowActions={(row) => (
      <button onClick={() => setItemsForInvoice(row as unknown as Invoice)} title={t('inv.view_items')} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><ListChecks size={16} /></button>
    )}
    onFieldChange={(key, value, current) => {
      if (key === 'subtotal') {
        const subtotal = Number(value) || 0;
        const tax = Math.round(subtotal * (taxRate / 100) * 100) / 100;
        return { tax, total: Math.round((subtotal + tax) * 100) / 100 };
      }
      if (key === 'tax') {
        const subtotal = Number(current.subtotal) || 0;
        return { total: Math.round((subtotal + (Number(value) || 0)) * 100) / 100 };
      }
      return null;
    }}
    pdfAction={(row) => generateInvoicePDF(activeTenant!, row as unknown as Invoice, pMap.get(row.patient_id as string) ?? null)} />
      {itemsForInvoice && (
        <InvoiceItemsModal invoice={itemsForInvoice} currency={currency} onClose={() => setItemsForInvoice(null)} />
      )}
    </>
  );
}

function InvoiceItemsModal({ invoice, currency, onClose }: { invoice: Invoice; currency: string; onClose: () => void }) {
  const { t } = useI18n();
  const [items, setItems] = useState<InvoiceItem[] | null>(null);
  useEffect(() => {
    supabase.from('invoice_items').select('*').eq('invoice_id', invoice.id).order('created_at')
      .then(({ data }) => setItems((data as InvoiceItem[]) ?? []));
  }, [invoice.id]);
  return (
    <Modal open onClose={onClose} title={`${t('inv.items_for')} ${invoice.invoice_number}`} footer={<Button variant="outline" onClick={onClose}>{t('common.close')}</Button>}>
      {items === null ? (
        <p className="text-sm text-gray-400">{t('common.loading')}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400">{t('inv.no_items')}</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {items.map((it) => (
            <div key={it.id} className="py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-gray-900 truncate">{it.description}</p>
                <p className="text-xs text-gray-400">{it.quantity} × {formatTenantCurrency(it.unit_price, currency)}{it.source_type !== 'manual' ? ` · ${t(`inv.source.${it.source_type}`)}` : ''}</p>
              </div>
              <span className="text-sm font-medium text-gray-900 flex-shrink-0">{formatTenantCurrency(it.amount, currency)}</span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export function StaffModule({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const cols: ColumnDef[] = [
    { key: 'first_name', label: t('col.name'), searchKeys: ['first_name', 'last_name'], render: (r) => <span className="text-sm font-medium text-gray-900">{String(r.first_name ?? '')} {String(r.last_name ?? '')}</span> },
    { key: 'role', label: t('col.role') },
    { key: 'department', label: t('col.department') },
    { key: 'phone', label: t('col.phone') },
    { key: 'status', label: t('col.status') },
  ];
  const fields: FieldDef[] = [
    { key: 'first_name', label: t('fld.firstname'), required: true },
    { key: 'last_name', label: t('fld.lastname'), required: true },
    { key: 'role', label: t('col.role') },
    { key: 'department', label: t('col.department') },
    { key: 'email', label: t('col.email'), type: 'text' },
    { key: 'phone', label: t('col.phone') },
    { key: 'status', label: t('col.status'), type: 'select', options: statusOpts(['active', 'suspended', 'inactive'], t) },
  ];
  return <ModulePage table="staff" tenantId={tenantId} title={t('mod.staff.title')} desc={t('mod.staff.desc')} icon={UserCog} columns={cols} formFields={fields} />;
}

export function RolesModule({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const crud = useCrud<Role>('roles', tenantId);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [form, setForm] = useState<{ name: string; description: string; permissions: Record<string, boolean> }>({ name: '', description: '', permissions: {} });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const MODULE_KEYS = [
    'patients', 'appointments', 'doctors', 'records', 'consultations',
    'prescriptions', 'lab', 'radiology', 'pharmacy', 'beds', 'admissions',
    'invoices', 'reports', 'staff', 'roles', 'settings', 'performance',
    'surgeries', 'hr', 'payroll', 'inventory', 'insurance', 'telemedicine',
    'emergency', 'immunizations', 'discharge',
  ];
  const ACTIONS = ['view', 'create', 'edit', 'delete', 'export'];

  const cols: ColumnDef[] = [
    { key: 'name', label: t('fld.role_name') },
    { key: 'description', label: t('fld.description') },
    { key: 'is_system', label: t('col.system'), render: (r) => (r.is_system ? <Badge color="blue">{t('col.system')}</Badge> : <Badge>{t('col.custom')}</Badge>) },
    { key: 'permissions', label: t('sa.nav.audit'), render: (r) => <span className="text-xs text-gray-500">{Object.keys(r.permissions ?? {}).length} {t('mod.permissions')}</span> },
  ];

  const openAdd = () => { setEditing(null); setForm({ name: '', description: '', permissions: {} }); setErr(null); setModalOpen(true); };
  const openEdit = (row: Role) => { setEditing(row); setForm({ name: row.name, description: row.description ?? '', permissions: (row.permissions ?? {}) as Record<string, boolean> }); setErr(null); setModalOpen(true); };

  const togglePerm = (mod: string, action: string) => {
    const key = `${mod}.${action}`;
    setForm((f) => ({ ...f, permissions: { ...f.permissions, [key]: !f.permissions[key] } }));
  };

  const submit = async () => {
    if (!form.name) { setErr(t('onb.err.required')); return; }
    setSaving(true); setErr(null);
    const payload = { name: form.name, description: form.description || null, permissions: form.permissions, tenant_id: tenantId };
    const res = editing ? await crud.update(editing.id, payload) : await crud.insert(payload);
    if (res.error) setErr(res.error); else setModalOpen(false);
    setSaving(false);
  };

  const crudPage = useCrud<Role>('roles', tenantId);
  const filtered = crudPage.rows;

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center"><ShieldCheck size={22} className="text-blue-600" /></div>
          <div><h1 className="text-2xl font-bold text-gray-900">{t('mod.roles.title')}</h1><p className="text-sm text-gray-500 mt-0.5">{t('mod.roles.desc')}</p></div>
        </div>
        <Button onClick={openAdd}><Plus size={16} /> {t('common.add')}</Button>
      </div>
      <Card className="overflow-hidden">
        {crudPage.loading ? <div className="p-8 text-center text-sm text-gray-400">{t('common.loading')}</div> : crudPage.error ? (
          <div className="p-8 flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center"><AlertTriangle size={22} className="text-red-500" /></div>
            <div><p className="text-sm font-semibold text-gray-900">{t('common.load_failed')}</p><p className="text-xs text-gray-500 mt-1 max-w-md">{crudPage.error}</p></div>
            <Button variant="outline" size="sm" onClick={() => crudPage.load()}><RefreshCw size={14} /> {t('common.retry')}</Button>
          </div>
        ) : filtered.length === 0 ? <div className="p-8"><EmptyState icon={ShieldCheck} title={t('common.none')} /></div> : (
          <div className="overflow-x-auto"><table className="w-full"><thead><tr className="bg-gray-50 border-b border-gray-100">{cols.map((c) => <th key={c.key} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{c.label}</th>)}<th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{t('common.actions')}</th></tr></thead>
            <tbody className="divide-y divide-gray-50">{filtered.map((row) => (<tr key={row.id} className="hover:bg-gray-50/50">{cols.map((c) => <td key={c.key} className="px-4 py-3">{c.render ? c.render(row) : <span className="text-sm text-gray-700">{(row as unknown as Record<string, unknown>)[c.key] as React.ReactNode ?? '—'}</span>}</td>)}<td className="px-4 py-3"><div className="flex justify-end gap-1">{!row.is_system && <button onClick={() => openEdit(row)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"><Pencil size={16} /></button>}</div></td></tr>))}</tbody>
          </table></div>
        )}
      </Card>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('common.edit') : t('common.add')} footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button><Button onClick={submit} loading={saving}>{t('common.save')}</Button></>}>
        <div className="space-y-4">
          <Input label={t('fld.role_name')} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label={t('fld.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">{t('mod.permissions')}</p>
            <div className="max-h-64 overflow-y-auto space-y-2 border border-gray-200 rounded-xl p-3">
              {MODULE_KEYS.map((mod) => (
                <div key={mod} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                  <span className="text-sm font-medium text-gray-700 capitalize">{t(`dash.nav.${mod === 'records' ? 'records' : mod}`)}</span>
                  <div className="flex gap-1">
                    {ACTIONS.map((act) => {
                      const key = `${mod}.${act}`;
                      const checked = !!form.permissions[key];
                      return <button key={act} onClick={() => togglePerm(mod, act)} className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${checked ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>{act}</button>;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
        </div>
      </Modal>
    </div>
  );
}

type Report = {
  id: string; tenant_id: string; user_id: string | null;
  title: string; report_type: string; content: string | null;
  status: 'draft' | 'published' | 'archived'; created_at: string;
};

export function ReportsModule({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const { user, activeTenant } = useAuth();
  const crud = useCrud<Report>('reports', tenantId);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Report | null>(null);
  const [form, setForm] = useState<{ title: string; report_type: string; content: string; status: Report['status'] }>({ title: '', report_type: 'custom', content: '', status: 'draft' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [delId, setDelId] = useState<string | null>(null);

  const REPORT_TYPES = [
    { value: 'patient', label: t('mod.patients.title') },
    { value: 'consultation', label: t('mod.consultations.title') },
    { value: 'lab', label: t('mod.lab.title') },
    { value: 'radiology', label: t('mod.radiology.title') },
    { value: 'financial', label: t('mod.invoices.title') },
    { value: 'pharmacy', label: t('mod.pharmacy.title') },
    { value: 'custom', label: t('mod.reports.custom') },
  ];

  const openAdd = () => { setEditing(null); setForm({ title: '', report_type: 'custom', content: '', status: 'draft' }); setErr(null); setModalOpen(true); };
  const openEdit = (row: Report) => { setEditing(row); setForm({ title: row.title, report_type: row.report_type, content: row.content ?? '', status: row.status }); setErr(null); setModalOpen(true); };

  const submit = async () => {
    if (!form.title) { setErr(t('onb.err.required')); return; }
    setSaving(true); setErr(null);
    const payload = { ...form, tenant_id: tenantId, user_id: user?.id };
    const res = editing ? await crud.update(editing.id, payload) : await crud.insert(payload);
    if (res.error) setErr(res.error); else setModalOpen(false);
    setSaving(false);
  };

  const sendWhatsApp = (row: Report) => {
    const text = `*${row.title}*\nType: ${row.report_type}\n\n${row.content ?? ''}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const cols: ColumnDef[] = [
    { key: 'title', label: t('fld.name') },
    { key: 'report_type', label: t('common.type') },
    { key: 'status', label: t('col.status'), render: (r) => <Badge color={r.status === 'published' ? 'green' : 'gray'}>{String(r.status ?? '')}</Badge> },
    { key: 'created_at', label: t('common.date'), render: (r) => <span className="text-sm text-gray-600">{new Date(r.created_at as string).toLocaleDateString()}</span> },
  ];

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center"><FileBarChart size={22} className="text-blue-600" /></div>
          <div><h1 className="text-2xl font-bold text-gray-900">{t('mod.reports.title')}</h1><p className="text-sm text-gray-500 mt-0.5">{t('mod.reports.desc')}</p></div>
        </div>
        <Button onClick={openAdd}><Plus size={16} /> {t('common.add')}</Button>
      </div>
      <Card className="overflow-hidden">
        {crud.loading ? <div className="p-8 text-center text-sm text-gray-400">{t('common.loading')}</div> : crud.error ? (
          <div className="p-8 flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center"><AlertTriangle size={22} className="text-red-500" /></div>
            <div><p className="text-sm font-semibold text-gray-900">{t('common.load_failed')}</p><p className="text-xs text-gray-500 mt-1 max-w-md">{crud.error}</p></div>
            <Button variant="outline" size="sm" onClick={() => crud.load()}><RefreshCw size={14} /> {t('common.retry')}</Button>
          </div>
        ) : crud.rows.length === 0 ? <div className="p-8"><EmptyState icon={FileBarChart} title={t('common.none')} /></div> : (
          <div className="overflow-x-auto"><table className="w-full"><thead><tr className="bg-gray-50 border-b border-gray-100">{cols.map((c) => <th key={c.key} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{c.label}</th>)}<th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{t('common.actions')}</th></tr></thead>
            <tbody className="divide-y divide-gray-50">{crud.rows.map((row) => (<tr key={row.id} className="hover:bg-gray-50/50">{cols.map((c) => <td key={c.key} className="px-4 py-3">{c.render?.(row) ?? <span className="text-sm text-gray-700">{(row as unknown as Record<string, unknown>)[c.key] as React.ReactNode ?? '—'}</span>}</td>)}<td className="px-4 py-3"><div className="flex justify-end gap-1">
              <button onClick={() => generateGenericReportPDF(activeTenant!, { ...row, content: row.content ?? '' })} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50" title="PDF"><FileDown size={16} /></button>
              <button onClick={() => sendWhatsApp(row)} className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50" title="WhatsApp"><MessageCircle size={16} /></button>
              <button onClick={() => openEdit(row)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"><Pencil size={16} /></button>
              <button onClick={() => setDelId(row.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={16} /></button>
            </div></td></tr>))}</tbody>
          </table></div>
        )}
      </Card>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('common.edit') : t('common.add')} footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button><Button onClick={submit} loading={saving}>{t('common.save')}</Button></>}>
        <div className="space-y-4">
          <Input label={t('fld.name')} required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <label className="block"><span className="block text-sm font-medium text-gray-700 mb-1.5">{t('common.type')}</span><select value={form.report_type} onChange={(e) => setForm({ ...form, report_type: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm">{REPORT_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
          <label className="block"><span className="block text-sm font-medium text-gray-700 mb-1.5">{t('fld.notes')}</span><textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={6} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></label>
          <label className="block"><span className="block text-sm font-medium text-gray-700 mb-1.5">{t('col.status')}</span><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Report['status'] })} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm"><option value="draft">{t('opt.draft')}</option><option value="published">{t('opt.published')}</option><option value="archived">{t('opt.archived')}</option></select></label>
          {err && <p className="text-sm text-red-600">{err}</p>}
        </div>
      </Modal>
      <Modal open={!!delId} onClose={() => setDelId(null)} title={t('common.confirm.delete')} footer={<><Button variant="outline" onClick={() => setDelId(null)}>{t('common.cancel')}</Button><Button variant="danger" onClick={async () => { if (delId) { await crud.remove(delId); setDelId(null); } }}>{t('common.delete')}</Button></>}>
        <p className="text-sm text-gray-600">{t('common.confirm.delete')}</p>
      </Modal>
    </div>
  );
}

type PerformanceRow = {
  doctor_id: string; first_name: string; last_name: string; specialty: string | null; status?: string;
  appointments_count: number; consultations_count: number; prescriptions_count: number;
  lab_orders_count: number; radiology_orders_count: number;
};

export function PerformanceModule({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const [rows, setRows] = useState<PerformanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc('get_staff_performance', { p_tenant_id: tenantId });
      if (data) { setRows(data as PerformanceRow[]); setLoading(false); return; }
      const { data: doctors } = await supabase.from('doctors').select('*').eq('tenant_id', tenantId);
      const docList = (doctors as Doctor[]) ?? [];
      const results: PerformanceRow[] = [];
      for (const d of docList) {
        const [apt, con, pre, lab, rad] = await Promise.all([
          supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('doctor_id', d.id),
          supabase.from('consultations').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('doctor_id', d.id),
          supabase.from('prescriptions').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('doctor_id', d.id),
          supabase.from('lab_orders').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('doctor_id', d.id),
          supabase.from('radiology_orders').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('doctor_id', d.id),
        ]);
        results.push({ doctor_id: d.id, first_name: d.first_name, last_name: d.last_name, specialty: d.specialty, status: d.status, appointments_count: apt.count ?? 0, consultations_count: con.count ?? 0, prescriptions_count: pre.count ?? 0, lab_orders_count: lab.count ?? 0, radiology_orders_count: rad.count ?? 0 });
      }
      setRows(results); setLoading(false);
    })();
  }, [tenantId]);

  const kpis = [
    { label: t('dash.nav.appointments'), key: 'appointments_count', icon: CalendarDays, color: 'blue' },
    { label: t('dash.nav.consultations'), key: 'consultations_count', icon: ClipboardList, color: 'emerald' },
    { label: t('dash.nav.prescriptions'), key: 'prescriptions_count', icon: Pill, color: 'amber' },
    { label: t('dash.nav.lab'), key: 'lab_orders_count', icon: FlaskConical, color: 'red' },
  ];

  const totals = kpis.reduce((acc, k) => ({ ...acc, [k.key]: rows.reduce((s, r) => s + ((r as unknown as Record<string, number>)[k.key] ?? 0), 0) }), {} as Record<string, number>);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center"><TrendingUp size={22} className="text-blue-600" /></div>
        <div><h1 className="text-2xl font-bold text-gray-900">{t('mod.performance.title')}</h1><p className="text-sm text-gray-500 mt-0.5">{t('mod.performance.desc')}</p></div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((k, i) => (
          <Card key={i} className="p-5"><div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-${k.color}-50`}><k.icon size={20} className={`text-${k.color}-600`} /></div><p className="text-2xl font-bold text-gray-900">{totals[k.key] ?? 0}</p><p className="text-sm text-gray-500">{k.label}</p></Card>
        ))}
      </div>
      <Card className="overflow-hidden">
        {loading ? <div className="p-8 text-center text-sm text-gray-400">{t('common.loading')}</div> : rows.length === 0 ? <div className="p-8"><EmptyState icon={TrendingUp} title={t('common.none')} /></div> : (
          <div className="overflow-x-auto"><table className="w-full"><thead><tr className="bg-gray-50 border-b border-gray-100"><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('col.doctor')}</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('col.specialty')}</th>{kpis.map((k) => <th key={k.key} className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">{k.label}</th>)}<th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">{t('col.total')}</th></tr></thead>
            <tbody className="divide-y divide-gray-50">{rows.map((r) => { const total = (r.appointments_count ?? 0) + (r.consultations_count ?? 0) + (r.prescriptions_count ?? 0) + (r.lab_orders_count ?? 0) + (r.radiology_orders_count ?? 0); return (
              <tr key={r.doctor_id} className="hover:bg-gray-50/50"><td className="px-4 py-3 text-sm font-medium text-gray-900">{r.first_name} {r.last_name}</td><td className="px-4 py-3 text-sm text-gray-600">{r.specialty ?? '—'}</td>{kpis.map((k) => <td key={k.key} className="px-4 py-3 text-center text-sm text-gray-700">{(r as unknown as Record<string, number>)[k.key] ?? 0}</td>)}<td className="px-4 py-3 text-center"><Badge color={total > 10 ? 'green' : total > 0 ? 'amber' : 'gray'}>{total}</Badge></td></tr>
            ); })}</tbody>
          </table></div>
        )}
      </Card>
    </div>
  );
}
