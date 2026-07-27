import {
  Scissors, Briefcase, CalendarOff, Wallet, Boxes, ShieldPlus, Video, Siren, Syringe, FileOutput,
} from 'lucide-react';
import { ModulePage, type ColumnDef, type FieldDef } from '../components/ModulePage';
import { useCrud } from '../lib/useCrud';
import { useI18n } from '../lib/i18n';
import { supabase, type Patient, type Doctor, type Staff } from '../lib/supabase';
import { useState, useEffect } from 'react';

const statusOpts = (keys: string[], t: (k: string) => string) =>
  keys.map((k) => ({ value: k, label: t(`opt.${k}`) }));

function usePatientMap(tenantId: string) {
  const patients = useCrud<Patient>('patients', tenantId);
  return new Map(patients.rows.map((p) => [p.id, p]));
}
function useDoctorMap(tenantId: string) {
  const doctors = useCrud<Doctor>('doctors', tenantId);
  return new Map(doctors.rows.map((d) => [d.id, d]));
}
function useStaffMap(tenantId: string) {
  const staff = useCrud<Staff>('staff', tenantId);
  return new Map(staff.rows.map((s) => [s.id, s]));
}

// ---------- 1. Operating Room / Surgeries ----------
export function SurgeriesModule({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const pMap = usePatientMap(tenantId);
  const dMap = useDoctorMap(tenantId);
  const cols: ColumnDef[] = [
    { key: 'patient_id', label: t('col.patient'), render: (r) => pMap.get(r.patient_id) ? `${pMap.get(r.patient_id)!.first_name} ${pMap.get(r.patient_id)!.last_name}` : '—' },
    { key: 'procedure_name', label: t('col.procedure') },
    { key: 'operating_room', label: t('fld.operating_room') },
    { key: 'surgeon_id', label: t('fld.surgeon'), render: (r) => r.surgeon_id && dMap.get(r.surgeon_id) ? `${dMap.get(r.surgeon_id)!.first_name} ${dMap.get(r.surgeon_id)!.last_name}` : '—' },
    { key: 'scheduled_at', label: t('col.scheduled') },
    { key: 'status', label: t('col.status') },
  ];
  const fields: FieldDef[] = [
    { key: 'patient_id', label: t('col.patient'), type: 'select', required: true, options: [...pMap.values()].map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` })) },
    { key: 'surgeon_id', label: t('fld.surgeon'), type: 'select', options: [...dMap.values()].map((d) => ({ value: d.id, label: `${d.first_name} ${d.last_name}` })) },
    { key: 'procedure_name', label: t('fld.procedure_name'), required: true },
    { key: 'operating_room', label: t('fld.operating_room'), required: true },
    { key: 'scheduled_at', label: t('fld.scheduled_at'), type: 'datetime-local', required: true },
    { key: 'duration_minutes', label: t('fld.duration'), type: 'number' },
    { key: 'status', label: t('col.status'), type: 'select', options: statusOpts(['scheduled', 'in_progress', 'completed', 'cancelled', 'postponed'], t) },
    { key: 'notes', label: t('fld.notes'), type: 'textarea' },
  ];
  return <ModulePage table="surgeries" tenantId={tenantId} title={t('mod.surgeries.title')} desc={t('mod.surgeries.desc')} icon={Scissors} columns={cols} formFields={fields} />;
}

// ---------- 2. HR (employee records) ----------
export function HRModule({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const sMap = useStaffMap(tenantId);
  const cols: ColumnDef[] = [
    { key: 'staff_id', label: t('col.name'), render: (r) => sMap.get(r.staff_id) ? `${sMap.get(r.staff_id)!.first_name} ${sMap.get(r.staff_id)!.last_name}` : '—' },
    { key: 'contract_type', label: t('fld.contract_type') },
    { key: 'hire_date', label: t('fld.hire_date') },
    { key: 'base_salary', label: t('fld.base_salary') },
    { key: 'currency', label: t('fld.currency') },
  ];
  const fields: FieldDef[] = [
    { key: 'staff_id', label: t('col.name'), type: 'select', required: true, options: [...sMap.values()].map((s) => ({ value: s.id, label: `${s.first_name} ${s.last_name}` })) },
    { key: 'contract_type', label: t('fld.contract_type'), type: 'select', options: statusOpts(['full_time', 'part_time', 'contractor', 'intern'], t) },
    { key: 'hire_date', label: t('fld.hire_date'), type: 'date', required: true },
    { key: 'termination_date', label: t('fld.termination_date'), type: 'date' },
    { key: 'base_salary', label: t('fld.base_salary'), type: 'number' },
    { key: 'currency', label: t('fld.currency') },
    { key: 'emergency_contact', label: t('fld.emergency_contact') },
    { key: 'notes', label: t('fld.notes'), type: 'textarea' },
  ];
  return <ModulePage table="employee_records" tenantId={tenantId} title={t('mod.hr.title')} desc={t('mod.hr.desc')} icon={Briefcase} columns={cols} formFields={fields} />;
}

// ---------- 3. Leave requests (part of HR) ----------
export function LeaveModule({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const sMap = useStaffMap(tenantId);
  const cols: ColumnDef[] = [
    { key: 'staff_id', label: t('col.name'), render: (r) => sMap.get(r.staff_id) ? `${sMap.get(r.staff_id)!.first_name} ${sMap.get(r.staff_id)!.last_name}` : '—' },
    { key: 'leave_type', label: t('fld.leave_type') },
    { key: 'start_date', label: t('fld.start_date') },
    { key: 'end_date', label: t('fld.end_date') },
    { key: 'status', label: t('col.status') },
  ];
  const fields: FieldDef[] = [
    { key: 'staff_id', label: t('col.name'), type: 'select', required: true, options: [...sMap.values()].map((s) => ({ value: s.id, label: `${s.first_name} ${s.last_name}` })) },
    { key: 'leave_type', label: t('fld.leave_type'), type: 'select', options: statusOpts(['annual', 'sick', 'maternity', 'paternity', 'unpaid', 'other'], t) },
    { key: 'start_date', label: t('fld.start_date'), type: 'date', required: true },
    { key: 'end_date', label: t('fld.end_date'), type: 'date', required: true },
    { key: 'status', label: t('col.status'), type: 'select', options: statusOpts(['pending', 'approved', 'rejected', 'cancelled'], t) },
    { key: 'reason', label: t('col.reason'), type: 'textarea' },
  ];
  return <ModulePage table="leave_requests" tenantId={tenantId} title={t('mod.leave.title')} desc={t('mod.leave.desc')} icon={CalendarOff} columns={cols} formFields={fields} />;
}

// ---------- 4. Payroll ----------
export function PayrollModule({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const sMap = useStaffMap(tenantId);
  const cols: ColumnDef[] = [
    { key: 'staff_id', label: t('col.name'), render: (r) => sMap.get(r.staff_id) ? `${sMap.get(r.staff_id)!.first_name} ${sMap.get(r.staff_id)!.last_name}` : '—' },
    { key: 'period_month', label: t('fld.period_month') },
    { key: 'gross_salary', label: t('fld.gross_salary') },
    { key: 'net_salary', label: t('fld.net_salary') },
    { key: 'status', label: t('col.status') },
  ];
  const fields: FieldDef[] = [
    { key: 'staff_id', label: t('col.name'), type: 'select', required: true, options: [...sMap.values()].map((s) => ({ value: s.id, label: `${s.first_name} ${s.last_name}` })) },
    { key: 'period_month', label: t('fld.period_month'), type: 'date', required: true },
    { key: 'gross_salary', label: t('fld.gross_salary'), type: 'number', required: true },
    { key: 'deductions', label: t('fld.deductions'), type: 'number' },
    { key: 'net_salary', label: t('fld.net_salary'), type: 'number', required: true },
    { key: 'status', label: t('col.status'), type: 'select', options: statusOpts(['draft', 'approved', 'paid'], t) },
    { key: 'notes', label: t('fld.notes'), type: 'textarea' },
  ];
  return <ModulePage table="payslips" tenantId={tenantId} title={t('mod.payroll.title')} desc={t('mod.payroll.desc')} icon={Wallet} columns={cols} formFields={fields} />;
}

// ---------- 5. General inventory ----------
export function InventoryModule({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const cols: ColumnDef[] = [
    { key: 'name', label: t('col.name') },
    { key: 'category', label: t('col.category') },
    { key: 'quantity', label: t('col.qty_short') },
    { key: 'unit_price', label: t('col.price') },
    { key: 'location', label: t('fld.location') },
  ];
  const fields: FieldDef[] = [
    { key: 'name', label: t('fld.name'), required: true },
    { key: 'category', label: t('fld.category'), type: 'select', options: statusOpts(['equipment', 'consumable', 'furniture', 'it', 'other'], t) },
    { key: 'sku', label: t('fld.sku') },
    { key: 'quantity', label: t('fld.quantity'), type: 'number' },
    { key: 'reorder_level', label: t('fld.reorder_level'), type: 'number' },
    { key: 'unit_price', label: t('fld.unit_price'), type: 'number' },
    { key: 'location', label: t('fld.location') },
  ];
  return <ModulePage table="inventory_items" tenantId={tenantId} title={t('mod.inventory.title')} desc={t('mod.inventory.desc')} icon={Boxes} columns={cols} formFields={fields} />;
}

// ---------- 6. Insurance claims ----------
export function InsuranceModule({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const pMap = usePatientMap(tenantId);
  const cols: ColumnDef[] = [
    { key: 'patient_id', label: t('col.patient'), render: (r) => pMap.get(r.patient_id) ? `${pMap.get(r.patient_id)!.first_name} ${pMap.get(r.patient_id)!.last_name}` : '—' },
    { key: 'provider_name', label: t('col.provider') },
    { key: 'claim_amount', label: t('col.claim_amount') },
    { key: 'status', label: t('col.status') },
  ];
  const fields: FieldDef[] = [
    { key: 'patient_id', label: t('col.patient'), type: 'select', required: true, options: [...pMap.values()].map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` })) },
    { key: 'provider_name', label: t('fld.provider_name'), required: true },
    { key: 'policy_number', label: t('fld.policy_number') },
    { key: 'claim_amount', label: t('fld.claim_amount'), type: 'number', required: true },
    { key: 'approved_amount', label: t('fld.approved_amount'), type: 'number' },
    { key: 'status', label: t('col.status'), type: 'select', options: statusOpts(['submitted', 'under_review', 'approved', 'rejected', 'paid'], t) },
    { key: 'notes', label: t('fld.notes'), type: 'textarea' },
  ];
  return <ModulePage table="insurance_claims" tenantId={tenantId} title={t('mod.insurance.title')} desc={t('mod.insurance.desc')} icon={ShieldPlus} columns={cols} formFields={fields} />;
}

