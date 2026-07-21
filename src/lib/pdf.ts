import { jsPDF } from 'jspdf';
import type { Tenant, Invoice, Patient, Doctor, Prescription, LabOrder, RadiologyOrder, MedicalRecord } from './supabase';

const BLUE: [number, number, number] = [37, 99, 235];
const GREEN: [number, number, number] = [16, 185, 129];
const DARK: [number, number, number] = [17, 24, 39];
const GRAY: [number, number, number] = [107, 114, 128];

function header(doc: jsPDF, tenant: Tenant, title: string, ref: string) {
  const pageW = doc.internal.pageSize.getWidth();
  // Header band
  doc.setFillColor(...BLUE);
  doc.rect(0, 0, pageW, 28, 'F');
  // Logo mark
  doc.setFillColor(...GREEN);
  doc.roundedRect(14, 8, 12, 12, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('HC', 20, 16, { align: 'center' });
  // Title
  doc.setFontSize(16);
  doc.text(title, 32, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Health Cloud — LIYAH GROUP', 32, 21);
  // Reference + date (right)
  doc.setFontSize(9);
  doc.text(`Ref: ${ref}`, pageW - 14, 14, { align: 'right' });
  doc.text(`Date: ${new Date().toLocaleDateString()}`, pageW - 14, 21, { align: 'right' });

  // Institution block
  let y = 40;
  doc.setTextColor(...DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(tenant.commercial_name || tenant.legal_name, 14, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  y += 5;
  doc.text(tenant.healthcare_type, 14, y);
  y += 4;
  if (tenant.address) { doc.text(tenant.address, 14, y); y += 4; }
  doc.text(`${tenant.email}  ${tenant.phone || ''}`, 14, y);
  y += 4;
  if (tenant.medical_license) { doc.text(`Medical license: ${tenant.medical_license}`, 14, y); y += 4; }

  // Divider
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.5);
  doc.line(14, y + 2, pageW - 14, y + 2);
  return y + 8;
}

function footer(doc: jsPDF) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(14, pageH - 16, pageW - 14, pageH - 16);
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  doc.text('Developed by LIYAH GROUP — 100% Cameroonian Technology', 14, pageH - 11);
  doc.text('Health Cloud — One Platform. Every Healthcare Institution.', pageW - 14, pageH - 11, { align: 'right' });
  // QR-ish placeholder block (simple square with ref)
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(`Page ${i} / ${pages}`, doc.internal.pageSize.getWidth() / 2, pageH - 11, { align: 'center' });
  }
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + needed > pageH - 24) {
    doc.addPage();
    return 40;
  }
  return y;
}

function sectionTitle(doc: jsPDF, y: number, label: string): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...BLUE);
  doc.text(label, 14, y);
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.3);
  const pageW = doc.internal.pageSize.getWidth();
  doc.line(14, y + 1.5, pageW - 14, y + 1.5);
  return y + 6;
}

function field(doc: jsPDF, y: number, label: string, value: string, x = 14, w = 90): number {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(label, x, y);
  doc.setTextColor(...DARK);
  doc.setFont('helvetica', 'bold');
  const lines = doc.splitTextToSize(value || '—', w);
  doc.text(lines, x, y + 5);
  return y + 5 + lines.length * 4.5;
}

export function generateInvoicePDF(tenant: Tenant, invoice: Invoice, patient?: Patient | null) {
  const doc = new jsPDF();
  let y = header(doc, tenant, 'INVOICE', invoice.invoice_number);
  y = sectionTitle(doc, y, 'Invoice details');
  y = field(doc, y, 'Invoice #', invoice.invoice_number);
  y = field(doc, y, 'Issue date', new Date(invoice.issue_date).toLocaleDateString());
  if (invoice.due_date) y = field(doc, y, 'Due date', new Date(invoice.due_date).toLocaleDateString());
  y = field(doc, y, 'Status', invoice.status.toUpperCase());
  y += 4;
  if (patient) {
    y = sectionTitle(doc, y, 'Patient');
    y = field(doc, y, 'Name', `${patient.first_name} ${patient.last_name}`);
    if (patient.phone) y = field(doc, y, 'Phone', patient.phone);
  y += 4;
  }
  y = sectionTitle(doc, y, 'Amounts');
  y = field(doc, y, 'Subtotal', `$${invoice.subtotal.toFixed(2)}`);
  y = field(doc, y, 'Tax', `$${invoice.tax.toFixed(2)}`);
  y = field(doc, y, 'Total', `$${invoice.total.toFixed(2)}`);
  if (invoice.notes) {
    y += 4;
    y = ensureSpace(doc, y, 20);
    y = sectionTitle(doc, y, 'Notes');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    const notes = doc.splitTextToSize(invoice.notes, 180);
    doc.text(notes, 14, y);
    y += notes.length * 5;
  }
  // Signature line
  y = ensureSpace(doc, y, 24);
  y += 16;
  doc.setDrawColor(...GRAY);
  doc.line(14, y, 80, y);
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text('Authorized signature', 14, y + 4);
  footer(doc);
  doc.save(`invoice-${invoice.invoice_number}.pdf`);
}

