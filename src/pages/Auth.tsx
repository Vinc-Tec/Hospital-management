import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, ArrowLeft } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { Button, Input } from '../components/ui';
import { Logo, LangToggle } from '../components/brand';

export function AuthPage({ mode }: { mode: 'signin' | 'signup' }) {
  const { signIn, signUp } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setLoading(true);
    const res = mode === 'signin' ? await signIn(email, password) : await signUp(email, password, fullName);
    if (res.error) setError(res.error);
    else nav(mode === 'signin' ? '/app' : '/onboarding');
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-white to-emerald-50">
      <div className="flex items-center justify-between p-4">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft size={16} /> Back</Link>
        <LangToggle />
      </div>
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-4"><Logo size={48} /></div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium mb-3"><Heart size={12} /> {t('app.developed')}</div>
            <h1 className="text-2xl font-bold text-gray-900">{mode === 'signin' ? t('auth.signin.title') : t('auth.signup.title')}</h1>
          </div>
          <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            {mode === 'signup' && <Input label={t('auth.fullname')} required value={fullName} onChange={(e) => setFullName(e.target.value)} />}
            <Input label={t('auth.email')} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input label={t('auth.password')} type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2.5">{error}</p>}
            <Button type="submit" className="w-full" loading={loading}>{mode === 'signin' ? t('auth.signin.cta') : t('auth.signup.cta')}</Button>
          </form>
          <p className="text-center mt-6 text-sm text-gray-500">
            {mode === 'signin' ? <Link to="/signup" className="text-blue-600 font-medium hover:underline">{t('auth.to.signup')}</Link> : <Link to="/signin" className="text-blue-600 font-medium hover:underline">{t('auth.to.signin')}</Link>}
          </p>
        </div>
      </div>
    </div>
  );
}
