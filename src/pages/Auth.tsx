import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, ArrowLeft, Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { Button, Input } from '../components/ui';
import { Logo, LangToggle, CopyrightLine } from '../components/brand';

type Mode = 'signin' | 'signup' | 'forgot' | 'reset' | 'verify';

export function AuthPage({ mode: initialMode }: { mode: 'signin' | 'signup' }) {
  const { signIn, signUp, resetPassword } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setInfo(null); setLoading(true);

    if (mode === 'signin') {
      const res = await signIn(email, password, remember);
      if (res.error) setError(res.error);
      else nav('/app');
    } else if (mode === 'signup') {
      const res = await signUp(email, password, fullName);
      if (res.emailExists) {
        setInfo(t('auth.email_exists'));
        setMode('signin');
      } else if (res.needsVerification) {
        setMode('verify');
      } else if (res.error) {
        setError(res.error);
      }
    } else if (mode === 'forgot') {
      const res = await resetPassword(email);
      if (res.error) setError(res.error);
      else setInfo(t('auth.reset_sent'));
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-white to-emerald-50">
      <div className="flex items-center justify-between p-4">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft size={16} /> {t('nav.back')}</Link>
        <LangToggle />
      </div>
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-4"><Logo size={48} /></div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium mb-3"><Heart size={12} /> {t('app.developed')}</div>
            <h1 className="text-2xl font-bold text-gray-900">
              {mode === 'signin' && t('auth.signin.title')}
              {mode === 'signup' && t('auth.signup.title')}
              {mode === 'forgot' && t('auth.forgot.title')}
              {mode === 'verify' && t('auth.verify.title')}
            </h1>
            {(mode === 'forgot' || mode === 'verify') && (
              <p className="text-sm text-gray-500 mt-2">
                {mode === 'forgot' ? t('auth.forgot.subtitle') : t('auth.verify.subtitle')}
              </p>
            )}
          </div>

          {mode === 'verify' ? (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <Mail size={28} className="text-emerald-600" />
              </div>
              <p className="text-gray-700 font-medium mb-2">{t('auth.verify.body').replace('{email}', email)}</p>
              <p className="text-sm text-gray-500 mb-6">{t('auth.verify.check_spam')}</p>
              <Button className="w-full" onClick={() => setMode('signin')}>{t('auth.verify.continue')}</Button>
            </div>
          ) : (
            <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
              {mode === 'signup' && <Input label={t('auth.fullname')} required value={fullName} onChange={(e) => setFullName(e.target.value)} />}
              <Input label={t('auth.email')} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              {(mode === 'signin' || mode === 'signup') && (
                <Input label={t('auth.password')} type="password" required minLength={mode === 'signup' ? 6 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} />
              )}

              {mode === 'signin' && (
                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 cursor-pointer text-gray-600">
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-blue-600 w-4 h-4 rounded" />
                    {t('auth.remember')}
                  </label>
                  <button type="button" onClick={() => { setMode('forgot'); setError(null); setInfo(null); }} className="text-blue-600 font-medium hover:underline">
                    {t('auth.forgot_link')}
                  </button>
                </div>
              )}

              {info && (
                <div className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg p-2.5">
                  <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{info}</span>
                </div>
              )}
              {error && (
                <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-2.5">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" className="w-full" loading={loading} disabled={mode === 'forgot' && !email}>
                {mode === 'signin' && t('auth.signin.cta')}
                {mode === 'signup' && t('auth.signup.cta')}
                {mode === 'forgot' && t('auth.forgot.cta')}
              </Button>
            </form>
          )}

          <div className="text-center mt-6 space-y-2">
            {mode === 'signin' && (
              <p className="text-sm text-gray-500">
                {t('auth.to.signup_pre')}{' '}
                <button onClick={() => { setMode('signup'); setError(null); setInfo(null); }} className="text-blue-600 font-medium hover:underline">{t('auth.to.signup')}</button>
              </p>
            )}
            {mode === 'signup' && (
              <p className="text-sm text-gray-500">
                {t('auth.to.signin_pre')}{' '}
                <button onClick={() => { setMode('signin'); setError(null); setInfo(null); }} className="text-blue-600 font-medium hover:underline">{t('auth.to.signin')}</button>
              </p>
            )}
            {mode === 'forgot' && (
              <button onClick={() => { setMode('signin'); setError(null); setInfo(null); }} className="text-sm text-blue-600 font-medium hover:underline">
                {t('auth.back_to_signin')}
              </button>
            )}
          </div>
        </div>
      </div>
      <footer className="bg-gray-900 text-gray-400 py-6">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <CopyrightLine className="text-sm font-medium text-gray-300" />
        </div>
      </footer>
    </div>
  );
}
