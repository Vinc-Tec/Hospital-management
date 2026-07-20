import {
  Users, CalendarDays, Stethoscope, FileText, ClipboardList, Pill, FlaskConical, ScanLine,
  BedDouble, Receipt, UserCog, ShieldCheck, LogIn,
} from 'lucide-react';
import { ModulePage, type ColumnDef, type FieldDef } from '../components/ModulePage';
import { useCrud } from '../lib/useCrud';
import { useAuth } from '../lib/auth';
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

export function PatientsModule({ tenantId }: { tenantId: string }) {
  const cols: ColumnDef[] = [
    { key: 'first_name', label: 'Name', render: (r) => <span className="text-sm font-medium text-gray-900">{r.first_name} {r.last_name}</span> },
    { key: 'gender', label: 'Gender' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'blood_group', label: 'Blood' },
  ];
  const fields: FieldDef[] = [
    { key: 'first_name', label: 'First name', required: true },
    { key: 'last_name', label: 'Last name', required: true },
    { key: 'date_of_birth', label: 'Date of birth', type: 'date' },
    { key: 'gender', label: 'Gender', type: 'select', options: [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }] },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email', type: 'text' },
    { key: 'blood_group', label: 'Blood group', type: 'select', options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((v) => ({ value: v, label: v })) },
    { key: 'allergies', label: 'Allergies', type: 'textarea' },
  ];
  return <ModulePage table="patients" tenantId={tenantId} title="Patients" desc="Manage patient records" icon={Users} columns={cols} formFields={fields} />;
}

export function DoctorsModule({ tenantId }: { tenantId: string }) {
  const cols: ColumnDef[] = [
    { key: 'first_name', label: 'Name', render: (r) => <span className="text-sm font-medium text-gray-900">{r.first_name} {r.last_name}</span> },
    { key: 'specialty', label: 'Specialty' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'license_number', label: 'License' },
    { key: 'status', label: 'Status' },
  ];
  const fields: FieldDef[] = [
    { key: 'first_name', label: 'First name', required: true },
    { key: 'last_name', label: 'Last name', required: true },
    { key: 'specialty', label: 'Specialty' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email', type: 'text' },
    { key: 'license_number', label: 'License number' },
    { key: 'status', label: 'Status', type: 'select', options: [{ value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }, { value: 'inactive', label: 'Inactive' }] },
  ];
  return <ModulePage table="doctors" tenantId={tenantId} title="Doctors" desc="Manage medical staff" icon={Stethoscope} columns={cols} formFields={fields} />;
}

export function AppointmentsModule({ tenantId }: { tenantId: string }) {
  const { pMap, dMap } = usePatientDoctorMaps(tenantId);
  const cols: ColumnDef[] = [
    { key: 'patient_id', label: 'Patient', render: (r) => <span>{pMap.get(r.patient_id as string)?.first_name ?? '—'} {pMap.get(r.patient_id as string)?.last_name ?? ''}</span> },
    { key: 'doctor_id', label: 'Doctor', render: (r) => <span>{dMap.get(r.doctor_id as string)?.first_name ?? '—'} {dMap.get(r.doctor_id as string)?.last_name ?? ''}</span> },
    { key: 'scheduled_at', label: 'Scheduled' },
    { key: 'reason', label: 'Reason' },
    { key: 'status', label: 'Status' },
  ];
  const fields: FieldDef[] = [
    { key: 'patient_id', label: 'Patient', type: 'select', required: true, options: Array.from(pMap.values()).map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` })) },
    { key: 'doctor_id', label: 'Doctor', type: 'select', options: Array.from(dMap.values()).map((d) => ({ value: d.id, label: `${d.first_name} ${d.last_name}` })) },
    { key: 'scheduled_at', label: 'Scheduled at', type: 'datetime-local', required: true },
    { key: 'duration_min', label: 'Duration (min)', type: 'number' },
    { key: 'reason', label: 'Reason' },
    { key: 'status', label: 'Status', type: 'select', options: ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'].map((v) => ({ value: v, label: v })) },
  ];
  return <ModulePage table="appointments" tenantId={tenantId} title="Appointments" desc="Schedule and track appointments" icon={CalendarDays} columns={cols} formFields={fields} />;
}

export function MedicalRecordsModule({ tenantId }: { tenantId: string }) {
  const { activeTenant } = useAuth();
  const { pMap, dMap } = usePatientDoctorMaps(tenantId);
  const cols: ColumnDef[] = [
    { key: 'patient_id', label: 'Patient', render: (r) => <span>{pMap.get(r.patient_id as string)?.first_name ?? '—'} {pMap.get(r.patient_id as string)?.last_name ?? ''}</span> },
    { key: 'record_date', label: 'Date' },
    { key: 'diagnosis', label: 'Diagnosis' },
    { key: 'icd10_code', label: 'ICD-10' },
  ];
  const fields: FieldDef[] = [
    { key: 'patient_id', label: 'Patient', type: 'select', required: true, options: Array.from(pMap.values()).map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` })) },
    { key: 'doctor_id', label: 'Doctor', type: 'select', options: Array.from(dMap.values()).map((d) => ({ value: d.id, label: `${d.first_name} ${d.last_name}` })) },
    { key: 'record_date', label: 'Record date', type: 'date', required: true },
    { key: 'chief_complaint', label: 'Chief complaint', type: 'textarea' },
    { key: 'history', label: 'History', type: 'textarea' },
    { key: 'examination', label: 'Examination', type: 'textarea' },
    { key: 'diagnosis', label: 'Diagnosis', type: 'textarea' },
    { key: 'icd10_code', label: 'ICD-10 code' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ];
  return <ModulePage table="medical_records" tenantId={tenantId} title="Medical Records" desc="Patient medical records" icon={FileText} columns={cols} formFields={fields}
    pdfAction={(row) => generateMedicalRecordPDF(activeTenant!, row as unknown as MedicalRecord, pMap.get(row.patient_id as string) ?? null, dMap.get(row.doctor_id as string) ?? null)} />;
}

