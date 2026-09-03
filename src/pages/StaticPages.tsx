import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, ArrowLeft, Key, Lock, Zap, Copy, Check } from 'lucide-react';
import { Logo, LangToggle, CopyrightLine } from '../components/brand';
import { privacyPolicy, termsOfService, legalNotice, cookiePolicy, refundPolicy } from '../lib/legalContent';
import { useI18n } from '../lib/i18n';
import { Button, Card, Input, Textarea } from '../components/ui';
import { useState } from 'react';
import logoMark from '../assets/logo-mark.png';
import resourcePhoto from '../assets/photos/doctor-patient-consult.jpg';

// Coordonnées réelles de contact. CONTACT_PHONE volontairement vide tant qu'un
// vrai numéro n'est pas fourni par LiAfrik — mieux vaut ne pas afficher de
// numéro que d'en afficher un faux ("+237 6XX XXX XXX").
const CONTACT_EMAIL = 'cs@liafrik.com';
const CONTACT_PHONE = ''; // TODO: renseigner le vrai numéro avant mise en production
const CONTACT_ADDRESS = 'Dubaï, EAU & Yaoundé, Cameroun';

function StaticPageLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3">
            <LangToggle />
            <Link to="/"><Button variant="ghost" size="sm"><ArrowLeft size={16} /> {t('nav.back')}</Button></Link>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-12 w-full">{children}</main>
      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center mb-3">
            <div className="rounded-xl w-9 h-9 flex items-center justify-center bg-white p-1.5">
              <img src={logoMark} alt="Health Cloud" className="w-full h-full object-contain" />
            </div>
          </div>
          <CopyrightLine className="text-sm font-medium text-gray-300" />
        </div>
      </footer>
    </div>
  );
}

export function AboutPage() {
  const { t } = useI18n();
  return (
    <StaticPageLayout>
      <h1 className="text-3xl font-bold text-gray-900 mb-4">{t('page.about.title')}</h1>
      <p className="text-gray-600 leading-relaxed mb-8">{t('page.about.body')}</p>
      <Card className="p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">{t('page.about.mission_title')}</h2>
        <p className="text-gray-600 leading-relaxed">{t('page.about.mission_body')}</p>
      </Card>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[{ n: '14', l: t('dash.nav.patients') }, { n: '7', l: t('plan.trial') }, { n: '100%', l: t('app.cameroon') }].map((s, i) => (
          <Card key={i} className="p-5 text-center"><p className="text-3xl font-bold text-blue-600">{s.n}</p><p className="text-sm text-gray-500 mt-1">{s.l}</p></Card>
        ))}
      </div>
    </StaticPageLayout>
  );
}

export function FeaturesPage() {
  const { t } = useI18n();
  const features = [
    { icon: '🏥', title: t('dash.nav.patients'), desc: t('feature.isolation.desc') },
    { icon: '📅', title: t('dash.nav.appointments'), desc: t('feature.onboarding.desc') },
    { icon: '👨‍⚕️', title: t('dash.nav.doctors'), desc: t('feature.security.desc') },
    { icon: '📋', title: t('dash.nav.records'), desc: t('feature.billing.desc') },
    { icon: '🧪', title: t('dash.nav.lab'), desc: t('feature.isolation.desc') },
    { icon: '💊', title: t('dash.nav.pharmacy'), desc: t('feature.onboarding.desc') },
    { icon: '🛏️', title: t('dash.nav.beds'), desc: t('feature.security.desc') },
    { icon: '🧾', title: t('dash.nav.invoices'), desc: t('feature.billing.desc') },
  ];
  return (
    <StaticPageLayout>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('page.features.title')}</h1>
      <p className="text-gray-500 mb-8">{t('page.features.subtitle')}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {features.map((f, i) => (
          <Card key={i} className="p-5">
            <div className="text-3xl mb-3">{f.icon}</div>
            <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
            <p className="text-sm text-gray-500">{f.desc}</p>
          </Card>
        ))}
      </div>
    </StaticPageLayout>
  );
}

export function PrivacyPage() {
  const { t, lang } = useI18n();
  const doc = privacyPolicy[lang];
  return (
    <StaticPageLayout>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('page.privacy.title')}</h1>
      <p className="text-xs text-gray-400 mb-6">{doc.lastUpdated}</p>
      <Card className="p-6 space-y-6">
        <p className="text-gray-600 leading-relaxed">{doc.intro}</p>
        {doc.sections.map((s, i) => (
          <div key={i}>
            <h2 className="text-base font-semibold text-gray-900 mb-2">{s.heading}</h2>
            <div className="space-y-2">
              {s.body.map((p, j) => <p key={j} className="text-sm text-gray-600 leading-relaxed">{p}</p>)}
            </div>
          </div>
        ))}
      </Card>
    </StaticPageLayout>
  );
}

