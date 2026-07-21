import {
  Users, CalendarDays, Stethoscope, FileText, ClipboardList, Pill, FlaskConical, ScanLine,
  BedDouble, Receipt, UserCog, ShieldCheck, LogIn,
} from 'lucide-react';
import { ModulePage, type ColumnDef, type FieldDef } from '../components/ModulePage';
import { useCrud } from '../lib/useCrud';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { Badge } from '../components/ui';
import {
  generateInvoicePDF, generatePrescriptionPDF, generateLabReportPDF, generateRadiologyReportPDF, generateMedicalRecordPDF,
} from '../lib/pdf';
import type { Patient, Doctor, Invoice, Prescription, LabOrder, RadiologyOrder, MedicalRecord } from '../lib/supabase';

function usePatientDoctorMaps(tenantId: string) {
  const patients = useCrud<Patient>('patients', tenantId);
  const doctors = useCrud<Doctor>('doctors', tenantId);
  const pMap = new Map(patients.rows.map((p) => [p.id, p]));
  const dMap = new Map(doctors.rows.map((d) => [d.id, d]));
  return { pMap, dMap };
}

const statusOpts = (keys: string[], t: (k: string) => string) =>
  keys.map((k) => ({ value: k, label: t(`opt.${k}`) }));

export function PatientsModule({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const cols: ColumnDef[] = [
    { key: 'first_name', label: t('col.name'), render: (r) => <span className="text-sm font-medium text-gray-900">{r.first_name} {r.last_name}</span> },
    { key: 'gender', label: t('col.gender') },
    { key: 'phone', label: t('col.phone') },
    { key: 'email', label: t('col.email') },
    { key: 'blood_group', label: t('col.blood') },
  ];
  const fields: FieldDef[] = [
    { key: 'first_name', label: t('fld.firstname'), required: true },
    { key: 'last_name', label: t('fld.lastname'), required: true },
    { key: 'date_of_birth', label: t('fld.dob'), type: 'date' },
    { key: 'gender', label: t('fld.gender'), type: 'select', options: statusOpts(['male', 'female', 'other'], t) },
    { key: 'phone', label: t('col.phone') },
    { key: 'email', label: t('col.email'), type: 'text' },
    { key: 'blood_group', label: t('fld.blood_group'), type: 'select', options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((v) => ({ value: v, label: v })) },
    { key: 'allergies', label: t('fld.allergies'), type: 'textarea' },
  ];
  return <ModulePage table="patients" tenantId={tenantId} title={t('mod.patients.title')} desc={t('mod.patients.desc')} icon={Users} columns={cols} formFields={fields} />;
}

export function DoctorsModule({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const cols: ColumnDef[] = [
    { key: 'first_name', label: t('col.name'), render: (r) => <span className="text-sm font-medium text-gray-900">{r.first_name} {r.last_name}</span> },
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
  return <ModulePage table="appointments" tenantId={tenantId} title={t('mod.appointments.title')} desc={t('mod.appointments.desc')} icon={CalendarDays} columns={cols} formFields={fields} />;
}

export function MedicalRecordsModule({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const { activeTenant } = useAuth();
  const { pMap, dMap } = usePatientDoctorMaps(tenantId);
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
    { key: 'icd10_code', label: t('fld.icd10_code') },
    { key: 'notes', label: t('fld.notes'), type: 'textarea' },
  ];
  return <ModulePage table="medical_records" tenantId={tenantId} title={t('mod.records.title')} desc={t('mod.records.desc')} icon={FileText} columns={cols} formFields={fields}
    pdfAction={(row) => generateMedicalRecordPDF(activeTenant!, row as unknown as MedicalRecord, pMap.get(row.patient_id as string) ?? null, dMap.get(row.doctor_id as string) ?? null)} />;
}

export function ConsultationsModule({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const { pMap, dMap } = usePatientDoctorMaps(tenantId);
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
  return <ModulePage table="consultations" tenantId={tenantId} title={t('mod.consultations.title')} desc={t('mod.consultations.desc')} icon={ClipboardList} columns={cols} formFields={fields} />;
}

export function PrescriptionsModule({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const { activeTenant } = useAuth();
  const { pMap, dMap } = usePatientDoctorMaps(tenantId);
  const cols: ColumnDef[] = [
    { key: 'patient_id', label: t('col.patient'), render: (r) => <span>{pMap.get(r.patient_id as string)?.first_name ?? '—'} {pMap.get(r.patient_id as string)?.last_name ?? ''}</span> },
    { key: 'medication', label: t('col.medication') },
    { key: 'dosage', label: t('col.dosage') },
    { key: 'status', label: t('col.status') },
  ];
  const fields: FieldDef[] = [
    { key: 'patient_id', label: t('fld.patient'), type: 'select', required: true, options: Array.from(pMap.values()).map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` })) },
    { key: 'doctor_id', label: t('fld.doctor'), type: 'select', options: Array.from(dMap.values()).map((d) => ({ value: d.id, label: `${d.first_name} ${d.last_name}` })) },
    { key: 'medication', label: t('fld.medication'), required: true },
    { key: 'dosage', label: t('col.dosage') },
    { key: 'frequency', label: t('fld.frequency') },
    { key: 'duration', label: t('fld.duration_tx') },
    { key: 'notes', label: t('fld.notes'), type: 'textarea' },
    { key: 'status', label: t('col.status'), type: 'select', options: statusOpts(['active', 'dispensed', 'cancelled'], t) },
  ];
  return <ModulePage table="prescriptions" tenantId={tenantId} title={t('mod.prescriptions.title')} desc={t('mod.prescriptions.desc')} icon={Pill} columns={cols} formFields={fields}
    pdfAction={(row) => generatePrescriptionPDF(activeTenant!, row as unknown as Prescription, pMap.get(row.patient_id as string) ?? null, dMap.get(row.doctor_id as string) ?? null)} />;
}

export function LabModule({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const { activeTenant } = useAuth();
  const { pMap, dMap } = usePatientDoctorMaps(tenantId);
  const cols: ColumnDef[] = [
    { key: 'patient_id', label: t('col.patient'), render: (r) => <span>{pMap.get(r.patient_id as string)?.first_name ?? '—'} {pMap.get(r.patient_id as string)?.last_name ?? ''}</span> },
    { key: 'test_name', label: t('col.test') },
    { key: 'status', label: t('col.status') },
    { key: 'ordered_at', label: t('col.ordered') },
  ];
  const fields: FieldDef[] = [
    { key: 'patient_id', label: t('fld.patient'), type: 'select', required: true, options: Array.from(pMap.values()).map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` })) },
    { key: 'doctor_id', label: t('fld.doctor'), type: 'select', options: Array.from(dMap.values()).map((d) => ({ value: d.id, label: `${d.first_name} ${d.last_name}` })) },
    { key: 'test_name', label: t('fld.test_name'), required: true },
    { key: 'test_code', label: t('fld.test_code') },
    { key: 'status', label: t('col.status'), type: 'select', options: statusOpts(['ordered', 'collected', 'resulted', 'validated', 'cancelled'], t) },
    { key: 'result', label: t('fld.result'), type: 'textarea' },
    { key: 'reference_values', label: t('fld.reference_values'), type: 'textarea' },
  ];
  return <ModulePage table="lab_orders" tenantId={tenantId} title={t('mod.lab.title')} desc={t('mod.lab.desc')} icon={FlaskConical} columns={cols} formFields={fields}
    pdfAction={(row) => generateLabReportPDF(activeTenant!, row as unknown as LabOrder, pMap.get(row.patient_id as string) ?? null, dMap.get(row.doctor_id as string) ?? null)} />;
}

export function RadiologyModule({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const { activeTenant } = useAuth();
  const { pMap, dMap } = usePatientDoctorMaps(tenantId);
  const cols: ColumnDef[] = [
    { key: 'patient_id', label: t('col.patient'), render: (r) => <span>{pMap.get(r.patient_id as string)?.first_name ?? '—'} {pMap.get(r.patient_id as string)?.last_name ?? ''}</span> },
    { key: 'modality', label: t('col.modality') },
    { key: 'body_part', label: t('col.body_part') },
    { key: 'status', label: t('col.status') },
  ];
  const fields: FieldDef[] = [
    { key: 'patient_id', label: t('fld.patient'), type: 'select', required: true, options: Array.from(pMap.values()).map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` })) },
    { key: 'doctor_id', label: t('fld.doctor'), type: 'select', options: Array.from(dMap.values()).map((d) => ({ value: d.id, label: `${d.first_name} ${d.last_name}` })) },
    { key: 'modality', label: t('fld.modality'), required: true, type: 'select', options: ['X-Ray', 'CT', 'MRI', 'Ultrasound', 'Mammography', 'PET'].map((v) => ({ value: v, label: v })) },
    { key: 'body_part', label: t('fld.body_part'), required: true },
    { key: 'status', label: t('col.status'), type: 'select', options: statusOpts(['ordered', 'performed', 'reported', 'validated', 'cancelled'], t) },
    { key: 'report', label: t('fld.report'), type: 'textarea' },
  ];
  return <ModulePage table="radiology_orders" tenantId={tenantId} title={t('mod.radiology.title')} desc={t('mod.radiology.desc')} icon={ScanLine} columns={cols} formFields={fields}
    pdfAction={(row) => generateRadiologyReportPDF(activeTenant!, row as unknown as RadiologyOrder, pMap.get(row.patient_id as string) ?? null, dMap.get(row.doctor_id as string) ?? null)} />;
}

export function PharmacyModule({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const crud = useCrud<{ id: string; name: string; quantity: number; reorder_level: number; unit_price: number; expiry_date: string | null }>('pharmacy_items', tenantId);
  const cols: ColumnDef[] = [
    { key: 'name', label: t('fld.name') },
    { key: 'generic_name', label: t('col.generic') },
    { key: 'quantity', label: t('col.qty'), render: (r) => <Badge color={r.quantity <= r.reorder_level ? 'red' : 'green'}>{r.quantity}</Badge> },
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
  const cols: ColumnDef[] = [
    { key: 'patient_id', label: t('col.patient'), render: (r) => <span>{pMap.get(r.patient_id as string)?.first_name ?? '—'} {pMap.get(r.patient_id as string)?.last_name ?? ''}</span> },
    { key: 'admission_date', label: t('col.admitted') },
    { key: 'reason', label: t('col.reason') },
    { key: 'status', label: t('col.status') },
  ];
  const fields: FieldDef[] = [
    { key: 'patient_id', label: t('fld.patient'), type: 'select', required: true, options: Array.from(pMap.values()).map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` })) },
    { key: 'doctor_id', label: t('fld.doctor'), type: 'select', options: Array.from(dMap.values()).map((d) => ({ value: d.id, label: `${d.first_name} ${d.last_name}` })) },
    { key: 'admission_date', label: t('fld.admission_date'), type: 'datetime-local', required: true },
    { key: 'reason', label: t('col.reason') },
    { key: 'status', label: t('col.status'), type: 'select', options: statusOpts(['admitted', 'discharged', 'transferred'], t) },
    { key: 'notes', label: t('fld.notes'), type: 'textarea' },
  ];
  return <ModulePage table="admissions" tenantId={tenantId} title={t('mod.admissions.title')} desc={t('mod.admissions.desc')} icon={LogIn} columns={cols} formFields={fields} />;
}

