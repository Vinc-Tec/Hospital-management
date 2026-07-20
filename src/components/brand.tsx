import { type ReactNode } from 'react';
import { useI18n } from '../lib/i18n';

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="rounded-xl flex items-center justify-center font-bold text-white shadow-sm"
        style={{
          width: size, height: size,
          background: 'linear-gradient(135deg, #2563EB 0%, #10B981 100%)',
          fontSize: size * 0.36,
        }}
      >HC</div>
      <div className="leading-tight">
        <div className="font-bold text-gray-900" style={{ fontSize: size * 0.42 }}>Health Cloud</div>
        <div className="text-gray-400" style={{ fontSize: size * 0.22 }}>LIYAH GROUP</div>
      </div>
    </div>
  );
}

export function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white p-0.5">
      {(['fr', 'en'] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${lang === l ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
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
};

export function StatusBadge({ status }: { status: string }) {
  const color = (statusColors[status] ?? 'gray') as 'gray' | 'green' | 'amber' | 'red' | 'blue';
  const map: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-700', green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', blue: 'bg-blue-100 text-blue-700',
  };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[color]}`}>{status.replace(/_/g, ' ')}</span>;
}

export function IconBox({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${className}`}>{children}</div>;
}
