import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Mail, Phone, MapPin, ArrowLeft } from 'lucide-react';
import { Logo, LangToggle } from '../components/brand';
import { useI18n } from '../lib/i18n';
import { Button, Card, Input, Textarea } from '../components/ui';
import { useState } from 'react';

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
            <div className="rounded-xl w-9 h-9 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #2563EB, #10B981)' }}>
              <Heart size={18} className="text-white" fill="white" />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-300">Health Cloud&#8482; — Powered by LIYAH GROUP — &copy; 2026 All Rights Reserved.</p>
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
  const { t } = useI18n();
  return (
    <StaticPageLayout>
      <h1 className="text-3xl font-bold text-gray-900 mb-4">{t('page.privacy.title')}</h1>
      <Card className="p-6"><p className="text-gray-600 leading-relaxed">{t('page.privacy.body')}</p></Card>
    </StaticPageLayout>
  );
}

export function TermsPage() {
  const { t } = useI18n();
  return (
    <StaticPageLayout>
      <h1 className="text-3xl font-bold text-gray-900 mb-4">{t('page.terms.title')}</h1>
      <Card className="p-6"><p className="text-gray-600 leading-relaxed">{t('page.terms.body')}</p></Card>
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
          <Card className="p-5 flex items-center gap-3"><Mail size={20} className="text-blue-600" /><div><p className="text-sm font-medium text-gray-900">{t('page.contact.email')}</p><p className="text-sm text-gray-500">contact@liyahgroup.com</p></div></Card>
          <Card className="p-5 flex items-center gap-3"><Phone size={20} className="text-blue-600" /><div><p className="text-sm font-medium text-gray-900">{t('page.contact.phone')}</p><p className="text-sm text-gray-500">+237 6XX XXX XXX</p></div></Card>
          <Card className="p-5 flex items-center gap-3"><MapPin size={20} className="text-blue-600" /><div><p className="text-sm font-medium text-gray-900">{t('page.contact.address')}</p><p className="text-sm text-gray-500">Douala, Cameroun</p></div></Card>
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
