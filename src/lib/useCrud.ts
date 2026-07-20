import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

type Row = { id: string; [k: string]: unknown };

export function useCrud<T extends Row>(table: string, tenantId: string | null) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true); setError(null);
    const { data, error } = await supabase.from(table).select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
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
    const { error } = await supabase.from(table).update(payload).eq('id', id);
    if (error) return { error: error.message };
    await load();
    return { error: null };
  };

  const remove = async (id: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) return { error: error.message };
    await load();
    return { error: null };
  };

  return { rows, loading, error, load, insert, update, remove };
}
