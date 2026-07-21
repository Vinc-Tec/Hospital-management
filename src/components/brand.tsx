import { type ReactNode } from 'react';
import { Heart } from 'lucide-react';
import { useI18n } from '../lib/i18n';

export function Logo({ size = 36, variant = 'light' }: { size?: number; variant?: 'light' | 'dark' }) {
  const textColor = variant === 'dark' ? 'text-white' : 'text-gray-900';
  const subColor = variant === 'dark' ? 'text-gray-400' : 'text-gray-400';
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="rounded-xl flex items-center justify-center shadow-sm"
        style={{
          width: size, height: size,
          background: 'linear-gradient(135deg, #2563EB 0%, #10B981 100%)',
        }}
      >
        <Heart size={size * 0.5} className="text-white" fill="white" />
      </div>
      <div className="leading-tight">
        <div className={`font-bold ${textColor}`} style={{ fontSize: size * 0.42 }}>Health Cloud</div>
        <div className={subColor} style={{ fontSize: size * 0.22 }}>LIYAH GROUP</div>
      </div>
    </div>
  );
}

export function LangToggle({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const { lang, setLang } = useI18n();
  const base = 'inline-flex items-center rounded-lg border p-0.5';
  const border = variant === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white';
  return (
    <div className={`${base} ${border}`}>
      {(['fr', 'en'] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
            lang === l
              ? 'bg-blue-600 text-white'
              : variant === 'dark' ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
          }`}
        >{l.toUpperCase()}</button>
      ))}
    </div>
  );
}

const statusColors: Record<string, string> = {
  pending: 'amber', approved: 'green', rejected: 'red', request_info: 'amber', suspended: 'red',
  active: 'green', inactive: 'gray', suspended_staff: 'red',
  scheduled: 'blue', confirmed: 'blue', completed: 'green', cancelled: 'red', no_show: 'amber',
  ordered: 'blue', collected: 'blue', resulted: 'amber', validated: 'green', performed: 'blue', reported: 'amber',
  available: 'green', occupied: 'red', cleaning: 'amber', maintenance: 'gray', reserved: 'blue',
  admitted: 'blue', discharged: 'green', transferred: 'amber',
  unpaid: 'red', paid: 'green', partial: 'amber', refunded: 'gray',
  dispensed: 'green',
  male: 'blue', female: 'pink', other: 'gray',
};

export function StatusBadge({ status }: { status: string }) {
  const color = (statusColors[status] ?? 'gray') as 'gray' | 'green' | 'amber' | 'red' | 'blue' | 'pink';
  const map: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-700', green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', blue: 'bg-blue-100 text-blue-700',
    pink: 'bg-pink-100 text-pink-700',
  };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[color]}`}>{status.replace(/_/g, ' ')}</span>;
}

export function IconBox({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${className}`}>{children}</div>;
}
