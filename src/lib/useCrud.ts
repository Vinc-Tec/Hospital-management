import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

type Row = { id: string; [k: string]: unknown };

/**
 * Paginated, server-side-searched CRUD for large tables (the main list
 * view in ModulePage). A tenant with tens of thousands of patients must
 * never have the browser fetch every row at once -- this fetches one
 * page (default 50 rows) at a time and lets the database do the
 * filtering via ILIKE across the given searchable columns, instead of
 * loading everything and filtering in memory.
 *
 * This is intentionally separate from useCrud below: several call sites
 * (patient/doctor/staff lookups used to populate dropdowns, the
 * prescriptions drug-interaction checker) genuinely need the complete
 * set, not a page of it, so they keep using the original useCrud.
 */
const PAGE_SIZE = 50;

export function usePaginatedCrud<T extends Row>(table: string, tenantId: string | null, searchableColumns: string[], extraFilter?: { column: string; in: string[] } | null) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!tenantId) return;
    // An extraFilter with an empty `in` list means "no rows can match"
    // (e.g. a patient-name search that matched nobody) -- short-circuit
    // rather than sending an empty .in() to Postgres, which would
    // otherwise just be dropped and silently return everything.
    if (extraFilter && extraFilter.in.length === 0) {
      setRows([]); setTotalCount(0); setLoading(false);
      return;
    }
    setLoading(true); setError(null);
    let query = supabase.from(table).select('*', { count: 'exact' }).eq('tenant_id', tenantId);
    if (extraFilter) query = query.in(extraFilter.column, extraFilter.in);
    if (search.trim() && searchableColumns.length > 0) {
      const orFilter = searchableColumns.map((col) => `${col}.ilike.%${search.trim()}%`).join(',');
      query = query.or(orFilter);
    }
    const from = page * PAGE_SIZE;
    const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, from + PAGE_SIZE - 1);
    if (error) setError(error.message);
    setRows((data as T[]) ?? []);
    setTotalCount(count ?? 0);
    setLoading(false);
  }, [table, tenantId, page, search, searchableColumns.join(','), extraFilter?.column, extraFilter?.in.join(',')]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(0); }, [search, extraFilter?.in.join(',')]);

  const insert = async (payload: Partial<T>): Promise<{ error: string | null }> => {
    if (!tenantId) return { error: 'No active tenant' };
    const { error } = await supabase.from(table).insert({ ...payload, tenant_id: tenantId });
    if (error) return { error: error.message };
    await load();
    return { error: null };
  };

  const update = async (id: string, payload: Partial<T>): Promise<{ error: string | null }> => {
    if (!tenantId) return { error: 'No active tenant' };
    const { error } = await supabase.from(table).update(payload).eq('id', id).eq('tenant_id', tenantId);
    if (error) return { error: error.message };
    await load();
    return { error: null };
  };

  const remove = async (id: string): Promise<{ error: string | null }> => {
    if (!tenantId) return { error: 'No active tenant' };
    const { error } = await supabase.from(table).delete().eq('id', id).eq('tenant_id', tenantId);
    if (error) return { error: error.message };
    await load();
    return { error: null };
  };

  return {
    rows, loading, error, insert, update, remove, load,
    search, setSearch,
    page, setPage, pageSize: PAGE_SIZE, totalCount,
    hasNextPage: (page + 1) * PAGE_SIZE < totalCount,
    hasPrevPage: page > 0,
  };
}

export function useCrud<T extends Row>(table: string, tenantId: string | null) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true); setError(null);
    const { data, error } = await supabase.from(table).select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(5000);
    if (error) setError(error.message);
    setRows((data as T[]) ?? []);
    setLoading(false);
  }, [table, tenantId]);

  useEffect(() => { load(); }, [load]);

  const insert = async (payload: Partial<T>): Promise<{ error: string | null }> => {
    if (!tenantId) return { error: 'No active tenant' };
    const { error } = await supabase.from(table).insert({ ...payload, tenant_id: tenantId });
    if (error) return { error: error.message };
    await load();
    return { error: null };
  };

  const update = async (id: string, payload: Partial<T>): Promise<{ error: string | null }> => {
    if (!tenantId) return { error: 'No active tenant' };
    const { error } = await supabase.from(table).update(payload).eq('id', id).eq('tenant_id', tenantId);
    if (error) return { error: error.message };
    await load();
    return { error: null };
  };

  const remove = async (id: string): Promise<{ error: string | null }> => {
    if (!tenantId) return { error: 'No active tenant' };
    const { error } = await supabase.from(table).delete().eq('id', id).eq('tenant_id', tenantId);
    if (error) return { error: error.message };
    await load();
    return { error: null };
  };

  return { rows, loading, error, load, insert, update, remove };
}