export function TermsPage() {
  const { t, lang } = useI18n();
  const doc = termsOfService[lang];
  return (
    <StaticPageLayout>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('page.terms.title')}</h1>
      <p className="text-xs text-gray-400 mb-6">{doc.lastUpdated}</p>
      <Card className="p-6 space-y-6">
        <p className="text-gray-600 leading-relaxed">{doc.intro}</p>
        {doc.sections.map((s, i) => (
          <div key={i}>
            <h2 className="text-base font-semibold text-gray-900 mb-2">{s.heading}</h2>
            <div className="space-y-2">
              {s.body.map((p, j) => <p key={j} className="text-sm text-gray-600 leading-relaxed">{p}</p>)}
            </div>
          </div>
        ))}
      </Card>
    </StaticPageLayout>
  );
}

export function LegalNoticePage() {
  const { t, lang } = useI18n();
  const doc = legalNotice[lang];
  return (
    <StaticPageLayout>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('page.legal.title')}</h1>
      <p className="text-xs text-gray-400 mb-6">{doc.lastUpdated}</p>
      <Card className="p-6 space-y-6">
        <p className="text-gray-600 leading-relaxed">{doc.intro}</p>
        {doc.sections.map((s, i) => (
          <div key={i}>
            <h2 className="text-base font-semibold text-gray-900 mb-2">{s.heading}</h2>
            <div className="space-y-2">
              {s.body.map((p, j) => <p key={j} className="text-sm text-gray-600 leading-relaxed">{p}</p>)}
            </div>
          </div>
        ))}
      </Card>
    </StaticPageLayout>
  );
}

export function RefundPage() {
  const { t, lang } = useI18n();
  const doc = refundPolicy[lang];
  return (
    <StaticPageLayout>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('page.refund.title')}</h1>
      <p className="text-xs text-gray-400 mb-6">{doc.lastUpdated}</p>
      <Card className="p-6 space-y-6">
        <p className="text-gray-600 leading-relaxed">{doc.intro}</p>
        {doc.sections.map((s, i) => (
          <div key={i}>
            <h2 className="text-base font-semibold text-gray-900 mb-2">{s.heading}</h2>
            <div className="space-y-2">
              {s.body.map((p, j) => <p key={j} className="text-sm text-gray-600 leading-relaxed">{p}</p>)}
            </div>
          </div>
        ))}
      </Card>
    </StaticPageLayout>
  );
}

export function CookiesPage() {
  const { t, lang } = useI18n();
  const doc = cookiePolicy[lang];
  return (
    <StaticPageLayout>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('page.cookies.title')}</h1>
      <p className="text-xs text-gray-400 mb-6">{doc.lastUpdated}</p>
      <Card className="p-6 space-y-6">
        <p className="text-gray-600 leading-relaxed">{doc.intro}</p>
        {doc.sections.map((s, i) => (
          <div key={i}>
            <h2 className="text-base font-semibold text-gray-900 mb-2">{s.heading}</h2>
            <div className="space-y-2">
              {s.body.map((p, j) => <p key={j} className="text-sm text-gray-600 leading-relaxed">{p}</p>)}
            </div>
          </div>
        ))}
      </Card>
    </StaticPageLayout>
  );
}