export function generatePrescriptionPDF(tenant: Tenant, rx: Prescription, patient?: Patient | null, doctor?: Doctor | null) {
  const doc = new jsPDF();
  let y = header(doc, tenant, 'PRESCRIPTION', rx.id.slice(0, 8).toUpperCase());
  y = sectionTitle(doc, y, 'Patient');
  if (patient) {
    y = field(doc, y, 'Name', `${patient.first_name} ${patient.last_name}`);
    if (patient.date_of_birth) y = field(doc, y, 'Date of birth', new Date(patient.date_of_birth).toLocaleDateString());
    if (patient.phone) y = field(doc, y, 'Phone', patient.phone);
  } else {
    y = field(doc, y, 'Patient', '—');
  }
  y += 4;
  if (doctor) {
    y = sectionTitle(doc, y, 'Prescribed by');
    y = field(doc, y, 'Doctor', `${doctor.first_name} ${doctor.last_name}`);
    if (doctor.specialty) y = field(doc, y, 'Specialty', doctor.specialty);
    y += 4;
  }
  y = sectionTitle(doc, y, 'Medication');
  y = field(doc, y, 'Medication', rx.medication, 14, 180);
  if (rx.dosage) y = field(doc, y, 'Dosage', rx.dosage, 14, 180);
  if (rx.frequency) y = field(doc, y, 'Frequency', rx.frequency, 14, 180);
  if (rx.duration) y = field(doc, y, 'Duration', rx.duration, 14, 180);
  if (rx.notes) {
    y += 2;
    y = ensureSpace(doc, y, 16);
    y = field(doc, y, 'Notes', rx.notes, 14, 180);
  }
  y = ensureSpace(doc, y, 24);
  y += 16;
  doc.setDrawColor(...GRAY);
  doc.line(14, y, 80, y);
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text('Doctor signature', 14, y + 4);
  footer(doc);
  doc.save(`prescription-${rx.id.slice(0, 8)}.pdf`);
}

export function generateLabReportPDF(tenant: Tenant, lab: LabOrder, patient?: Patient | null, doctor?: Doctor | null) {
  const doc = new jsPDF();
  let y = header(doc, tenant, 'LABORATORY REPORT', lab.id.slice(0, 8).toUpperCase());
  y = sectionTitle(doc, y, 'Patient');
  if (patient) {
    y = field(doc, y, 'Name', `${patient.first_name} ${patient.last_name}`);
    if (patient.phone) y = field(doc, y, 'Phone', patient.phone);
  } else { y = field(doc, y, 'Patient', '—'); }
  y += 4;
  y = sectionTitle(doc, y, 'Test');
  y = field(doc, y, 'Test name', lab.test_name, 14, 180);
  if (lab.test_code) y = field(doc, y, 'Test code', lab.test_code);
  y = field(doc, y, 'Ordered', new Date(lab.ordered_at).toLocaleDateString());
  if (lab.resulted_at) y = field(doc, y, 'Resulted', new Date(lab.resulted_at).toLocaleDateString());
  y = field(doc, y, 'Status', lab.status.toUpperCase());
  y += 4;
  if (lab.result) {
    y = sectionTitle(doc, y, 'Result');
    y = field(doc, y, 'Result', lab.result, 14, 180);
  }
  if (lab.reference_values) {
    y = field(doc, y, 'Reference values', lab.reference_values, 14, 180);
  }
  if (doctor) {
    y += 4;
    y = sectionTitle(doc, y, 'Ordered by');
    y = field(doc, y, 'Doctor', `${doctor.first_name} ${doctor.last_name}`);
  }
  y = ensureSpace(doc, y, 24);
  y += 16;
  doc.setDrawColor(...GRAY);
  doc.line(14, y, 80, y);
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text('Lab technician signature', 14, y + 4);
  footer(doc);
  doc.save(`lab-report-${lab.id.slice(0, 8)}.pdf`);
}