export function ConsultationsModule({ tenantId }: { tenantId: string }) {
  const { pMap, dMap } = usePatientDoctorMaps(tenantId);
  const cols: ColumnDef[] = [
    { key: 'patient_id', label: 'Patient', render: (r) => <span>{pMap.get(r.patient_id as string)?.first_name ?? '—'} {pMap.get(r.patient_id as string)?.last_name ?? ''}</span> },
    { key: 'consult_date', label: 'Date' },
    { key: 'assessment', label: 'Assessment' },
  ];
  const fields: FieldDef[] = [
    { key: 'patient_id', label: 'Patient', type: 'select', required: true, options: Array.from(pMap.values()).map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` })) },
    { key: 'doctor_id', label: 'Doctor', type: 'select', options: Array.from(dMap.values()).map((d) => ({ value: d.id, label: `${d.first_name} ${d.last_name}` })) },
    { key: 'consult_date', label: 'Consult date', type: 'date', required: true },
    { key: 'subjective', label: 'Subjective', type: 'textarea' },
    { key: 'objective', label: 'Objective', type: 'textarea' },
    { key: 'assessment', label: 'Assessment', type: 'textarea' },
    { key: 'plan', label: 'Plan', type: 'textarea' },
    { key: 'follow_up', label: 'Follow up' },
  ];
  return <ModulePage table="consultations" tenantId={tenantId} title="Consultations" desc="SOAP consultations" icon={ClipboardList} columns={cols} formFields={fields} />;
}

export function PrescriptionsModule({ tenantId }: { tenantId: string }) {
  const { activeTenant } = useAuth();
  const { pMap, dMap } = usePatientDoctorMaps(tenantId);
  const cols: ColumnDef[] = [
    { key: 'patient_id', label: 'Patient', render: (r) => <span>{pMap.get(r.patient_id as string)?.first_name ?? '—'} {pMap.get(r.patient_id as string)?.last_name ?? ''}</span> },
    { key: 'medication', label: 'Medication' },
    { key: 'dosage', label: 'Dosage' },
    { key: 'status', label: 'Status' },
  ];
  const fields: FieldDef[] = [
    { key: 'patient_id', label: 'Patient', type: 'select', required: true, options: Array.from(pMap.values()).map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` })) },
    { key: 'doctor_id', label: 'Doctor', type: 'select', options: Array.from(dMap.values()).map((d) => ({ value: d.id, label: `${d.first_name} ${d.last_name}` })) },
    { key: 'medication', label: 'Medication', required: true },
    { key: 'dosage', label: 'Dosage' },
    { key: 'frequency', label: 'Frequency' },
    { key: 'duration', label: 'Duration' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
    { key: 'status', label: 'Status', type: 'select', options: ['active', 'dispensed', 'cancelled'].map((v) => ({ value: v, label: v })) },
  ];
  return <ModulePage table="prescriptions" tenantId={tenantId} title="Prescriptions" desc="Prescribe medications" icon={Pill} columns={cols} formFields={fields}
    pdfAction={(row) => generatePrescriptionPDF(activeTenant!, row as unknown as Prescription, pMap.get(row.patient_id as string) ?? null, dMap.get(row.doctor_id as string) ?? null)} />;
}