export function InvoicesModule({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const { activeTenant } = useAuth();
  const { pMap } = usePatientDoctorMaps(tenantId);
  const cols: ColumnDef[] = [
    { key: 'invoice_number', label: t('col.invoice_no') },
    { key: 'patient_id', label: t('col.patient'), render: (r) => <span>{pMap.get(r.patient_id as string)?.first_name ?? '—'} {pMap.get(r.patient_id as string)?.last_name ?? ''}</span> },
    { key: 'issue_date', label: t('col.issue_date') },
    { key: 'total', label: t('col.total'), render: (r) => <span>${Number(r.total).toFixed(2)}</span> },
    { key: 'status', label: t('col.status') },
  ];
  const fields: FieldDef[] = [
    { key: 'patient_id', label: t('fld.patient'), type: 'select', options: Array.from(pMap.values()).map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` })) },
    { key: 'invoice_number', label: t('fld.invoice_number'), required: true },
    { key: 'issue_date', label: t('fld.issue_date'), type: 'date', required: true },
    { key: 'due_date', label: t('fld.due_date'), type: 'date' },
    { key: 'subtotal', label: t('fld.subtotal'), type: 'number', required: true },
    { key: 'tax', label: t('fld.tax'), type: 'number' },
    { key: 'total', label: t('fld.total'), type: 'number', required: true },
    { key: 'status', label: t('col.status'), type: 'select', options: statusOpts(['unpaid', 'paid', 'partial', 'cancelled', 'refunded'], t) },
    { key: 'notes', label: t('fld.notes'), type: 'textarea' },
  ];
  return <ModulePage table="invoices" tenantId={tenantId} title={t('mod.invoices.title')} desc={t('mod.invoices.desc')} icon={Receipt} columns={cols} formFields={fields}
    pdfAction={(row) => generateInvoicePDF(activeTenant!, row as unknown as Invoice, pMap.get(row.patient_id as string) ?? null)} />;
}

export function StaffModule({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const cols: ColumnDef[] = [
    { key: 'first_name', label: t('col.name'), render: (r) => <span className="text-sm font-medium text-gray-900">{r.first_name} {r.last_name}</span> },
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
  const cols: ColumnDef[] = [
    { key: 'name', label: t('fld.role_name') },
    { key: 'description', label: t('fld.description') },
    { key: 'is_system', label: t('col.system'), render: (r) => (r.is_system ? <Badge color="blue">{t('col.system')}</Badge> : <Badge>{t('col.custom')}</Badge>) },
  ];
  const fields: FieldDef[] = [
    { key: 'name', label: t('fld.role_name'), required: true },
    { key: 'description', label: t('fld.description'), type: 'textarea' },
  ];
  return <ModulePage table="roles" tenantId={tenantId} title={t('mod.roles.title')} desc={t('mod.roles.desc')} icon={ShieldCheck} columns={cols} formFields={fields} />;
}