export function generateRadiologyReportPDF(tenant: Tenant, rad: RadiologyOrder, patient?: Patient | null, doctor?: Doctor | null) {
  const doc = new jsPDF();
  let y = header(doc, tenant, 'RADIOLOGY REPORT', rad.id.slice(0, 8).toUpperCase());
  y = sectionTitle(doc, y, 'Patient');
  if (patient) {
    y = field(doc, y, 'Name', `${patient.first_name} ${patient.last_name}`);
  } else { y = field(doc, y, 'Patient', '—'); }
  y += 4;
  y = sectionTitle(doc, y, 'Examination');
  y = field(doc, y, 'Modality', rad.modality);
  y = field(doc, y, 'Body part', rad.body_part, 14, 180);
  y = field(doc, y, 'Ordered', new Date(rad.ordered_at).toLocaleDateString());
  y = field(doc, y, 'Status', rad.status.toUpperCase());
  y += 4;
  if (rad.report) {
    y = sectionTitle(doc, y, 'Report');
    y = field(doc, y, 'Findings', rad.report, 14, 180);
  }
  if (doctor) {
    y += 4;
    y = sectionTitle(doc, y, 'Ordered by');
    y = field(doc, y, 'Doctor', `${doctor.first_name} ${doctor.last_name}`);
  }
  y = ensureSpace(doc, y, 24);
  y += 16;
  doc.setDrawColor(...GRAY);
  doc.line(14, y, 80, y);
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text('Radiologist signature', 14, y + 4);
  footer(doc);
  doc.save(`radiology-report-${rad.id.slice(0, 8)}.pdf`);
}

export function generateMedicalRecordPDF(tenant: Tenant, mr: MedicalRecord, patient?: Patient | null, doctor?: Doctor | null) {
  const doc = new jsPDF();
  let y = header(doc, tenant, 'MEDICAL RECORD', mr.id.slice(0, 8).toUpperCase());
  y = sectionTitle(doc, y, 'Patient');
  if (patient) {
    y = field(doc, y, 'Name', `${patient.first_name} ${patient.last_name}`);
    if (patient.date_of_birth) y = field(doc, y, 'DOB', new Date(patient.date_of_birth).toLocaleDateString());
    if (patient.blood_group) y = field(doc, y, 'Blood group', patient.blood_group);
  } else { y = field(doc, y, 'Patient', '—'); }
  y += 4;
  y = sectionTitle(doc, y, 'Encounter');
  y = field(doc, y, 'Date', new Date(mr.record_date).toLocaleDateString());
  if (mr.chief_complaint) y = field(doc, y, 'Chief complaint', mr.chief_complaint, 14, 180);
  if (mr.history) y = field(doc, y, 'History', mr.history, 14, 180);
  if (mr.examination) y = field(doc, y, 'Examination', mr.examination, 14, 180);
  if (mr.diagnosis) y = field(doc, y, 'Diagnosis', mr.diagnosis, 14, 180);
  if (mr.icd10_code) y = field(doc, y, 'ICD-10', mr.icd10_code);
  if (mr.notes) y = field(doc, y, 'Notes', mr.notes, 14, 180);
  if (doctor) {
    y += 4;
    y = sectionTitle(doc, y, 'Attending physician');
    y = field(doc, y, 'Doctor', `${doctor.first_name} ${doctor.last_name}`);
  }
  y = ensureSpace(doc, y, 24);
  y += 16;
  doc.setDrawColor(...GRAY);
  doc.line(14, y, 80, y);
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text('Physician signature', 14, y + 4);
  footer(doc);
  doc.save(`medical-record-${mr.id.slice(0, 8)}.pdf`);
}

export function generateGenericReportPDF(tenant: Tenant, report: { title: string; report_type: string; content: string; created_at: string; metadata?: Record<string, unknown> | null }) {
  const doc = new jsPDF();
  let y = header(doc, tenant, 'REPORT', report.title.slice(0, 20).toUpperCase());
  y = sectionTitle(doc, y, 'Report info');
  y = field(doc, y, 'Title', report.title, 14, 180);
  y = field(doc, y, 'Type', report.report_type);
  y = field(doc, y, 'Date', new Date(report.created_at).toLocaleDateString());
  y += 4;
  y = sectionTitle(doc, y, 'Content');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  const lines = doc.splitTextToSize(report.content || '—', 180);
  y = ensureSpace(doc, y, lines.length * 5);
  doc.text(lines, 14, y);
  y += lines.length * 5;
  if (report.metadata && Object.keys(report.metadata).length > 0) {
    y += 4;
    y = sectionTitle(doc, y, 'Metadata');
    for (const [k, v] of Object.entries(report.metadata)) {
      y = field(doc, y, k, String(v), 14, 180);
    }
  }
  y = ensureSpace(doc, y, 24);
  y += 16;
  doc.setDrawColor(...GRAY);
  doc.line(14, y, 80, y);
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text('Authorized signature', 14, y + 4);
  footer(doc);
  doc.save(`report-${report.title.slice(0, 20).replace(/\s/g, '-')}.pdf`);
}
