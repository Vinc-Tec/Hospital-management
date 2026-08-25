import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield, Globe, CreditCard, Zap, ArrowRight, Check,
  Activity, BarChart3, Heart, Star,
  Building2, Stethoscope, FlaskConical, Pill,
} from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { Logo, LangToggle, CopyrightLine } from '../components/brand';
import heroPhoto from '../assets/photos/waiting-room-tv.jpg';

function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

export function LandingPage() {
  const { t } = useI18n();
  const [scrolled, setScrolled] = useState(false);
  const [annualBilling, setAnnualBilling] = useState(false);
  useScrollReveal();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const plans = [
    {
      name: 'Starter', price_monthly: 49, price_yearly: 470,
      features: ['Up to 3 doctors', '500 patients/mo', 'Basic modules', 'Email support', '1 location'],
      highlight: false,
    },
    {
      name: 'Professional', price_monthly: 149, price_yearly: 1430,
      features: ['Up to 15 doctors', '5,000 patients/mo', 'All clinical modules', 'Priority support', '3 locations', 'Reports & Analytics'],
      highlight: true,
    },
    {
      name: 'Business', price_monthly: 399, price_yearly: 3830,
      features: ['Up to 50 doctors', 'Unlimited patients', 'Full module suite', 'Dedicated support', '10 locations', 'Advanced Analytics', 'API Access'],
      highlight: false,
    },
    {
      name: 'Enterprise', price_monthly: 0, price_yearly: 0,
      features: ['Unlimited doctors', 'Unlimited patients', 'Custom modules', 'SLA support', 'Unlimited locations', 'White-label option', 'Custom integrations'],
      highlight: false, custom: true,
    },
  ];

  const stats = [
    { value: '2,400+', label: t('landing.stats.institutions') },
    { value: '180,000+', label: t('landing.stats.patients') },
    { value: '54', label: t('landing.stats.countries') },
    { value: '99.9%', label: t('landing.stats.uptime') },
  ];

  const features = [
    { icon: Shield, title: t('feat.isolation.title'), desc: t('feat.isolation.desc') },
    { icon: Globe, title: t('feat.onboarding.title'), desc: t('feat.onboarding.desc') },
    { icon: CreditCard, title: t('feat.billing.title'), desc: t('feat.billing.desc') },
    { icon: Activity, title: t('feat.security.title'), desc: t('feat.security.desc') },
    { icon: BarChart3, title: t('feat.analytics.title'), desc: t('feat.analytics.desc') },
    { icon: Zap, title: t('feat.speed.title'), desc: t('feat.speed.desc') },
  ];

  const institutionTypes = [
    { icon: Building2, label: t('type.hospital'), count: '340+' },
    { icon: Stethoscope, label: t('type.clinic'), count: '1,200+' },
    { icon: FlaskConical, label: t('type.lab'), count: '280+' },
    { icon: Pill, label: t('type.pharmacy'), count: '580+' },
  ];

  const testimonials = [
    { name: 'Dr. Aminata Diallo', role: 'Directrice — Clinique Santé+, Dakar', stars: 5, text: t('testi.1') },
    { name: 'Dr. Emmanuel Okafor', role: 'CEO — MedCenter Lagos, Nigeria', stars: 5, text: t('testi.2') },
    { name: 'Dr. Fatima Al-Hassan', role: 'Directrice Médicale — HopitalPlus, Abidjan', stars: 5, text: t('testi.3') },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* NAVBAR — flat, always readable, no glass/blur tricks */}
      <header className={`fixed top-0 left-0 right-0 z-50 bg-white transition-shadow duration-200 ${scrolled ? 'border-b border-gray-100 shadow-sm' : 'border-b border-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Logo variant="light" />
          <nav className="hidden md:flex items-center gap-8">
            {[t('nav.features'), t('nav.pricing'), t('nav.about')].map((item, i) => (
              <a key={i} href={i === 0 ? '#features' : i === 1 ? '#plans' : '/about'}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                {item}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <LangToggle variant="light" />
            <Link to="/signin" className="text-sm font-medium px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors">
              {t('nav.signin')}
            </Link>
            <Link to="/signup" className="text-sm font-semibold px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
              {t('nav.signup')}
            </Link>
          </div>
        </div>
      </header>

      {/* HERO — plain light background, two columns, framed photo instead of full-bleed overlay */}
      <section className="relative bg-gradient-to-b from-slate-50 to-white pt-32 pb-20 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          <div className="reveal">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-100 mb-6">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              <span className="text-xs font-semibold text-blue-700">
                {t('hero.badge')} <span className="text-blue-300">—</span> {t('hero.badge.suffix')}
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight leading-[1.08] mb-6">
              {t('hero.line1')}<br />
              <span className="text-blue-600">{t('hero.line2')}</span>
            </h1>

            <p className="text-lg text-gray-500 max-w-xl mb-9 leading-relaxed">
              {t('hero.subtitle')}
            </p>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-10">
              <Link to="/signup"
                className="group inline-flex items-center gap-2 px-7 py-3.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors text-base">
                {t('hero.cta.start')}
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <a href="#plans"
                className="inline-flex items-center gap-2 px-7 py-3.5 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-base">
                {t('hero.cta.plans')}
              </a>
            </div>

            {/* Trust strip */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {[
                { icon: Shield, label: t('hero.trust.rls') },
                { icon: Heart, label: t('hero.trust.hipaa') },
                { icon: Globe, label: t('hero.trust.gdpr') },
                { icon: Activity, label: t('hero.trust.uptime') },
              ].map((item, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500">
                  <item.icon size={14} className="text-emerald-600" />
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          {/* Framed product photo, PayUnit-style */}
          <div className="relative reveal" style={{ transitionDelay: '150ms' }}>
            <div className="absolute -inset-4 bg-blue-50 rounded-3xl -z-10 hidden sm:block" />
            <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-xl">
              <img src={heroPhoto} alt="" className="w-full h-[380px] object-cover" />
            </div>
            {/* Stats card overlapping the photo */}
            <div className="hidden sm:grid grid-cols-2 gap-3 bg-white rounded-2xl border border-gray-200 shadow-lg p-4 mt-[-3rem] mx-6 relative">
              {stats.map((s, i) => (
                <div key={i} className="text-center py-2">
                  <p className="text-xl font-bold text-gray-900">{s.value}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* INSTITUTION TYPES — plain logo-strip style row */}
      <section className="py-14 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-widest mb-8">{t('landing.trusted_by')}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {institutionTypes.map((it, i) => (
              <div key={i} className="reveal flex items-center gap-3 px-5 py-4 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors" style={{ transitionDelay: `${i * 80}ms` }}>
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <it.icon size={17} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{it.label}</p>
                  <p className="text-xs text-gray-400">{it.count}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES — flat cards, single accent color, no per-card rainbow */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mx-auto text-center mb-16 reveal">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">{t('landing.why')}</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-3 mb-4">{t('landing.features_title')}</h2>
            <p className="text-lg text-gray-500">{t('landing.features_sub')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className="reveal p-7 rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-sm transition-colors duration-200" style={{ transitionDelay: `${(i % 3) * 100}ms` }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 bg-blue-50">
                  <f.icon size={20} className="text-blue-600" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF — light section instead of dark gradient */}
      <section className="py-20 bg-slate-50 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-xl mx-auto text-center mb-12 reveal">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">{t('landing.testimonials_title')}</h2>
            <p className="text-gray-500">{t('landing.testimonials_sub')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t2, i) => (
              <div key={i} className="reveal bg-white rounded-2xl border border-gray-100 p-7" style={{ transitionDelay: `${i * 100}ms` }}>
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t2.stars }).map((_, j) => <Star key={j} size={14} className="text-amber-400 fill-amber-400" />)}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed mb-5">&ldquo;{t2.text}&rdquo;</p>
                <div>
                  <p className="text-gray-900 font-semibold text-sm">{t2.name}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{t2.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="plans" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-xl mx-auto text-center mb-12 reveal">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">{t('landing.pricing_label')}</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-3 mb-4">{t('landing.pricing_title')}</h2>
            <p className="text-gray-500 mb-8">{t('landing.pricing_sub')}</p>
            <div className="inline-flex items-center gap-3 bg-gray-50 rounded-2xl p-1 border border-gray-200">
              <button onClick={() => setAnnualBilling(false)} className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${!annualBilling ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
                {t('plan.monthly')}
              </button>
              <button onClick={() => setAnnualBilling(true)} className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${annualBilling ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
                {t('plan.yearly')}
                <span className={`text-xs px-2 py-0.5 rounded-lg font-bold ${annualBilling ? 'bg-emerald-400/20 text-emerald-100' : 'bg-emerald-100 text-emerald-700'}`}>-20%</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan, i) => (
              <div key={i} className={`reveal relative rounded-2xl p-7 flex flex-col ${plan.highlight ? 'bg-blue-600 shadow-xl' : 'bg-white border border-gray-200'}`} style={{ transitionDelay: `${i * 80}ms` }}>
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-amber-400 text-amber-900 text-xs font-bold rounded-full whitespace-nowrap">
                    {t('plan.popular')}
                  </div>
                )}
                <div className="mb-6">
                  <p className={`text-sm font-semibold mb-1 ${plan.highlight ? 'text-blue-200' : 'text-gray-500'}`}>{plan.name}</p>
                  {plan.custom ? (
                    <p className={`text-3xl font-bold ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>{t('plan.contact')}</p>
                  ) : (
                    <div className="flex items-end gap-1">
                      <p className={`text-4xl font-bold ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>
                        ${annualBilling ? Math.round(plan.price_yearly / 12) : plan.price_monthly}
                      </p>
                      <p className={`text-sm pb-1.5 ${plan.highlight ? 'text-blue-200' : 'text-gray-400'}`}>/{t('plan.month')}</p>
                    </div>
                  )}
                  {annualBilling && !plan.custom && plan.price_yearly > 0 && (
                    <p className={`text-xs mt-1 font-medium ${plan.highlight ? 'text-blue-200' : 'text-emerald-600'}`}>
                      ${plan.price_yearly}/{t('plan.year')} — {t('plan.save')} ${(plan.price_monthly * 12 - plan.price_yearly)}
                    </p>
                  )}
                  <div className={`text-xs mt-2 px-2 py-1 rounded-lg inline-block font-medium ${plan.highlight ? 'bg-blue-500/40 text-blue-100' : 'bg-blue-50 text-blue-600'}`}>
                    {t('plan.trial')}
                  </div>
                </div>
                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2">
                      <Check size={14} className={`mt-0.5 flex-shrink-0 ${plan.highlight ? 'text-emerald-300' : 'text-emerald-500'}`} />
                      <span className={`text-sm ${plan.highlight ? 'text-blue-100' : 'text-gray-600'}`}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/signup"
                  className={`w-full text-center py-3.5 rounded-xl text-sm font-semibold transition-colors ${plan.highlight ? 'bg-white text-blue-600 hover:bg-blue-50' : 'bg-gray-900 text-white hover:bg-gray-800'}`}>
                  {plan.custom ? t('plan.contact_us') : t('plan.start_trial')}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA — single flat color block, no floating orbs */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center reveal">
          <div className="bg-blue-600 rounded-3xl p-12">
            <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Heart size={26} className="text-white" fill="white" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">{t('landing.cta_title')}</h2>
            <p className="text-blue-100 text-lg mb-8 max-w-xl mx-auto">{t('landing.cta_sub')}</p>
            <Link to="/signup"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-700 font-bold rounded-xl hover:bg-blue-50 transition-colors text-base">
              {t('hero.cta.start')}
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-900 text-white pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
            <div className="md:col-span-1">
              <Logo variant="dark" />
              <p className="text-white/40 text-sm mt-4 leading-relaxed">{t('footer.tagline')}</p>
              <p className="text-white/30 text-xs mt-4">100% African Technology</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4">{t('footer.product')}</p>
              <ul className="space-y-2.5">
                {[[t('footer.features'), '#features'], [t('footer.pricing'), '#plans']].map(([item, href], i) => (
                  <li key={i}><a href={href} className="text-sm text-white/50 hover:text-white transition-colors">{item}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4">{t('footer.company')}</p>
              <ul className="space-y-2.5">
                {[[t('footer.about'), '/about'], [t('footer.contact'), '/contact']].map(([label, href], i) => (
                  <li key={i}><Link to={href} className="text-sm text-white/50 hover:text-white transition-colors">{label}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4">{t('footer.legal')}</p>
              <ul className="space-y-2.5">
                {[[t('footer.privacy'), '/privacy'], [t('footer.terms'), '/terms']].map(([label, href], i) => (
                  <li key={i}><Link to={href} className="text-sm text-white/50 hover:text-white transition-colors">{label}</Link></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-3">
            <CopyrightLine className="text-xs text-white/30" />
            <LangToggle variant="dark" />
          </div>
        </div>
      </footer>
    </div>
  );
}