export function LabModule({ tenantId }: { tenantId: string }) {
  const { activeTenant } = useAuth();
  const { pMap, dMap } = usePatientDoctorMaps(tenantId);
  const cols: ColumnDef[] = [
    { key: 'patient_id', label: 'Patient', render: (r) => <span>{pMap.get(r.patient_id as string)?.first_name ?? '—'} {pMap.get(r.patient_id as string)?.last_name ?? ''}</span> },
    { key: 'test_name', label: 'Test' },
    { key: 'status', label: 'Status' },
    { key: 'ordered_at', label: 'Ordered' },
  ];
  const fields: FieldDef[] = [
    { key: 'patient_id', label: 'Patient', type: 'select', required: true, options: Array.from(pMap.values()).map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` })) },
    { key: 'doctor_id', label: 'Doctor', type: 'select', options: Array.from(dMap.values()).map((d) => ({ value: d.id, label: `${d.first_name} ${d.last_name}` })) },
    { key: 'test_name', label: 'Test name', required: true },
    { key: 'test_code', label: 'Test code' },
    { key: 'status', label: 'Status', type: 'select', options: ['ordered', 'collected', 'resulted', 'validated', 'cancelled'].map((v) => ({ value: v, label: v })) },
    { key: 'result', label: 'Result', type: 'textarea' },
    { key: 'reference_values', label: 'Reference values', type: 'textarea' },
  ];
  return <ModulePage table="lab_orders" tenantId={tenantId} title="Laboratory" desc="Lab orders and results" icon={FlaskConical} columns={cols} formFields={fields}
    pdfAction={(row) => generateLabReportPDF(activeTenant!, row as unknown as LabOrder, pMap.get(row.patient_id as string) ?? null, dMap.get(row.doctor_id as string) ?? null)} />;
}

export function RadiologyModule({ tenantId }: { tenantId: string }) {
  const { activeTenant } = useAuth();
  const { pMap, dMap } = usePatientDoctorMaps(tenantId);
  const cols: ColumnDef[] = [
    { key: 'patient_id', label: 'Patient', render: (r) => <span>{pMap.get(r.patient_id as string)?.first_name ?? '—'} {pMap.get(r.patient_id as string)?.last_name ?? ''}</span> },
    { key: 'modality', label: 'Modality' },
    { key: 'body_part', label: 'Body part' },
    { key: 'status', label: 'Status' },
  ];
  const fields: FieldDef[] = [
    { key: 'patient_id', label: 'Patient', type: 'select', required: true, options: Array.from(pMap.values()).map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` })) },
    { key: 'doctor_id', label: 'Doctor', type: 'select', options: Array.from(dMap.values()).map((d) => ({ value: d.id, label: `${d.first_name} ${d.last_name}` })) },
    { key: 'modality', label: 'Modality', required: true, type: 'select', options: ['X-Ray', 'CT', 'MRI', 'Ultrasound', 'Mammography', 'PET'].map((v) => ({ value: v, label: v })) },
    { key: 'body_part', label: 'Body part', required: true },
    { key: 'status', label: 'Status', type: 'select', options: ['ordered', 'performed', 'reported', 'validated', 'cancelled'].map((v) => ({ value: v, label: v })) },
    { key: 'report', label: 'Report', type: 'textarea' },
  ];
  return <ModulePage table="radiology_orders" tenantId={tenantId} title="Radiology" desc="Imaging orders and reports" icon={ScanLine} columns={cols} formFields={fields}
    pdfAction={(row) => generateRadiologyReportPDF(activeTenant!, row as unknown as RadiologyOrder, pMap.get(row.patient_id as string) ?? null, dMap.get(row.doctor_id as string) ?? null)} />;
}

