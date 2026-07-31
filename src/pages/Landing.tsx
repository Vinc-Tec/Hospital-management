import { useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield, Globe, CreditCard, Zap, ArrowRight, Check, ChevronDown,
  Activity, Users, BarChart3, Clock, Heart, Star, Play,
  Building2, Stethoscope, FlaskConical, Pill,
} from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { Logo, LangToggle, CopyrightLine } from '../components/brand';

export function LandingPage() {
  const { t } = useI18n();
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const heroRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [annualBilling, setAnnualBilling] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
      if (heroRef.current) {
        const rect = heroRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        heroRef.current.style.setProperty('--mx', `${x}%`);
        heroRef.current.style.setProperty('--my', `${y}%`);
      }
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const plans = [
    {
      name: 'Starter', price_monthly: 49, price_yearly: 470,
      features: ['Up to 3 doctors', '500 patients/mo', 'Basic modules', 'Email support', '1 location'],
      color: 'gray', highlight: false,
    },
    {
      name: 'Professional', price_monthly: 149, price_yearly: 1430,
      features: ['Up to 15 doctors', '5,000 patients/mo', 'All clinical modules', 'Priority support', '3 locations', 'Reports & Analytics'],
      color: 'blue', highlight: true,
    },
    {
      name: 'Business', price_monthly: 399, price_yearly: 3830,
      features: ['Up to 50 doctors', 'Unlimited patients', 'Full module suite', 'Dedicated support', '10 locations', 'Advanced Analytics', 'API Access'],
      color: 'emerald', highlight: false,
    },
    {
      name: 'Enterprise', price_monthly: 0, price_yearly: 0,
      features: ['Unlimited doctors', 'Unlimited patients', 'Custom modules', 'SLA support', 'Unlimited locations', 'White-label option', 'Custom integrations'],
      color: 'gray', highlight: false, custom: true,
    },
  ];

  const stats = [
    { value: '2,400+', label: t('landing.stats.institutions'), icon: Building2 },
    { value: '180,000+', label: t('landing.stats.patients'), icon: Users },
    { value: '54', label: t('landing.stats.countries'), icon: Globe },
    { value: '99.9%', label: t('landing.stats.uptime'), icon: Activity },
  ];

  const features = [
    { icon: Shield, title: t('feat.isolation.title'), desc: t('feat.isolation.desc'), color: 'blue' },
    { icon: Globe, title: t('feat.onboarding.title'), desc: t('feat.onboarding.desc'), color: 'emerald' },
    { icon: CreditCard, title: t('feat.billing.title'), desc: t('feat.billing.desc'), color: 'amber' },
    { icon: Activity, title: t('feat.security.title'), desc: t('feat.security.desc'), color: 'red' },
    { icon: BarChart3, title: t('feat.analytics.title'), desc: t('feat.analytics.desc'), color: 'purple' },
    { icon: Zap, title: t('feat.speed.title'), desc: t('feat.speed.desc'), color: 'orange' },
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
    <div className="min-h-screen bg-white font-[Satoshi]">
      {/* NAVBAR */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-xl border-b border-gray-100 shadow-sm' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Logo variant={scrolled ? 'light' : 'dark'} />
          <nav className="hidden md:flex items-center gap-8">
            {[t('nav.features'), t('nav.pricing'), t('nav.about')].map((item, i) => (
              <a key={i} href={i === 0 ? '#features' : i === 1 ? '#plans' : '/about'}
                className={`text-sm font-medium transition-colors ${scrolled ? 'text-gray-600 hover:text-gray-900' : 'text-white/80 hover:text-white'}`}>
                {item}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <LangToggle variant={scrolled ? 'light' : 'dark'} />
            <Link to="/signin" className={`text-sm font-medium px-4 py-2 rounded-xl transition-colors ${scrolled ? 'text-gray-700 hover:bg-gray-100' : 'text-white/90 hover:text-white hover:bg-white/10'}`}>
              {t('nav.signin')}
            </Link>
            <Link to="/signup" className="text-sm font-semibold px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-md shadow-blue-600/25">
              {t('nav.signup')}
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section
        ref={heroRef}
        className="relative min-h-screen flex items-center overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #0c1a3a 40%, #0d2442 60%, #0f2d1e 100%)',
        }}
      >
        {/* Aurora blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-20 animate-pulse-glow"
            style={{ background: 'radial-gradient(circle, #0ea5e9 0%, transparent 70%)' }} />
          <div className="absolute top-1/4 right-0 w-[500px] h-[500px] rounded-full opacity-15 animate-pulse-glow delay-300"
            style={{ background: 'radial-gradient(circle, #10b981 0%, transparent 70%)' }} />
          <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] rounded-full opacity-10 animate-pulse-glow delay-500"
            style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }} />
          {/* Mouse glow */}
          <div className="absolute inset-0 opacity-30 transition-all duration-700"
            style={{ background: 'radial-gradient(circle 400px at var(--mx, 50%) var(--my, 50%), rgba(14,165,233,0.2), transparent)' }} />
          {/* Grid */}
          <div className="absolute inset-0 opacity-5"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-32 pb-20">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8 animate-slide-up">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-white/80">100% African Technology — Built for Africa</span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight mb-6 animate-slide-up delay-100 leading-[1.05]">
              {t('hero.line1')}<br />
              <span className="bg-gradient-to-r from-sky-400 via-blue-400 to-emerald-400 bg-clip-text text-transparent">
                {t('hero.line2')}
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-white/60 max-w-2xl mx-auto mb-10 animate-slide-up delay-200 leading-relaxed">
              {t('hero.subtitle')}
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-slide-up delay-300">
              <Link to="/signup"
                className="group flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold rounded-2xl shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 hover:-translate-y-0.5 transition-all duration-200 text-base">
                {t('hero.cta.start')}
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <a href="#plans"
                className="flex items-center gap-2 px-8 py-4 glass text-white font-medium rounded-2xl hover:bg-white/15 transition-all duration-200 text-base">
                <Play size={16} />
                {t('hero.cta.plans')}
              </a>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-slide-up delay-400">
              {stats.map((s, i) => (
                <div key={i} className="glass rounded-2xl p-5 text-center hover:bg-white/12 transition-colors">
                  <div className="flex justify-center mb-2"><s.icon size={20} className="text-blue-400" /></div>
                  <p className="text-2xl font-black text-white">{s.value}</p>
                  <p className="text-xs text-white/50 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scroll arrow */}
        <a href="#features" className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown size={28} className="text-white/30" />
        </a>
      </section>

      {/* INSTITUTION TYPES */}
      <section className="py-12 bg-gray-50 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-widest mb-8">{t('landing.trusted_by')}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {institutionTypes.map((it, i) => (
              <div key={i} className="flex items-center gap-3 bg-white rounded-2xl px-5 py-4 shadow-sm border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <it.icon size={20} className="text-blue-600" />
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

      {/* FEATURES */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">{t('landing.why')}</span>
            <h2 className="text-4xl font-black text-gray-900 mt-3 mb-4">{t('landing.features_title')}</h2>
            <p className="text-lg text-gray-500">{t('landing.features_sub')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className="group p-7 rounded-2xl border border-gray-100 bg-white hover:border-blue-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 bg-${f.color}-50 group-hover:scale-110 transition-transform`}>
                  <f.icon size={22} className={`text-${f.color}-600`} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="py-20 bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-xl mx-auto text-center mb-12">
            <h2 className="text-3xl font-black text-white mb-3">{t('landing.testimonials_title')}</h2>
            <p className="text-white/50">{t('landing.testimonials_sub')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t2, i) => (
              <div key={i} className="glass rounded-2xl p-7 hover:bg-white/10 transition-colors">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t2.stars }).map((_, j) => <Star key={j} size={14} className="text-amber-400 fill-amber-400" />)}
                </div>
                <p className="text-white/80 text-sm leading-relaxed mb-5">"{t2.text}"</p>
                <div>
                  <p className="text-white font-semibold text-sm">{t2.name}</p>
                  <p className="text-white/40 text-xs mt-0.5">{t2.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="plans" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-xl mx-auto text-center mb-12">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">{t('landing.pricing_label')}</span>
            <h2 className="text-4xl font-black text-gray-900 mt-3 mb-4">{t('landing.pricing_title')}</h2>
            <p className="text-gray-500 mb-8">{t('landing.pricing_sub')}</p>
            {/* Billing toggle */}
            <div className="inline-flex items-center gap-3 bg-white rounded-2xl p-1 border border-gray-200 shadow-sm">
              <button onClick={() => setAnnualBilling(false)} className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${!annualBilling ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {t('plan.monthly')}
              </button>
              <button onClick={() => setAnnualBilling(true)} className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${annualBilling ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {t('plan.yearly')}
                <span className={`text-xs px-2 py-0.5 rounded-lg font-bold ${annualBilling ? 'bg-emerald-400/20 text-emerald-200' : 'bg-emerald-100 text-emerald-700'}`}>-20%</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan, i) => (
              <div key={i} className={`relative rounded-3xl p-7 flex flex-col transition-all duration-300 hover:-translate-y-1 ${plan.highlight ? 'bg-gradient-to-br from-blue-600 to-blue-700 shadow-2xl shadow-blue-600/30 scale-105' : 'bg-white border border-gray-100 shadow-sm hover:shadow-lg'}`}>
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-amber-400 to-amber-500 text-amber-900 text-xs font-bold rounded-full shadow-lg whitespace-nowrap">
                    {t('plan.popular')}
                  </div>
                )}
                <div className="mb-6">
                  <p className={`text-sm font-semibold mb-1 ${plan.highlight ? 'text-blue-200' : 'text-gray-500'}`}>{plan.name}</p>
                  {plan.custom ? (
                    <p className={`text-3xl font-black ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>{t('plan.contact')}</p>
                  ) : (
                    <div className="flex items-end gap-1">
                      <p className={`text-4xl font-black ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>
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
                  className={`w-full text-center py-3.5 rounded-2xl text-sm font-semibold transition-all duration-200 ${plan.highlight ? 'bg-white text-blue-600 hover:bg-blue-50 shadow-lg' : 'bg-gray-900 text-white hover:bg-gray-800'}`}>
                  {plan.custom ? t('plan.contact_us') : t('plan.start_trial')}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="relative bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl p-12 overflow-hidden shadow-2xl shadow-blue-600/30">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #a5f3fc, transparent)' }} />
              <div className="absolute -left-20 -bottom-20 w-48 h-48 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #6ee7b7, transparent)' }} />
            </div>
            <div className="relative">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Heart size={28} className="text-white" fill="white" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">{t('landing.cta_title')}</h2>
              <p className="text-blue-100 text-lg mb-8 max-w-xl mx-auto">{t('landing.cta_sub')}</p>
              <Link to="/signup"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-700 font-bold rounded-2xl hover:bg-blue-50 transition-colors shadow-xl text-base">
                {t('hero.cta.start')}
                <ArrowRight size={18} />
              </Link>
            </div>
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