// ---------- 7. Telemedicine ----------
export function TelemedicineModule({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const pMap = usePatientMap(tenantId);
  const dMap = useDoctorMap(tenantId);
  const cols: ColumnDef[] = [
    { key: 'patient_id', label: t('col.patient'), render: (r) => pMap.get(r.patient_id) ? `${pMap.get(r.patient_id)!.first_name} ${pMap.get(r.patient_id)!.last_name}` : '—' },
    { key: 'doctor_id', label: t('col.doctor'), render: (r) => r.doctor_id && dMap.get(r.doctor_id) ? `${dMap.get(r.doctor_id)!.first_name} ${dMap.get(r.doctor_id)!.last_name}` : '—' },
    { key: 'scheduled_at', label: t('col.scheduled') },
    { key: 'status', label: t('col.status') },
  ];
  const fields: FieldDef[] = [
    { key: 'patient_id', label: t('col.patient'), type: 'select', required: true, options: [...pMap.values()].map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` })) },
    { key: 'doctor_id', label: t('col.doctor'), type: 'select', options: [...dMap.values()].map((d) => ({ value: d.id, label: `${d.first_name} ${d.last_name}` })) },
    { key: 'scheduled_at', label: t('fld.scheduled_at'), type: 'datetime-local', required: true },
    { key: 'video_link', label: t('fld.video_link') },
    { key: 'status', label: t('col.status'), type: 'select', options: statusOpts(['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'], t) },
    { key: 'notes', label: t('fld.notes'), type: 'textarea' },
  ];
  return <ModulePage table="telemedicine_sessions" tenantId={tenantId} title={t('mod.telemedicine.title')} desc={t('mod.telemedicine.desc')} icon={Video} columns={cols} formFields={fields} />;
}

// ---------- 8. Emergency / triage ----------
export function EmergencyModule({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const pMap = usePatientMap(tenantId);
  const cols: ColumnDef[] = [
    { key: 'patient_id', label: t('col.patient'), render: (r) => r.patient_id && pMap.get(r.patient_id) ? `${pMap.get(r.patient_id)!.first_name} ${pMap.get(r.patient_id)!.last_name}` : (r.walk_in_name || '—') },
    { key: 'triage_level', label: t('col.triage') },
    { key: 'chief_complaint', label: t('fld.chief_complaint') },
    { key: 'status', label: t('col.status') },
  ];
  const fields: FieldDef[] = [
    { key: 'patient_id', label: t('col.patient'), type: 'select', options: [...pMap.values()].map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` })) },
    { key: 'walk_in_name', label: t('fld.walk_in_name') },
    { key: 'triage_level', label: t('fld.triage_level'), type: 'select', required: true, options: statusOpts(['critical', 'urgent', 'standard', 'minor'], t) },
    { key: 'chief_complaint', label: t('fld.chief_complaint'), required: true, type: 'textarea' },
    { key: 'status', label: t('col.status'), type: 'select', options: statusOpts(['waiting', 'in_treatment', 'admitted', 'discharged', 'deceased', 'transferred'], t) },
    { key: 'notes', label: t('fld.notes'), type: 'textarea' },
  ];
  return <ModulePage table="emergency_cases" tenantId={tenantId} title={t('mod.emergency.title')} desc={t('mod.emergency.desc')} icon={Siren} columns={cols} formFields={fields} />;
}