export function PharmacyModule({ tenantId }: { tenantId: string }) {
  const crud = useCrud<{ id: string; name: string; quantity: number; reorder_level: number; unit_price: number; expiry_date: string | null }>('pharmacy_items', tenantId);
  const cols: ColumnDef[] = [
    { key: 'name', label: 'Name' },
    { key: 'generic_name', label: 'Generic' },
    { key: 'quantity', label: 'Qty', render: (r) => <Badge color={r.quantity <= r.reorder_level ? 'red' : 'green'}>{r.quantity}</Badge> },
    { key: 'unit_price', label: 'Price' },
    { key: 'expiry_date', label: 'Expiry' },
  ];
  const fields: FieldDef[] = [
    { key: 'name', label: 'Name', required: true },
    { key: 'generic_name', label: 'Generic name' },
    { key: 'form', label: 'Form', type: 'select', options: ['tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops'].map((v) => ({ value: v, label: v })) },
    { key: 'strength', label: 'Strength' },
    { key: 'batch_number', label: 'Batch number' },
    { key: 'expiry_date', label: 'Expiry date', type: 'date' },
    { key: 'quantity', label: 'Quantity', type: 'number', required: true },
    { key: 'reorder_level', label: 'Reorder level', type: 'number' },
    { key: 'unit_price', label: 'Unit price', type: 'number' },
  ];
  const lowStock = crud.rows.filter((r) => r.quantity <= r.reorder_level).length;
  return (
    <>
      {lowStock > 0 && <div className="mb-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">{lowStock} item(s) at or below reorder level</div>}
      <ModulePage table="pharmacy_items" tenantId={tenantId} title="Pharmacy" desc="Medication inventory" icon={Pill} columns={cols} formFields={fields} />
    </>
  );
}

export function BedsModule({ tenantId }: { tenantId: string }) {
  const cols: ColumnDef[] = [
    { key: 'ward', label: 'Ward' },
    { key: 'room', label: 'Room' },
    { key: 'bed_number', label: 'Bed' },
    { key: 'status', label: 'Status' },
  ];
  const fields: FieldDef[] = [
    { key: 'ward', label: 'Ward', required: true },
    { key: 'room', label: 'Room', required: true },
    { key: 'bed_number', label: 'Bed number', required: true },
    { key: 'status', label: 'Status', type: 'select', options: ['available', 'occupied', 'cleaning', 'maintenance', 'reserved'].map((v) => ({ value: v, label: v })) },
  ];
  return <ModulePage table="beds" tenantId={tenantId} title="Hospitalization" desc="Ward and bed management" icon={BedDouble} columns={cols} formFields={fields} />;
}

