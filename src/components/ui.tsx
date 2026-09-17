import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Loader2, X, ChevronDown, Search, Check } from 'lucide-react';
import { detectLocalCurrency, convertFromUsd, formatCurrency } from '../lib/currency';
import { supabase, type Country } from '../lib/supabase';

export function Button({
  children, variant = 'primary', size = 'md', loading = false, disabled, className = '', type = 'button', onClick,
}: {
  children: ReactNode; variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg'; loading?: boolean; disabled?: boolean; className?: string;
  type?: 'button' | 'submit' | 'reset'; onClick?: () => void;
}) {
  const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 shadow-sm hover:shadow-md',
    secondary: 'bg-emerald-500 text-white hover:bg-emerald-600 focus:ring-emerald-400 shadow-sm',
    ghost: 'text-gray-700 hover:bg-gray-100 focus:ring-gray-300',
    outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-300 bg-white',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  };
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2.5 text-sm', lg: 'px-6 py-3 text-base' };
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}>
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}{children}
    </button>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm ${className}`}>{children}</div>;
}

export function Input({ label, error, required, className = '', ...props }: {
  label?: string; error?: string; required?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      {label && <span className="block text-sm font-medium text-gray-700 mb-1.5">{label} {required && <span className="text-red-500">*</span>}</span>}
      <input className={`w-full px-3.5 py-2.5 rounded-xl border bg-white text-gray-900 placeholder-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${error ? 'border-red-400' : 'border-gray-300'} ${className}`} {...props} />
      {error && <span className="block mt-1 text-xs text-red-600">{error}</span>}
    </label>
  );
}

// Module-level cache: the countries table (250+ rows, rarely changes)
// is fetched once and shared across every PhoneInput instance on the
// page instead of once per mounted field.
let countriesCache: Country[] | null = null;
let countriesPromise: Promise<Country[]> | null = null;
function loadCountries(): Promise<Country[]> {
  if (countriesCache) return Promise.resolve(countriesCache);
  if (!countriesPromise) {
    countriesPromise = Promise.resolve(
      supabase.from('countries').select('id,name,iso2,phone_code,currency_code,timezone').order('name')
    ).then(({ data }) => {
      countriesCache = (data as Country[] | null) ?? [];
      return countriesCache;
    });
  }
  return countriesPromise;
}

function detectDefaultIso2(): string {
  try {
    const region = navigator.language?.split('-')[1]?.toUpperCase();
    if (region) return region;
  } catch {
    // fall through
  }
  return 'US';
}

// Splits a combined "+225 0700000000" style value into its dial code
// and national number, matching against the known list of dial codes
// (longest prefix first, since e.g. +1 and +1264 both start with "1").
function splitPhoneValue(value: string, countries: Country[]): { iso2: string | null; national: string } {
  const trimmed = value.trim();
  if (!trimmed.startsWith('+') || countries.length === 0) return { iso2: null, national: trimmed };
  const digits = trimmed.slice(1);
  const withCodes = countries.filter((c) => c.phone_code);
  const sorted = [...withCodes].sort((a, b) => (b.phone_code!.length - a.phone_code!.length));
  const match = sorted.find((c) => digits.startsWith(c.phone_code!.replace('+', '')));
  if (!match) return { iso2: null, national: trimmed };
  return { iso2: match.iso2, national: digits.slice(match.phone_code!.replace('+', '').length).trim() };
}

// International phone field: a searchable country dropdown (flag +
// dial code) paired with a plain national-number input. Reports a
// single combined value ("+225 0700000000") through onChange so it
// drops into any form that currently stores phone as one string field.
export function PhoneInput({ label, error, required, value, onChange, placeholder, className = '', disabled }: {
  label?: string; error?: string; required?: boolean; value: string; onChange: (value: string) => void;
  placeholder?: string; className?: string; disabled?: boolean;
}) {
  const [countries, setCountries] = useState<Country[]>(countriesCache ?? []);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIso2, setSelectedIso2] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadCountries().then(setCountries); }, []);

  useEffect(() => {
    if (countries.length === 0) return;
    const { iso2 } = splitPhoneValue(value, countries);
    setSelectedIso2(iso2 ?? detectDefaultIso2());
  }, [countries.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) { setOpen(false); setSearch(''); }
    }
    function onEscape(e: KeyboardEvent) { if (e.key === 'Escape') { setOpen(false); setSearch(''); } }
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onEscape);
    return () => { document.removeEventListener('mousedown', onOutside); document.removeEventListener('keydown', onEscape); };
  }, []);

  const selected = countries.find((c) => c.iso2 === selectedIso2) ?? null;
  const { national } = splitPhoneValue(value, countries);

  const filtered = search.trim()
    ? countries.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.phone_code?.replace('+', '').includes(search.replace('+', '')))
    : countries;

  function commit(iso2: string | null, nationalNumber: string) {
    const country = countries.find((c) => c.iso2 === iso2);
    const code = country?.phone_code ? (country.phone_code.startsWith('+') ? country.phone_code : `+${country.phone_code}`) : '';
    onChange(nationalNumber ? `${code} ${nationalNumber}`.trim() : '');
  }

  return (
    <div className={`block ${className}`} ref={rootRef}>
      {label && <span className="block text-sm font-medium text-gray-700 mb-1.5">{label} {required && <span className="text-red-500">*</span>}</span>}
      <div className={`flex rounded-xl border bg-white transition-colors focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent ${error ? 'border-red-400' : 'border-gray-300'}`}>
        <div className="relative shrink-0">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setOpen((o) => !o)}
            className="flex h-full items-center gap-1.5 pl-3 pr-2 py-2.5 rounded-l-xl border-r border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {selected ? (
              <img src={`https://flagcdn.com/w40/${selected.iso2.toLowerCase()}.png`} alt="" className="w-5 h-3.5 object-cover rounded-[2px]" />
            ) : <span className="w-5 h-3.5" />}
            <span className="tabular-nums">{selected?.phone_code ? (selected.phone_code.startsWith('+') ? selected.phone_code : `+${selected.phone_code}`) : ''}</span>
            <ChevronDown size={14} className="text-gray-400" />
          </button>
          {open && (
            <div className="absolute z-30 mt-1 w-72 max-h-80 overflow-hidden flex flex-col rounded-xl border border-gray-200 bg-white shadow-lg">
              <div className="p-2 border-b border-gray-100">
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gray-50">
                  <Search size={14} className="text-gray-400 shrink-0" />
                  <input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher un pays ou indicatif..."
                    className="w-full bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
                  />
                </div>
              </div>
              <div className="overflow-y-auto">
                {filtered.length === 0 && <p className="px-3 py-4 text-sm text-gray-400 text-center">Aucun résultat</p>}
                {filtered.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setSelectedIso2(c.iso2); commit(c.iso2, national); setOpen(false); setSearch(''); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    <img src={`https://flagcdn.com/w40/${c.iso2.toLowerCase()}.png`} alt="" className="w-5 h-3.5 object-cover rounded-[2px] shrink-0" />
                    <span className="flex-1 truncate text-gray-700">{c.name}</span>
                    <span className="text-gray-400 tabular-nums">{c.phone_code ? (c.phone_code.startsWith('+') ? c.phone_code : `+${c.phone_code}`) : ''}</span>
                    {c.iso2 === selectedIso2 && <Check size={14} className="text-blue-600 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <input
          type="tel"
          inputMode="tel"
          disabled={disabled}
          value={national}
          onChange={(e) => commit(selectedIso2, e.target.value)}
          placeholder={placeholder ?? '07 00 00 00 00'}
          className="w-full min-w-0 px-3.5 py-2.5 rounded-r-xl bg-transparent text-gray-900 placeholder-gray-400 focus:outline-none disabled:cursor-not-allowed"
        />
      </div>
      {error && <span className="block mt-1 text-xs text-red-600">{error}</span>}
    </div>
  );
}

export function Textarea({ label, error, required, className = '', ...props }: {
  label?: string; error?: string; required?: boolean;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block">
      {label && <span className="block text-sm font-medium text-gray-700 mb-1.5">{label} {required && <span className="text-red-500">*</span>}</span>}
      <textarea className={`w-full px-3.5 py-2.5 rounded-xl border bg-white text-gray-900 placeholder-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${error ? 'border-red-400' : 'border-gray-300'} ${className}`} {...props} />
      {error && <span className="block mt-1 text-xs text-red-600">{error}</span>}
    </label>
  );
}

export function Select({ label, error, required, options, placeholder, loading, className = '', ...props }: {
  label?: string; error?: string; required?: boolean; options: { value: string; label: string }[];
  placeholder?: string; loading?: boolean;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block">
      {label && <span className="block text-sm font-medium text-gray-700 mb-1.5">{label} {required && <span className="text-red-500">*</span>}</span>}
      <select className={`w-full px-3.5 py-2.5 rounded-xl border bg-white text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed ${error ? 'border-red-400' : 'border-gray-300'} ${className}`} disabled={loading || options.length === 0 || props.disabled} {...props}>
        <option value="">{loading ? '...' : placeholder ?? '...'}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <span className="block mt-1 text-xs text-red-600">{error}</span>}
    </label>
  );
}

export function Badge({ children, color = 'gray' }: { children: ReactNode; color?: 'gray' | 'green' | 'amber' | 'red' | 'blue' }) {
  const colors = { gray: 'bg-gray-100 text-gray-700', green: 'bg-emerald-100 text-emerald-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', blue: 'bg-blue-100 text-blue-700' };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[color]}`}>{children}</span>;
}

export function Modal({ open, onClose, title, children, footer }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-w-lg w-full max-h-[90vh] overflow-auto bg-white rounded-2xl border border-gray-200 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-2 sticky bottom-0 bg-white rounded-b-2xl">{footer}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, desc }: { icon: typeof Loader2; title: string; desc?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3"><Icon size={22} className="text-gray-400" /></div>
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {desc && <p className="text-xs text-gray-400 mt-1 max-w-xs">{desc}</p>}
    </div>
  );
}

export function PageHeader({ title, desc, action }: { title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6 gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        {desc && <p className="text-sm text-gray-500 mt-1">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

// Shows an indicative local-currency conversion under a USD price.
// Purely informational: the amount actually charged is always the
// stored USD price, converted by the payment gateway at checkout --
// this component never affects billing.
export function ConvertedPriceHint({ usd, className }: { usd: number; className?: string }) {
  const [display, setDisplay] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const currency = detectLocalCurrency();
    if (currency === 'USD') return;
    convertFromUsd(usd, currency).then((result) => {
      if (!cancelled && result) setDisplay(formatCurrency(result.amount, result.currency));
    });
    return () => { cancelled = true; };
  }, [usd]);

  if (!display) return null;
  return <p className={className ?? 'text-xs text-gray-400 mt-0.5'}>≈ {display}</p>;
}
