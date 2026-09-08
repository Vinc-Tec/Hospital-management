import { supabase, type Patient } from './supabase';

/**
 * Central patient-matching layer: the single place that decides whether
 * a set of identifying details (national ID, phone, name + DOB) points
 * at a patient who already exists. Reused everywhere a patient needs to
 * be identified (patient creation, the front-desk check-in search, and
 * -- later -- OCR/ID-reader input, per the same "feed the same central
 * mechanism" architecture requested) instead of every module rolling
 * its own ad-hoc lookup.
 *
 * Matching policy (deliberately conservative -- this only ever narrows
 * down candidates for a human to confirm, it never auto-merges or
 * auto-deletes anything):
 * - EXACT: national_id matches an existing patient exactly (a national
 *   ID is authoritative), OR phone matches AND full name matches.
 * - POSSIBLE: full name matches (regardless of DOB), OR phone matches
 *   alone, OR last name + date of birth match alone.
 * - Nothing invented: a field that wasn't provided is simply not used
 *   as a signal -- no guessing.
 */

export type PatientMatchCriteria = {
  nationalId?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  dateOfBirth?: string | null;
};

export type PatientMatchResult = { exact: Patient[]; possible: Patient[] };

const norm = (s: string | null | undefined) => (s ?? '').trim();

export async function findPatientMatches(tenantId: string, criteria: PatientMatchCriteria): Promise<PatientMatchResult> {
  const nationalId = norm(criteria.nationalId);
  const phone = norm(criteria.phone);
  const firstName = norm(criteria.firstName);
  const lastName = norm(criteria.lastName);
  const dateOfBirth = norm(criteria.dateOfBirth);

  const exactById = new Map<string, Patient>();
  const possibleById = new Map<string, Patient>();

  // National ID is authoritative: an exact hit is treated as the same
  // person regardless of anything else on the form (typos in a name
  // are common; a matching government ID number is not a coincidence).
  if (nationalId) {
    const { data } = await supabase.from('patients').select('*').eq('tenant_id', tenantId).ilike('national_id', nationalId);
    for (const p of (data as Patient[] | null) ?? []) exactById.set(p.id, p);
  }

  if (phone) {
    const { data } = await supabase.from('patients').select('*').eq('tenant_id', tenantId).ilike('phone', phone);
    for (const p of (data as Patient[] | null) ?? []) {
      const sameName = firstName && lastName
        && p.first_name.trim().toLowerCase() === firstName.toLowerCase()
        && p.last_name.trim().toLowerCase() === lastName.toLowerCase();
      if (sameName && !exactById.has(p.id)) exactById.set(p.id, p);
      else if (!exactById.has(p.id)) possibleById.set(p.id, p);
    }
  }

  if (firstName && lastName) {
    const { data } = await supabase.from('patients').select('*').eq('tenant_id', tenantId)
      .ilike('first_name', firstName).ilike('last_name', lastName);
    for (const p of (data as Patient[] | null) ?? []) {
      if (!exactById.has(p.id) && !possibleById.has(p.id)) possibleById.set(p.id, p);
    }
  } else if (lastName && dateOfBirth) {
    const { data } = await supabase.from('patients').select('*').eq('tenant_id', tenantId)
      .ilike('last_name', lastName).eq('date_of_birth', dateOfBirth);
    for (const p of (data as Patient[] | null) ?? []) {
      if (!exactById.has(p.id) && !possibleById.has(p.id)) possibleById.set(p.id, p);
    }
  }

  return { exact: [...exactById.values()], possible: [...possibleById.values()] };
}
