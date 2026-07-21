import { Link } from 'react-router-dom';
import { Heart, Shield, Globe, CreditCard, Lock, ArrowRight, Check, Stethoscope } from 'lucide-react';
import { Logo, LangToggle } from '../components/brand';
import { useI18n } from '../lib/i18n';
import { Button } from '../components/ui';

export function LandingPage() {
  const { t } = useI18n();
  const features = [
    { icon: Shield, title: t('feature.isolation.title'), desc: t('feature.isolation.desc') },
    { icon: Globe, title: t('feature.onboarding.title'), desc: t('feature.onboarding.desc') },
    { icon: CreditCard, title: t('feature.billing.title'), desc: t('feature.billing.desc') },
    { icon: Lock, title: t('feature.security.title'), desc: t('feature.security.desc') },
  ];
  const plans = [
    { name: 'Starter', price: '$49', period: t('plan.month'), features: ['3 doctors', '500 patients', '1 location', 'Email support'] },
    { name: 'Professional', price: '$149', period: t('plan.month'), features: ['15 doctors', '5,000 patients', '3 locations', 'Priority support', 'PDF export'] },
    { name: 'Business', price: '$399', period: t('plan.month'), features: ['50 doctors', 'Unlimited patients', '10 locations', '24/7 support', 'API access'] },
    { name: 'Enterprise', price: 'Custom', period: '', features: ['Unlimited doctors', 'Unlimited patients', 'Unlimited locations', 'Dedicated manager', 'SLA 99.9%'] },
  ];
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3">
            <LangToggle />
            <Link to="/signin"><Button variant="ghost" size="sm">{t('nav.signin')}</Button></Link>
            <Link to="/signup"><Button size="sm">{t('nav.signup')}</Button></Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 via-white to-white">
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(37,99,235,0.15), transparent 40%), radial-gradient(circle at 80% 70%, rgba(16,185,129,0.15), transparent 40%)' }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium mb-6">
              <Heart size={12} /> {t('app.developed')} · {t('app.cameroon')}
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight tracking-tight">{t('hero.title')}</h1>
            <p className="mt-6 text-lg text-gray-600 leading-relaxed max-w-2xl">{t('hero.subtitle')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/signup"><Button size="lg">{t('hero.cta')} <ArrowRight size={18} /></Button></Link>
              <a href="#plans"><Button variant="outline" size="lg">{t('hero.cta2')}</Button></a>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, i) => (
            <div key={i} className="p-6 rounded-2xl border border-gray-200 hover:border-blue-200 hover:shadow-md transition-all bg-white">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-4"><f.icon size={24} className="text-blue-600" /></div>
              <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="plans" className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium mb-3">{t('plan.trial')}</div>
            <h2 className="text-3xl font-bold text-gray-900">{t('footer.pricing')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((p, i) => (
              <div key={i} className={`p-6 rounded-2xl bg-white border ${i === 1 ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200'} shadow-sm`}>
                <h3 className="font-bold text-gray-900 text-lg">{p.name}</h3>
                <div className="mt-2 mb-4"><span className="text-3xl font-bold text-gray-900">{p.price}</span>{p.period && <span className="text-gray-400 text-sm">/{p.period}</span>}</div>
                <ul className="space-y-2 mb-6">
                  {p.features.map((feat, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-gray-600"><Check size={16} className="text-emerald-500" /> {feat}</li>
                  ))}
                </ul>
                <Link to="/signup" className="block"><Button variant={i === 1 ? 'primary' : 'outline'} className="w-full">{t('plan.choose')}</Button></Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-2 md:col-span-1">
              <Logo variant="dark" size={32} />
              <p className="text-sm mt-4 max-w-xs">{t('app.tagline')}</p>
              <p className="text-xs mt-2 text-gray-500">{t('app.developed')} — {t('app.cameroon')}</p>
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm mb-3">{t('footer.product')}</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/features" className="hover:text-white transition-colors">{t('footer.features')}</Link></li>
                <li><a href="#plans" className="hover:text-white transition-colors">{t('footer.pricing')}</a></li>
                <li><Link to="/about" className="hover:text-white transition-colors">{t('footer.about')}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm mb-3">{t('footer.company')}</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/about" className="hover:text-white transition-colors">{t('footer.about')}</Link></li>
                <li><Link to="/contact" className="hover:text-white transition-colors">{t('footer.contact')}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm mb-3">{t('footer.legal')}</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/privacy" className="hover:text-white transition-colors">{t('footer.privacy')}</Link></li>
                <li><Link to="/terms" className="hover:text-white transition-colors">{t('footer.terms')}</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-500">© {new Date().getFullYear()} LIYAH GROUP. {t('footer.rights')}</p>
            <p className="text-xs text-gray-500 flex items-center gap-1.5"><Heart size={12} className="text-red-500" fill="currentColor" /> {t('footer.made_in')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
