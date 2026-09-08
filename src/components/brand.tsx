import { useI18n, SUPPORTED_LANGUAGES } from '../lib/i18n';
import logoMark from '../assets/logo-mark.png';

export function Logo({ size = 36, variant = 'light' }: { size?: number; variant?: 'light' | 'dark' }) {
  const s = size;
  return (
    <div className="flex items-center gap-2.5 select-none">
      <img src={logoMark} alt="Health Cloud" width={s} height={s} className="flex-shrink-0 object-contain" style={{ width: s, height: s }} />
      <div className="leading-none">
        <span className={`font-bold tracking-tight ${variant === 'dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontSize: s * 0.42 }}>
          Health Cloud
        </span>
      </div>
    </div>
  );
}

export function CopyrightLine({ className = '' }: { className?: string }) {
  const year = new Date().getFullYear();
  return (
    <p className={className}>
      Health Cloud&#8482; — Powered by{' '}
      <a href="https://liafrik.com" target="_blank" rel="noopener noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-current">LiAfrik</a>
      {' '}— Dubaï &amp; Yaoundé — &copy; {year} All Rights Reserved.
    </p>
  );
}

export function LangToggle({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const { lang, setLang } = useI18n();
  const isDark = variant === 'dark';
  return (
    <select
      value={lang}
      onChange={(e) => setLang(e.target.value as Parameters<typeof setLang>[0])}
      aria-label="Language"
      className={`text-xs uppercase tracking-wide rounded-lg px-2.5 py-1.5 border-0 focus:outline-none focus:ring-2 cursor-pointer ${
        isDark ? 'bg-white/10 text-white focus:ring-white/40' : 'bg-gray-100 text-gray-700 focus:ring-blue-400'
      }`}
    >
      {SUPPORTED_LANGUAGES.map((l) => (
        <option key={l.code} value={l.code} className="text-gray-900">{l.nativeName}</option>
      ))}
    </select>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border border-amber-200',
    approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    active: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    trialing: 'bg-blue-50 text-blue-700 border border-blue-200',
    past_due: 'bg-red-50 text-red-700 border border-red-200',
    rejected: 'bg-red-50 text-red-600 border border-red-200',
    suspended: 'bg-red-50 text-red-700 border border-red-200',
    request_info: 'bg-sky-50 text-sky-700 border border-sky-200',
    cancelled: 'bg-gray-100 text-gray-600 border border-gray-200',
    paid: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    open: 'bg-blue-50 text-blue-700 border border-blue-200',
    draft: 'bg-gray-100 text-gray-600 border border-gray-200',
    void: 'bg-gray-100 text-gray-500 border border-gray-200',
    succeeded: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    failed: 'bg-red-50 text-red-600 border border-red-200',
    male: 'bg-sky-50 text-sky-700 border border-sky-200',
    female: 'bg-pink-50 text-pink-700 border border-pink-200',
    other: 'bg-gray-100 text-gray-600 border border-gray-200',
    scheduled: 'bg-blue-50 text-blue-700 border border-blue-200',
    completed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    no_show: 'bg-red-50 text-red-600 border border-red-200',
    available: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    occupied: 'bg-red-50 text-red-700 border border-red-200',
    cleaning: 'bg-amber-50 text-amber-700 border border-amber-200',
    maintenance: 'bg-orange-50 text-orange-700 border border-orange-200',
    reserved: 'bg-blue-50 text-blue-700 border border-blue-200',
    published: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  };
  const cls = map[status] ?? 'bg-gray-100 text-gray-600 border border-gray-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function IconBox({ icon: Icon, color = 'blue', size = 10 }: { icon: React.ElementType; color?: string; size?: number }) {
  return (
    <div className={`w-${size} h-${size} rounded-xl flex items-center justify-center bg-${color}-50`}>
      <Icon size={size * 2.4} className={`text-${color}-600`} />
    </div>
  );
}
