import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, ArrowLeft, Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { Button, Input } from '../components/ui';
import { Logo, LangToggle, CopyrightLine } from '../components/brand';
import { supabase } from '../lib/supabase';
import hospitalBg from '../assets/hospital-bg-light.svg';
import authPhoto from '../assets/photos/waiting-room-reception.jpg';

type Mode = 'signin' | 'signup' | 'forgot' | 'reset' | 'verify' | 'mfa';

export function AuthPage({ mode: initialMode }: { mode: 'signin' | 'signup' }) {
  const { signIn, signUp, resetPassword, verifyMfaChallenge } = useAuth();
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
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  useEffect(() => {
    if (initialMode !== 'signin') return;
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(async ({ data }) => {
      if (data && data.nextLevel === 'aal2' && data.currentLevel !== data.nextLevel) {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const factorId = factors?.totp?.[0]?.id;
        if (factorId) { setMfaFactorId(factorId); setMode('mfa'); }
      }
    });
  }, [initialMode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setInfo(null); setLoading(true);

    if (mode === 'signin') {
      const res = await signIn(email, password, remember);
      if (res.error) setError(res.error);
      else if (res.mfaRequired && res.mfaFactorId) {
        setMfaFactorId(res.mfaFactorId);
        setMode('mfa');
      } else nav('/app');
    } else if (mode === 'mfa') {
      if (!mfaFactorId) { setError(t('auth.mfa_error')); setLoading(false); return; }
      const res = await verifyMfaChallenge(mfaFactorId, mfaCode);
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
    <div className="min-h-screen flex flex-col relative bg-gradient-to-br from-blue-50 via-white to-emerald-50">
      {/* Hospital interior background (subtle) */}
      <div className="absolute inset-0 bg-cover bg-center pointer-events-none" style={{ backgroundImage: `url(${hospitalBg})` }} />
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-white/30 to-emerald-50/50 pointer-events-none" />
      <div className="relative flex items-center justify-between p-4">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft size={16} /> {t('nav.back')}</Link>
        <LangToggle />
      </div>
      <div className="relative flex-1 flex items-center justify-center px-4 py-8">
        {/* Real hospital photo panel */}
        <div className="hidden lg:block absolute left-0 top-0 bottom-0 w-1/2">
          <img src={authPhoto} alt="Hospital waiting room" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900/70 via-blue-900/50 to-emerald-900/60" />
          <div className="absolute inset-0 flex flex-col justify-end p-12 text-white">
            <h2 className="text-3xl font-bold mb-3 drop-shadow-lg">{t('auth.brand.title')}</h2>
            <p className="text-white/80 max-w-md drop-shadow">{t('auth.brand.subtitle')}</p>
          </div>
        </div>
        <div className="w-full max-w-md lg:ml-auto lg:mr-16">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-4"><Logo size={48} /></div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium mb-3"><Heart size={12} /> {t('app.developed')}</div>
            <h1 className="text-2xl font-bold text-gray-900">
              {mode === 'signin' && t('auth.signin.title')}
              {mode === 'signup' && t('auth.signup.title')}
              {mode === 'forgot' && t('auth.forgot.title')}
              {mode === 'verify' && t('auth.verify.title')}
              {mode === 'mfa' && t('auth.mfa.title')}
            </h1>
            {(mode === 'forgot' || mode === 'verify' || mode === 'mfa') && (
              <p className="text-sm text-gray-500 mt-2">
                {mode === 'forgot' ? t('auth.forgot.subtitle') : mode === 'mfa' ? t('auth.mfa.subtitle') : t('auth.verify.subtitle')}
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
              {mode === 'mfa' ? (
                <Input label={t('auth.mfa.code_label')} required value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} placeholder="000000" maxLength={6} autoFocus />
              ) : (
                <>
                  {mode === 'signup' && <Input label={t('auth.fullname')} required value={fullName} onChange={(e) => setFullName(e.target.value)} />}
                  <Input label={t('auth.email')} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  {(mode === 'signin' || mode === 'signup') && (
                    <Input label={t('auth.password')} type="password" required minLength={mode === 'signup' ? 6 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} />
                  )}
                </>
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
                {mode === 'mfa' && t('auth.mfa.cta')}
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