// ---------- 9. Immunizations ----------
export function ImmunizationsModule({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const pMap = usePatientMap(tenantId);
  const dMap = useDoctorMap(tenantId);
  const cols: ColumnDef[] = [
    { key: 'patient_id', label: t('col.patient'), render: (r) => pMap.get(r.patient_id) ? `${pMap.get(r.patient_id)!.first_name} ${pMap.get(r.patient_id)!.last_name}` : '—' },
    { key: 'vaccine_name', label: t('col.vaccine') },
    { key: 'dose_number', label: t('fld.dose_number') },
    { key: 'date_administered', label: t('fld.date_administered') },
    { key: 'next_due_date', label: t('fld.next_due_date') },
  ];
  const fields: FieldDef[] = [
    { key: 'patient_id', label: t('col.patient'), type: 'select', required: true, options: [...pMap.values()].map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` })) },
    { key: 'vaccine_name', label: t('fld.vaccine_name'), required: true },
    { key: 'dose_number', label: t('fld.dose_number'), type: 'number' },
    { key: 'date_administered', label: t('fld.date_administered'), type: 'date', required: true },
    { key: 'next_due_date', label: t('fld.next_due_date'), type: 'date' },
    { key: 'administered_by', label: t('fld.surgeon'), type: 'select', options: [...dMap.values()].map((d) => ({ value: d.id, label: `${d.first_name} ${d.last_name}` })) },
    { key: 'notes', label: t('fld.notes'), type: 'textarea' },
  ];
  return <ModulePage table="immunizations" tenantId={tenantId} title={t('mod.immunizations.title')} desc={t('mod.immunizations.desc')} icon={Syringe} columns={cols} formFields={fields} />;
}

// ---------- 10. Discharge summaries ----------
export function DischargeModule({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const pMap = usePatientMap(tenantId);
  const dMap = useDoctorMap(tenantId);
  const cols: ColumnDef[] = [
    { key: 'patient_id', label: t('col.patient'), render: (r) => pMap.get(r.patient_id) ? `${pMap.get(r.patient_id)!.first_name} ${pMap.get(r.patient_id)!.last_name}` : '—' },
    { key: 'doctor_id', label: t('col.doctor'), render: (r) => r.doctor_id && dMap.get(r.doctor_id) ? `${dMap.get(r.doctor_id)!.first_name} ${dMap.get(r.doctor_id)!.last_name}` : '—' },
    { key: 'discharged_at', label: t('fld.discharged_at') },
    { key: 'referral_to', label: t('fld.referral_to') },
  ];
  const fields: FieldDef[] = [
    { key: 'patient_id', label: t('col.patient'), type: 'select', required: true, options: [...pMap.values()].map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` })) },
    { key: 'doctor_id', label: t('col.doctor'), type: 'select', options: [...dMap.values()].map((d) => ({ value: d.id, label: `${d.first_name} ${d.last_name}` })) },
    { key: 'summary', label: t('fld.summary'), required: true, type: 'textarea' },
    { key: 'follow_up_instructions', label: t('fld.follow_up'), type: 'textarea' },
    { key: 'referral_to', label: t('fld.referral_to') },
    { key: 'discharged_at', label: t('fld.discharged_at'), type: 'datetime-local' },
  ];
  return <ModulePage table="discharge_summaries" tenantId={tenantId} title={t('mod.discharge.title')} desc={t('mod.discharge.desc')} icon={FileOutput} columns={cols} formFields={fields} />;
}
