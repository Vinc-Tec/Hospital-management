import { useState } from 'react';
import { Search, UserCheck, AlertTriangle, UserPlus } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { type Patient } from '../lib/supabase';
import { findPatientMatches, type PatientMatchResult } from '../lib/patientMatch';
import { Modal, Button, Input } from './ui';

/**
 * The identification layer described for Health Cloud's patient workflow:
 * search by national ID / phone / name + date of birth (the methods that
 * don't require camera or card-reader hardware), classify results as
 * exact / possible / no match using the shared matching logic in
 * patientMatch.ts, and hand the outcome back to whichever module opened
 * it. Camera/OCR and a physical ID-reader are intentionally out of scope
 * here -- both are described in the spec as just another way to fill in
 * the same national ID / name / DOB fields, so they can plug into this
 * exact same search + matching layer later without this component or
 * its matching logic needing to change.
 */
export function PatientIdentify({ tenantId, onSelectExisting, onCreateNew, onClose, mode = 'search-and-create' }: {
  tenantId: string;
  onSelectExisting: (patient: Patient) => void;
  onCreateNew?: (prefill: { national_id?: string; phone?: string; first_name?: string; last_name?: string; date_of_birth?: string }) => void;
  onClose: () => void;
  mode?: 'search-and-create' | 'search-only';
}) {
  const { t } = useI18n();
  const [nationalId, setNationalId] = useState('');
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<PatientMatchResult | null>(null);

  const hasCriteria = Boolean(nationalId.trim() || phone.trim() || (firstName.trim() && lastName.trim()) || (lastName.trim() && dateOfBirth));

  const search = async () => {
    setSearching(true);
    const res = await findPatientMatches(tenantId, { nationalId, phone, firstName, lastName, dateOfBirth });
    setResult(res);
    setSearching(false);
  };

  const PatientRow = ({ p }: { p: Patient }) => (
    <button onClick={() => onSelectExisting(p)}
      className="w-full text-left px-3.5 py-2.5 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{p.first_name} {p.last_name}</p>
        <p className="text-xs text-gray-500 mt-0.5 truncate">
          {[p.date_of_birth, p.phone, p.national_id].filter(Boolean).join(' · ') || t('id.no_extra_details')}
        </p>
      </div>
      <UserCheck size={16} className="text-blue-500 flex-shrink-0" />
    </button>
  );

  return (
    <Modal open onClose={onClose} title={t('id.title')} footer={null}>
      <div className="space-y-4">
        <p className="text-sm text-gray-500">{t('id.subtitle')}</p>
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('id.national_id')} value={nationalId} onChange={(e) => setNationalId(e.target.value)} />
          <Input label={t('col.phone')} value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input label={t('fld.firstname')} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <Input label={t('fld.lastname')} value={lastName} onChange={(e) => setLastName(e.target.value)} />
          <Input label={t('fld.dob')} type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
        </div>
        <Button onClick={search} loading={searching} disabled={!hasCriteria} className="w-full justify-center">
          <Search size={15} /> {t('id.search')}
        </Button>

        {result && (
          <div className="space-y-3 pt-1">
            {result.exact.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2 flex items-center gap-1.5"><UserCheck size={13} /> {t('id.exact_match')}</p>
                <div className="space-y-2">{result.exact.map((p) => <PatientRow key={p.id} p={p} />)}</div>
              </div>
            )}
            {result.possible.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2 flex items-center gap-1.5"><AlertTriangle size={13} /> {t('id.possible_match')}</p>
                <p className="text-xs text-gray-500 mb-2">{t('id.possible_match_hint')}</p>
                <div className="space-y-2">{result.possible.map((p) => <PatientRow key={p.id} p={p} />)}</div>
              </div>
            )}
            {result.exact.length === 0 && result.possible.length === 0 && (
              <p className="text-sm text-gray-400 py-2">{t('id.no_match')}</p>
            )}
            {mode === 'search-and-create' && onCreateNew && (
              <Button variant="outline" className="w-full justify-center" onClick={() => onCreateNew({
                national_id: nationalId.trim() || undefined, phone: phone.trim() || undefined,
                first_name: firstName.trim() || undefined, last_name: lastName.trim() || undefined,
                date_of_birth: dateOfBirth || undefined,
              })}>
                <UserPlus size={15} /> {t('id.create_new')}
              </Button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
