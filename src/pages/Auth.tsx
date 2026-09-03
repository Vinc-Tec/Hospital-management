import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { Button, Input } from '../components/ui';
import { Logo, LangToggle, CopyrightLine } from '../components/brand';
import { supabase } from '../lib/supabase';
import doctorWoman from '../assets/doctors/doctor-woman.png';
import doctorMan from '../assets/doctors/doctor-man.png';

// Royalty-free footage (Pexels License — free for commercial & personal use,
// no attribution required): aerial view of a modern glass-facade hospital.
// https://www.pexels.com/video/hospital-20670148/
const HOSPITAL_VIDEO_URL = 'https://videos.pexels.com/video-files/20670148/20670148-hd_1920_1080_30fps.mp4';
const HOSPITAL_VIDEO_POSTER = 'https://images.pexels.com/videos/20670148/hospital-hospitalization-20670148.jpeg?auto=compress&cs=tinysrgb&h=1080';

type Mode = 'signin' | 'signup' | 'forgot' | 'reset' | 'verify' | 'mfa';

function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}

export function AuthPage({ mode: initialMode }: { mode: 'signin' | 'signup' }) {
  const { signIn, signUp, resetPassword, verifyMfaChallenge, signInWithGoogle } = useAuth();
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
  const [googleLoading, setGoogleLoading] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  const handleGoogle = async () => {
    setError(null); setInfo(null); setGoogleLoading(true);
    const res = await signInWithGoogle();
    // On success the browser navigates away to Google immediately; we only
    // ever reach this line if the request failed before the redirect.
    if (res.error) { setError(res.error); setGoogleLoading(false); }
  };

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
    <div className="min-h-screen flex flex-col relative bg-slate-950 overflow-hidden">
      {/* Modern-hospital video background */}
      <div className="absolute inset-0 overflow-hidden">
        <video
          className="w-full h-full object-cover"
          src={HOSPITAL_VIDEO_URL}
          poster={HOSPITAL_VIDEO_POSTER}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
        />
        {/* Uniform dark overlay so white text stays readable against any
            frame of the footage — no transparent band in the middle where
            the title and card sit. */}
        <div className="absolute inset-0 bg-slate-950/80" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-blue-950/55 to-slate-950/80" />
      </div>

      <div className="relative flex items-center justify-between p-4 z-20">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors"><ArrowLeft size={16} /> {t('nav.back')}</Link>
        <LangToggle variant="dark" />
      </div>

      <div className="relative flex-1 flex items-center justify-center px-4 py-10 z-10">
        {/* Floating transparent-cutout doctors flanking the card — decorative, hidden on small screens */}
        <img
          src={doctorMan}
          alt=""
          aria-hidden="true"
          className="hidden xl:block absolute left-[4%] bottom-0 h-[92%] w-auto object-contain object-bottom drop-shadow-[0_30px_40px_rgba(0,0,0,0.45)] pointer-events-none select-none"
        />
        <img
          src={doctorWoman}
          alt=""
          aria-hidden="true"
          className="hidden xl:block absolute right-[4%] bottom-0 h-[92%] w-auto object-contain object-bottom drop-shadow-[0_30px_40px_rgba(0,0,0,0.45)] pointer-events-none select-none"
        />

        {/* Centered auth card */}
        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-4 p-2.5 rounded-2xl bg-white/95 shadow-xl"><Logo size={40} /></div>
            <h1 className="text-2xl font-bold text-white drop-shadow">
              {mode === 'signin' && t('auth.signin.title')}
              {mode === 'signup' && t('auth.signup.title')}
              {mode === 'forgot' && t('auth.forgot.title')}
              {mode === 'verify' && t('auth.verify.title')}
              {mode === 'mfa' && t('auth.mfa.title')}
            </h1>
            {(mode === 'forgot' || mode === 'verify' || mode === 'mfa') && (
              <p className="text-sm text-blue-100/80 mt-2">
                {mode === 'forgot' ? t('auth.forgot.subtitle') : mode === 'mfa' ? t('auth.mfa.subtitle') : t('auth.verify.subtitle')}
              </p>
            )}
          </div>

          {mode === 'verify' ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-2xl p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <Mail size={28} className="text-emerald-600" />
              </div>
              <p className="text-gray-700 font-medium mb-2">{t('auth.verify.body').replace('{email}', email)}</p>
              <p className="text-sm text-gray-500 mb-6">{t('auth.verify.check_spam')}</p>
              <Button className="w-full" onClick={() => setMode('signin')}>{t('auth.verify.continue')}</Button>
            </div>
          ) : (
            <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-100 shadow-2xl p-6 space-y-4">
              {(mode === 'signin' || mode === 'signup') && (
                <>
                  <button
                    type="button"
                    onClick={handleGoogle}
                    disabled={googleLoading}
                    className="w-full inline-flex items-center justify-center gap-2.5 py-2.5 rounded-xl border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60"
                  >
                    {googleLoading ? <Loader2 size={18} className="animate-spin text-gray-400" /> : <GoogleIcon />}
                    {mode === 'signin' ? t('auth.google.signin') : t('auth.google.signup')}
                  </button>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="flex-1 h-px bg-gray-200" />
                    {t('auth.or_email')}
                    <span className="flex-1 h-px bg-gray-200" />
                  </div>
                </>
              )}
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
              <p className="text-sm text-blue-100/80">
                {t('auth.to.signup_pre')}{' '}
                <button onClick={() => { setMode('signup'); setError(null); setInfo(null); }} className="text-white font-medium hover:underline">{t('auth.to.signup')}</button>
              </p>
            )}
            {mode === 'signup' && (
              <p className="text-sm text-blue-100/80">
                {t('auth.to.signin_pre')}{' '}
                <button onClick={() => { setMode('signin'); setError(null); setInfo(null); }} className="text-white font-medium hover:underline">{t('auth.to.signin')}</button>
              </p>
            )}
            {mode === 'forgot' && (
              <button onClick={() => { setMode('signin'); setError(null); setInfo(null); }} className="text-sm text-white font-medium hover:underline">
                {t('auth.back_to_signin')}
              </button>
            )}
          </div>
        </div>
      </div>
      <footer className="relative z-20 bg-slate-950/70 backdrop-blur-sm border-t border-white/10 text-gray-400 py-6">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <CopyrightLine className="text-sm font-medium text-gray-300" />
        </div>
      </footer>
    </div>
  );
}