export function AdmissionsModule({ tenantId }: { tenantId: string }) {
  const { pMap, dMap } = usePatientDoctorMaps(tenantId);
  const cols: ColumnDef[] = [
    { key: 'patient_id', label: 'Patient', render: (r) => <span>{pMap.get(r.patient_id as string)?.first_name ?? '—'} {pMap.get(r.patient_id as string)?.last_name ?? ''}</span> },
    { key: 'admission_date', label: 'Admitted' },
    { key: 'reason', label: 'Reason' },
    { key: 'status', label: 'Status' },
  ];
  const fields: FieldDef[] = [
    { key: 'patient_id', label: 'Patient', type: 'select', required: true, options: Array.from(pMap.values()).map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` })) },
    { key: 'doctor_id', label: 'Doctor', type: 'select', options: Array.from(dMap.values()).map((d) => ({ value: d.id, label: `${d.first_name} ${d.last_name}` })) },
    { key: 'admission_date', label: 'Admission date', type: 'datetime-local', required: true },
    { key: 'reason', label: 'Reason' },
    { key: 'status', label: 'Status', type: 'select', options: ['admitted', 'discharged', 'transferred'].map((v) => ({ value: v, label: v })) },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ];
  return <ModulePage table="admissions" tenantId={tenantId} title="Admissions" desc="Patient admissions" icon={LogIn} columns={cols} formFields={fields} />;
}

export function InvoicesModule({ tenantId }: { tenantId: string }) {
  const { activeTenant } = useAuth();
  const { pMap } = usePatientDoctorMaps(tenantId);
  const cols: ColumnDef[] = [
    { key: 'invoice_number', label: 'Invoice #' },
    { key: 'patient_id', label: 'Patient', render: (r) => <span>{pMap.get(r.patient_id as string)?.first_name ?? '—'} {pMap.get(r.patient_id as string)?.last_name ?? ''}</span> },
    { key: 'issue_date', label: 'Issue date' },
    { key: 'total', label: 'Total', render: (r) => <span>${Number(r.total).toFixed(2)}</span> },
    { key: 'status', label: 'Status' },
  ];
  const fields: FieldDef[] = [
    { key: 'patient_id', label: 'Patient', type: 'select', options: Array.from(pMap.values()).map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` })) },
    { key: 'invoice_number', label: 'Invoice number', required: true },
    { key: 'issue_date', label: 'Issue date', type: 'date', required: true },
    { key: 'due_date', label: 'Due date', type: 'date' },
    { key: 'subtotal', label: 'Subtotal', type: 'number', required: true },
    { key: 'tax', label: 'Tax', type: 'number' },
    { key: 'total', label: 'Total', type: 'number', required: true },
    { key: 'status', label: 'Status', type: 'select', options: ['unpaid', 'paid', 'partial', 'cancelled', 'refunded'].map((v) => ({ value: v, label: v })) },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ];
  return <ModulePage table="invoices" tenantId={tenantId} title="Billing" desc="Invoices and payments" icon={Receipt} columns={cols} formFields={fields}
    pdfAction={(row) => generateInvoicePDF(activeTenant!, row as unknown as Invoice, pMap.get(row.patient_id as string) ?? null)} />;
}

export function StaffModule({ tenantId }: { tenantId: string }) {
  const cols: ColumnDef[] = [
    { key: 'first_name', label: 'Name', render: (r) => <span className="text-sm font-medium text-gray-900">{r.first_name} {r.last_name}</span> },
    { key: 'role', label: 'Role' },
    { key: 'department', label: 'Department' },
    { key: 'phone', label: 'Phone' },
    { key: 'status', label: 'Status' },
  ];
  const fields: FieldDef[] = [
    { key: 'first_name', label: 'First name', required: true },
    { key: 'last_name', label: 'Last name', required: true },
    { key: 'role', label: 'Role' },
    { key: 'department', label: 'Department' },
    { key: 'email', label: 'Email', type: 'text' },
    { key: 'phone', label: 'Phone' },
    { key: 'status', label: 'Status', type: 'select', options: ['active', 'suspended', 'inactive'].map((v) => ({ value: v, label: v })) },
  ];
  return <ModulePage table="staff" tenantId={tenantId} title="Staff" desc="Non-medical staff management" icon={UserCog} columns={cols} formFields={fields} />;
}

export function RolesModule({ tenantId }: { tenantId: string }) {
  const cols: ColumnDef[] = [
    { key: 'name', label: 'Role name' },
    { key: 'description', label: 'Description' },
    { key: 'is_system', label: 'System', render: (r) => (r.is_system ? <Badge color="blue">System</Badge> : <Badge>Custom</Badge>) },
  ];
  const fields: FieldDef[] = [
    { key: 'name', label: 'Role name', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
  ];
  return <ModulePage table="roles" tenantId={tenantId} title="Roles & Permissions" desc="Access control roles" icon={ShieldCheck} columns={cols} formFields={fields} />;
}