function CodeBlock({ children }: { children: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="bg-slate-900 text-slate-100 text-xs sm:text-[13px] leading-relaxed rounded-xl p-4 overflow-x-auto"><code>{children}</code></pre>
      <button
        onClick={() => { navigator.clipboard?.writeText(children); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
        aria-label={t('common.copy')}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
    </div>
  );
}

export function ApiDocsPage() {
  const { t } = useI18n();
  const endpoints = [
    { method: 'GET', path: '/patients', desc: t('page.api.ep.patients_list'), scope: 'read' },
    { method: 'GET', path: '/patients/:id', desc: t('page.api.ep.patients_get'), scope: 'read' },
    { method: 'POST', path: '/patients', desc: t('page.api.ep.patients_create'), scope: 'write' },
    { method: 'GET', path: '/appointments', desc: t('page.api.ep.appts_list'), scope: 'read' },
    { method: 'POST', path: '/appointments', desc: t('page.api.ep.appts_create'), scope: 'write' },
  ];
  return (
    <StaticPageLayout>
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-4">
        <Zap size={12} /> {t('page.api.badge')}
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('page.api.title')}</h1>
      <p className="text-gray-500 mb-8 max-w-2xl">{t('page.api.subtitle')}</p>

      <Card className="p-6 mb-6">
        <div className="flex items-center gap-2 mb-3"><Key size={16} className="text-blue-600" /><h2 className="text-base font-semibold text-gray-900">{t('page.api.auth_title')}</h2></div>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">{t('page.api.auth_body')}</p>
        <CodeBlock>{`curl https://<project-ref>.supabase.co/functions/v1/api-v1/patients \\\n  -H "X-API-Key: hck_your_key_here"`}</CodeBlock>
        <p className="text-xs text-gray-400 mt-3">{t('page.api.auth_note')}</p>
      </Card>

      <Card className="p-6 mb-6">
        <div className="flex items-center gap-2 mb-4"><Lock size={16} className="text-blue-600" /><h2 className="text-base font-semibold text-gray-900">{t('page.api.scopes_title')}</h2></div>
        <ul className="space-y-2 text-sm text-gray-600">
          <li><span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">read</span> — {t('page.api.scope_read')}</li>
          <li><span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">write</span> — {t('page.api.scope_write')}</li>
        </ul>
        <p className="text-sm text-gray-500 mt-4">{t('page.api.scopes_note')}</p>
      </Card>

      <Card className="p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">{t('page.api.endpoints_title')}</h2>
        <div className="divide-y divide-gray-100">
          {endpoints.map((e, i) => (
            <div key={i} className="py-3 flex items-start gap-3">
              <span className={`flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-md ${e.method === 'GET' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>{e.method}</span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm text-gray-900">{e.path}</p>
                <p className="text-xs text-gray-500 mt-0.5">{e.desc}</p>
              </div>
              <span className="flex-shrink-0 text-[11px] text-gray-400 font-mono">{e.scope}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-3">{t('page.api.example_title')}</h2>
        <CodeBlock>{`curl -X POST https://<project-ref>.supabase.co/functions/v1/api-v1/appointments \\\n  -H "X-API-Key: hck_your_key_here" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "patient_id": "…",\n    "doctor_id": "…",\n    "scheduled_at": "2026-09-15T09:30:00Z"\n  }'`}</CodeBlock>
      </Card>

      <Card className="p-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-gray-900">{t('page.api.manage_title')}</p>
          <p className="text-xs text-gray-500">{t('page.api.manage_body')}</p>
        </div>
        <a href="/app/settings?tab=api" className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline">
          {t('page.api.manage_cta')} →
        </a>
      </Card>
    </StaticPageLayout>
  );
}

export function InsightArticlePage() {
  const { t } = useI18n();
  return (
    <StaticPageLayout>
      <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">{t('insight.label')}</span>
      <h1 className="text-3xl font-bold text-gray-900 mt-3 mb-3 leading-tight">{t('insight.title')}</h1>
      <p className="text-sm font-semibold text-gray-800 mb-6">{t('insight.byline')}</p>
      <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm mb-8">
        <img src={resourcePhoto} alt="" className="w-full h-[280px] object-cover" />
      </div>
      <div className="prose prose-gray max-w-none space-y-4 text-gray-600 leading-relaxed">
        {t('insight.body').split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
      </div>
      <div className="mt-10">
        <Link to="/signup"><Button>{t('hero.cta.start')}</Button></Link>
      </div>
    </StaticPageLayout>
  );
}

export function ContactPage() {
  const { t } = useI18n();
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  return (
    <StaticPageLayout>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('page.contact.title')}</h1>
      <p className="text-gray-500 mb-8">{t('page.contact.body')}</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card className="p-5 flex items-center gap-3"><Mail size={20} className="text-blue-600" /><div><p className="text-sm font-medium text-gray-900">{t('page.contact.email')}</p><p className="text-sm text-gray-500">{CONTACT_EMAIL}</p></div></Card>
          {CONTACT_PHONE && (
            <Card className="p-5 flex items-center gap-3"><Phone size={20} className="text-blue-600" /><div><p className="text-sm font-medium text-gray-900">{t('page.contact.phone')}</p><p className="text-sm text-gray-500">{CONTACT_PHONE}</p></div></Card>
          )}
          <Card className="p-5 flex items-center gap-3"><MapPin size={20} className="text-blue-600" /><div><p className="text-sm font-medium text-gray-900">{t('page.contact.address')}</p><p className="text-sm text-gray-500">{CONTACT_ADDRESS}</p></div></Card>
        </div>
        <Card className="p-6">
          {sent ? (
            <div className="text-center py-8"><p className="text-lg font-semibold text-emerald-600 mb-2">{t('page.contact.sent')}</p></div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} className="space-y-4">
              <Input label={t('page.contact.name')} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input label={t('page.contact.email')} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Textarea label={t('page.contact.message')} required rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
              <Button type="submit" className="w-full">{t('page.contact.send')}</Button>
            </form>
          )}
        </Card>
      </div>
    </StaticPageLayout>
  );
}
