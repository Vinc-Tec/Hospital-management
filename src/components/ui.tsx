import { type ReactNode } from 'react';
import { Loader2, X } from 'lucide-react';

export function Button({
  children, variant = 'primary', size = 'md', loading = false, disabled, className = '', type = 'button', onClick,
}: {
  children: ReactNode; variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg'; loading?: boolean; disabled?: boolean; className?: string;
  type?: 'button' | 'submit' | 'reset'; onClick?: () => void;
}) {
  const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
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
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {desc && <p className="text-sm text-gray-500 mt-1">{desc}</p>}
      </div>
      {action}
    </div>
  );
}
