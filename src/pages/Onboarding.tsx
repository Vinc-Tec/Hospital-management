import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, MapPin, FileText, CreditCard, CheckCircle2, ArrowRight, ArrowLeft, Check, Plus, X, Globe } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { useGeography } from '../lib/geography';
import { supabase } from '../lib/supabase';
import { Button, Input, Select, Card } from '../components/ui';
import { Logo, LangToggle, CopyrightLine } from '../components/brand';
import hospitalBg from '../assets/hospital-bg-light.svg';

const STEPS = [
  { key: 'org', icon: Building2 },
  { key: 'loc', icon: MapPin },
  { key: 'docs', icon: FileText },
  { key: 'plan', icon: CreditCard },
  { key: 'review', icon: CheckCircle2 },
];

const GATEWAYS = [
  { value: 'stripe', label: 'Stripe' },
  { value: 'flutterwave', label: 'Flutterwave' },
  { value: 'paystack', label: 'Paystack' },
  { value: 'orange_money', label: 'Orange Money' },
  { value: 'mtn_momo', label: 'MTN Mobile Money' },
  { value: 'visa', label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

type Plan = { id: string; name: string; code: string; price_monthly: number; price_yearly: number; max_users: number; max_doctors: number; max_branches: number; max_storage_gb: number; features: string[] };

export function Onboarding() {
  const { t } = useI18n();
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const geo = useGeography();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoaded, setPlansLoaded] = useState(false);
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedGateway, setSelectedGateway] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<{ currency_code: string | null; timezone: string | null } | null>(null);
  const [showCreateCity, setShowCreateCity] = useState(false);
  const [newCityName, setNewCityName] = useState('');
  const [showCreateLocality, setShowCreateLocality] = useState(false);
  const [newLocalityName, setNewLocalityName] = useState('');
  const [creating, setCreating] = useState(false);

  // Manual geography entry (country / region / district)
  const [showCreateCountry, setShowCreateCountry] = useState(false);
  const [newCountry, setNewCountry] = useState({ name: '', iso2: '', phone_code: '', currency_code: '', timezone: '' });
  const [showCreateRegion, setShowCreateRegion] = useState(false);
  const [newRegionName, setNewRegionName] = useState('');
  const [showCreateDistrict, setShowCreateDistrict] = useState(false);
  const [newDistrictName, setNewDistrictName] = useState('');

  const types = [
    { value: 'hospital', label: t('onb.type.hospital') },
    { value: 'clinic', label: t('onb.type.clinic') },
    { value: 'pharmacy', label: t('onb.type.pharmacy') },
    { value: 'lab', label: t('onb.type.lab') },
    { value: 'radiology', label: t('onb.type.radiology') },
    { value: 'health_center', label: t('onb.type.health_center') },
  ];

  const [form, setForm] = useState<Record<string, string>>({
    legal_name: '', commercial_name: '', healthcare_type: 'hospital',
    email: '', phone: '', website: '', num_doctors: '1', num_beds: '0',
    departments: '', services: '',
    country_id: '', region_id: '', district_id: '', city_id: '', locality_id: '',
    address: '', gps_lat: '', gps_lng: '',
    medical_license: '', business_registration: '', tax_certificate: '',
    owner_identification: '', insurance_documents: '',
    plan_id: '',
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Load country info when selected
  useEffect(() => {
    if (!form.country_id) { setSelectedCountry(null); return; }
    const c = geo.countries.find((x) => x.id === form.country_id);
    if (c) setSelectedCountry({ currency_code: c.currency_code, timezone: c.timezone });
  }, [form.country_id, geo.countries]);

  const loadPlans = async () => {
    if (plansLoaded) return;
    const { data } = await supabase.from('subscription_plans').select('id, name, code, price_monthly, price_yearly, max_users, max_doctors, max_branches, max_storage_gb, features').eq('is_active', true).order('sort_order');
    setPlans((data as Plan[]) ?? []);
    setPlansLoaded(true);
  };

  const createCity = async () => {
    if (!newCityName.trim() || !form.district_id) return;
    setCreating(true);
    const { data, error } = await supabase.from('cities').insert({ district_id: form.district_id, name: newCityName.trim() }).select().single();
    if (!error && data) {
      set('city_id', data.id);
      await geo.loadCities(form.district_id);
      setShowCreateCity(false); setNewCityName('');
    }
    setCreating(false);
  };

  const createLocality = async () => {
    if (!newLocalityName.trim() || !form.city_id) return;
    setCreating(true);
    const { data, error } = await supabase.from('localities').insert({ city_id: form.city_id, name: newLocalityName.trim() }).select().single();
    if (!error && data) {
      set('locality_id', data.id);
      await geo.loadLocalities(form.city_id);
      setShowCreateLocality(false); setNewLocalityName('');
    }
    setCreating(false);
  };

  const createCountry = async () => {
    if (!newCountry.name.trim() || !newCountry.iso2.trim()) return;
    setCreating(true);
    const { data, error } = await supabase.from('countries').insert({
      name: newCountry.name.trim(),
      iso2: newCountry.iso2.trim().toUpperCase(),
      phone_code: newCountry.phone_code.trim() || null,
      currency_code: newCountry.currency_code.trim() || null,
      timezone: newCountry.timezone.trim() || null,
    }).select().single();
    if (!error && data) {
      await geo.reloadCountries();
      set('country_id', data.id);
      set('region_id', ''); set('district_id', ''); set('city_id', ''); set('locality_id', '');
      setShowCreateCountry(false);
      setNewCountry({ name: '', iso2: '', phone_code: '', currency_code: '', timezone: '' });
    } else if (error) {
      setErr(error.message);
    }
    setCreating(false);
  };

  const createRegion = async () => {
    if (!newRegionName.trim() || !form.country_id) return;
    setCreating(true);
    const { data, error } = await supabase.from('regions').insert({ country_id: form.country_id, name: newRegionName.trim() }).select().single();
    if (!error && data) {
      await geo.loadRegions(form.country_id);
      set('region_id', data.id);
      set('district_id', ''); set('city_id', ''); set('locality_id', '');
      setShowCreateRegion(false); setNewRegionName('');
    } else if (error) {
      setErr(error.message);
    }
    setCreating(false);
  };

  const createDistrict = async () => {
    if (!newDistrictName.trim() || !form.region_id) return;
    setCreating(true);
    const { data, error } = await supabase.from('districts').insert({ region_id: form.region_id, name: newDistrictName.trim() }).select().single();
    if (!error && data) {
      await geo.loadDistricts(form.region_id);
      set('district_id', data.id);
      set('city_id', ''); set('locality_id', '');
      setShowCreateDistrict(false); setNewDistrictName('');
    } else if (error) {
      setErr(error.message);
    }
    setCreating(false);
  };

  const next = () => {
    if (step === 0) {
      if (!form.legal_name || !form.healthcare_type || !form.email) { setErr(t('onb.err.required')); return; }
    }
    if (step === 1) {
      if (!form.country_id || !form.region_id) { setErr(t('onb.err.required')); return; }
    }
    if (step === 3) {
      if (!form.plan_id) { setErr(t('onb.plan.required')); return; }
      if (!selectedGateway) { setErr(t('onb.gateway.required')); return; }
    }
    setErr(null);
    if (step === 2) loadPlans();
    setStep((s) => Math.min(s + 1, 4));
  };
  const back = () => { setErr(null); setStep((s) => Math.max(s - 1, 0)); };

  const submit = async () => {
    if (!user) { setErr(t('common.error')); return; }
    setSubmitting(true); setErr(null);

    const fullAddress = form.address || null;

    const payload = {
      owner_user_id: user.id,
      legal_name: form.legal_name,
      commercial_name: form.commercial_name || null,
      healthcare_type: form.healthcare_type,
      email: form.email,
      phone: form.phone || null,
      website: form.website || null,
      num_doctors: parseInt(form.num_doctors) || 0,
      num_beds: parseInt(form.num_beds) || 0,
      departments: form.departments ? form.departments.split(',').map((s) => s.trim()).filter(Boolean) : [],
      services: form.services ? form.services.split(',').map((s) => s.trim()).filter(Boolean) : [],
      country_id: form.country_id || null,
      region_id: form.region_id || null,
      district_id: form.district_id || null,
      city_id: form.city_id || null,
      locality_id: form.locality_id || null,
      address: fullAddress,
      gps_lat: form.gps_lat ? parseFloat(form.gps_lat) : null,
      gps_lng: form.gps_lng ? parseFloat(form.gps_lng) : null,
      medical_license: form.medical_license || null,
      business_registration: form.business_registration || null,
      tax_certificate: form.tax_certificate || null,
      owner_identification: form.owner_identification || null,
      insurance_documents: form.insurance_documents || null,
      payment_gateway: selectedGateway || null,
      currency_code: selectedCountry?.currency_code || 'XAF',
      timezone: selectedCountry?.timezone || 'Africa/Douala',
      // Billing-sensitive columns are governed server-side by the
      // fn_lock_tenant_insert trigger:
      //   - status is forced to 'pending' (only the Flutterwave webhook sets
      //     'approved' after a verified payment);
      //   - trial_ends_at is recomputed from platform_settings (the client
      //     value is ignored) so no arbitrary / infinite trial is possible;
      //   - grace_period_ends_at is cleared.
      // plan_id is intentionally kept (the chosen plan drives module access
      // during the trial via tenant_module_enabled); plan_id alone grants no
      // billing access because the "approved" branch also needs status =
      // 'approved', which the client can never set.
      plan_id: form.plan_id || null,
    };

    const { data: tenant, error: e1 } = await supabase.from('tenants').insert({ ...payload, onboarding_completed: true }).select().single();
    if (e1) { setErr(e1.message); setSubmitting(false); return; }

    const { error: e2 } = await supabase.from('tenant_memberships').insert({ tenant_id: tenant.id, user_id: user.id, role: 'admin', permissions: {} });
    if (e2) { setErr(e2.message); setSubmitting(false); return; }

    // Create head office branch
    await supabase.from('branches').insert({
      tenant_id: tenant.id, name: form.legal_name, healthcare_type: form.healthcare_type,
      is_head_office: true, address: fullAddress,
      country_id: form.country_id || null, region_id: form.region_id || null,
      district_id: form.district_id || null, city_id: form.city_id || null,
      status: 'active',
    });

    // Record subscription event
    await supabase.from('subscription_events').insert({
      tenant_id: tenant.id, event_type: 'subscription_created',
      metadata: { plan_id: form.plan_id, gateway: selectedGateway, billing_cycle: billing },
    });

    await supabase.from('audit_logs').insert({ tenant_id: tenant.id, actor_user_id: user.id, action: 'tenant.created', entity_type: 'tenants', entity_id: tenant.id, details: { legal_name: payload.legal_name } });
    await refresh();
    setSubmitting(false);
    setDone(true);
  };

  if (done) {
    return (
      <div className="min-h-screen flex flex-col relative bg-gradient-to-br from-blue-50 to-emerald-50">
        <div className="absolute inset-0 bg-cover bg-center pointer-events-none" style={{ backgroundImage: `url(${hospitalBg})`, opacity: 0.16 }} />
        <div className="relative flex-1 flex items-center justify-center px-4">
          <Card className="max-w-md w-full p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4"><CheckCircle2 size={32} className="text-emerald-600" /></div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('onb.success.title')}</h2>
            <p className="text-gray-500 text-sm mb-6">{t('onb.success.body')}</p>
            <Button className="w-full" onClick={() => nav('/app')}>{t('onb.goto.dashboard')} <ArrowRight size={16} /></Button>
          </Card>
        </div>
        <footer className="relative bg-gray-900 text-gray-400 py-6">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <CopyrightLine className="text-sm font-medium text-gray-300" />
          </div>
        </footer>
      </div>
    );
  }

  const selectedPlan = plans.find((p) => p.id === form.plan_id);

  return (
    <div className="min-h-screen flex flex-col relative bg-gray-50">
      <div className="absolute inset-0 bg-cover bg-center pointer-events-none" style={{ backgroundImage: `url(${hospitalBg})`, opacity: 0.12 }} />
      <header className="relative bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Logo />
          <LangToggle />
        </div>
      </header>
      <div className="relative flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('onb.title')}</h1>
        <p className="text-sm text-gray-500 mb-8">{t('onb.subtitle')}</p>

        <div className="flex items-center justify-between mb-8 max-w-2xl">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
                  {i < step ? <Check size={18} /> : <s.icon size={18} />}
                </div>
                <span className={`text-xs mt-1.5 hidden sm:block ${i === step ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>{t(`onb.step.${s.key}`)}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-2 ${i < step ? 'bg-emerald-400' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        <Card className="p-6">
          {step === 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label={t('onb.legal')} required value={form.legal_name} onChange={(e) => set('legal_name', e.target.value)} />
              <Input label={t('onb.commercial')} value={form.commercial_name} onChange={(e) => set('commercial_name', e.target.value)} />
              <Select label={t('onb.type')} required value={form.healthcare_type} options={types} onChange={(e) => set('healthcare_type', e.target.value)} />
              <Input label={t('onb.email')} type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} />
              <Input label={t('onb.phone')} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
              <Input label={t('onb.website')} value={form.website} onChange={(e) => set('website', e.target.value)} />
              <Input label={t('onb.doctors')} type="number" min="0" value={form.num_doctors} onChange={(e) => set('num_doctors', e.target.value)} />
              <Input label={t('onb.beds')} type="number" min="0" value={form.num_beds} onChange={(e) => set('num_beds', e.target.value)} />
              <Input label={t('onb.departments')} placeholder={t('onb.departments.ph')} value={form.departments} onChange={(e) => set('departments', e.target.value)} />
              <Input label={t('onb.services')} placeholder={t('onb.services.ph')} value={form.services} onChange={(e) => set('services', e.target.value)} />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('onb.loc.section.location')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Select label={t('onb.country')} required value={form.country_id} options={geo.countries.map((c) => ({ value: c.id, label: c.name }))} loading={geo.loading} onChange={(e) => { set('country_id', e.target.value); set('region_id', ''); set('district_id', ''); set('city_id', ''); set('locality_id', ''); geo.loadRegions(e.target.value); }} />
                    <button type="button" onClick={() => setShowCreateCountry(true)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                      <Plus size={12} /> {t('onb.add_country')}
                    </button>
                  </div>
                  <div className="space-y-2">
                    <Select label={t('onb.region')} required value={form.region_id} options={geo.regions.map((r) => ({ value: r.id, label: r.name }))} onChange={(e) => { set('region_id', e.target.value); set('district_id', ''); set('city_id', ''); set('locality_id', ''); geo.loadDistricts(e.target.value); }} />
                    {form.country_id && (
                      <button type="button" onClick={() => setShowCreateRegion(true)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                        <Plus size={12} /> {t('onb.add_region')}
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Select label={t('onb.district')} value={form.district_id} options={geo.districts.map((d) => ({ value: d.id, label: d.name }))} onChange={(e) => { set('district_id', e.target.value); set('city_id', ''); set('locality_id', ''); geo.loadCities(e.target.value); }} />
                    {form.region_id && (
                      <button type="button" onClick={() => setShowCreateDistrict(true)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                        <Plus size={12} /> {t('onb.add_district')}
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Select label={t('onb.city')} value={form.city_id} options={geo.cities.map((c) => ({ value: c.id, label: c.name }))} onChange={(e) => { set('city_id', e.target.value); set('locality_id', ''); geo.loadLocalities(e.target.value); }} />
                    {form.district_id && (
                      <button type="button" onClick={() => setShowCreateCity(true)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                        <Plus size={12} /> {t('onb.add_city')}
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Select label={t('onb.locality')} value={form.locality_id} options={geo.localities.map((l) => ({ value: l.id, label: l.name }))} onChange={(e) => set('locality_id', e.target.value)} />
                    {form.city_id && (
                      <button type="button" onClick={() => setShowCreateLocality(true)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                        <Plus size={12} /> {t('onb.add_locality')}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Auto-filled currency and timezone */}
              {selectedCountry && (selectedCountry.currency_code || selectedCountry.timezone) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-blue-50 border border-blue-100">
                  <div className="flex items-center gap-2">
                    <Globe size={16} className="text-blue-600" />
                    <div>
                      <p className="text-xs text-gray-500">{t('onb.currency')}</p>
                      <p className="text-sm font-medium text-gray-900">{selectedCountry.currency_code || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe size={16} className="text-blue-600" />
                    <div>
                      <p className="text-xs text-gray-500">{t('onb.timezone')}</p>
                      <p className="text-sm font-medium text-gray-900">{selectedCountry.timezone || '—'}</p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('onb.loc.section.address')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label={t('onb.address')} value={form.address} onChange={(e) => set('address', e.target.value)} />
                  <div className="grid grid-cols-2 gap-3">
                    <Input label={t('onb.loc.gps.lat')} type="number" value={form.gps_lat} onChange={(e) => set('gps_lat', e.target.value)} />
                    <Input label={t('onb.loc.gps.lng')} type="number" value={form.gps_lng} onChange={(e) => set('gps_lng', e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label={t('onb.license')} value={form.medical_license} onChange={(e) => set('medical_license', e.target.value)} />
              <Input label={t('onb.businessreg')} value={form.business_registration} onChange={(e) => set('business_registration', e.target.value)} />
              <Input label={t('onb.taxcert')} value={form.tax_certificate} onChange={(e) => set('tax_certificate', e.target.value)} />
              <Input label={t('onb.ownerid')} value={form.owner_identification} onChange={(e) => set('owner_identification', e.target.value)} />
              <Input label={t('onb.insurance')} value={form.insurance_documents} onChange={(e) => set('insurance_documents', e.target.value)} />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              {/* Billing toggle */}
              <div className="flex justify-center">
                <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
                  <button onClick={() => setBilling('monthly')} className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${billing === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>{t('plan.monthly')}</button>
                  <button onClick={() => setBilling('yearly')} className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${billing === 'yearly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>{t('plan.yearly')} <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">-20%</span></button>
                </div>
              </div>

              {/* Plans */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {plans.length === 0 && !plansLoaded && <p className="text-sm text-gray-400">{t('common.loading')}</p>}
                {plans.map((p) => (
                  <label key={p.id} className={`flex flex-col p-4 rounded-xl border-2 cursor-pointer transition-all ${form.plan_id === p.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <input type="radio" name="plan" checked={form.plan_id === p.id} onChange={() => set('plan_id', p.id)} className="accent-blue-600" />
                        <span className="font-semibold text-gray-900">{p.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-gray-900 font-bold">${billing === 'yearly' ? Math.round((p.price_yearly ?? p.price_monthly * 10) / 12) : p.price_monthly}</span>
                        <span className="text-gray-400 text-xs">/{t('plan.month')}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-500 mt-2">
                      <span>{t('onb.plan.max_users')}: <strong className="text-gray-700">{p.max_users === 999 ? '∞' : p.max_users}</strong></span>
                      <span>{t('onb.plan.max_doctors')}: <strong className="text-gray-700">{p.max_doctors === 999 ? '∞' : p.max_doctors}</strong></span>
                      <span>{t('onb.plan.max_branches')}: <strong className="text-gray-700">{p.max_branches === 999 ? '∞' : p.max_branches}</strong></span>
                      <span>{t('onb.plan.max_storage')}: <strong className="text-gray-700">{p.max_storage_gb >= 1000 ? '∞' : p.max_storage_gb}</strong></span>
                    </div>
                    {p.features && p.features.length > 0 && (
                      <p className="text-xs text-gray-400 mt-2">{p.features.slice(0, 3).join(' · ')}</p>
                    )}
                  </label>
                ))}
              </div>

              {/* Payment gateway */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3">{t('onb.payment.step')}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {GATEWAYS.map((g) => (
                    <button key={g.value} type="button" onClick={() => setSelectedGateway(g.value)}
                      className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${selectedGateway === g.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300 text-gray-600'}`}>
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">{t('onb.step.review')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div className="flex justify-between border-b border-gray-50 py-1.5"><span className="text-gray-400">{t('onb.legal')}</span><span className="text-gray-900 font-medium text-right">{form.legal_name}</span></div>
                <div className="flex justify-between border-b border-gray-50 py-1.5"><span className="text-gray-400">{t('onb.type')}</span><span className="text-gray-900 font-medium text-right">{types.find((x) => x.value === form.healthcare_type)?.label ?? form.healthcare_type}</span></div>
                <div className="flex justify-between border-b border-gray-50 py-1.5"><span className="text-gray-400">{t('onb.email')}</span><span className="text-gray-900 font-medium text-right">{form.email}</span></div>
                <div className="flex justify-between border-b border-gray-50 py-1.5"><span className="text-gray-400">{t('onb.phone')}</span><span className="text-gray-900 font-medium text-right">{form.phone || '—'}</span></div>
                <div className="flex justify-between border-b border-gray-50 py-1.5"><span className="text-gray-400">{t('onb.currency')}</span><span className="text-gray-900 font-medium text-right">{selectedCountry?.currency_code || '—'}</span></div>
                <div className="flex justify-between border-b border-gray-50 py-1.5"><span className="text-gray-400">{t('onb.timezone')}</span><span className="text-gray-900 font-medium text-right">{selectedCountry?.timezone || '—'}</span></div>
                <div className="flex justify-between border-b border-gray-50 py-1.5"><span className="text-gray-400">{t('onb.doctors')}</span><span className="text-gray-900 font-medium text-right">{form.num_doctors}</span></div>
                <div className="flex justify-between border-b border-gray-50 py-1.5"><span className="text-gray-400">{t('onb.beds')}</span><span className="text-gray-900 font-medium text-right">{form.num_beds}</span></div>
                <div className="flex justify-between border-b border-gray-50 py-1.5"><span className="text-gray-400">{t('onb.license')}</span><span className="text-gray-900 font-medium text-right">{form.medical_license || '—'}</span></div>
                <div className="flex justify-between border-b border-gray-50 py-1.5"><span className="text-gray-400">{t('onb.step.plan')}</span><span className="text-gray-900 font-medium text-right">{selectedPlan?.name ?? '—'}</span></div>
                <div className="flex justify-between border-b border-gray-50 py-1.5"><span className="text-gray-400">{t('onb.payment.step')}</span><span className="text-gray-900 font-medium text-right">{GATEWAYS.find((g) => g.value === selectedGateway)?.label ?? '—'}</span></div>
                <div className="flex justify-between border-b border-gray-50 py-1.5"><span className="text-gray-400">{t('onb.address')}</span><span className="text-gray-900 font-medium text-right">{form.address || '—'}</span></div>
              </div>
            </div>
          )}
          {err && <p className="mt-4 text-sm text-red-600">{err}</p>}
        </Card>

        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={back} disabled={step === 0}><ArrowLeft size={16} /> {t('onb.back')}</Button>
          {step < 4 ? <Button onClick={next}>{t('onb.next')} <ArrowRight size={16} /></Button> : <Button onClick={submit} loading={submitting}>{t('onb.submit')}</Button>}
        </div>
      </div>

      {/* Create city modal */}
      {showCreateCity && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setShowCreateCity(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">{t('onb.create_city')}</h3>
              <button onClick={() => setShowCreateCity(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <Input label={t('onb.new_city_name')} required value={newCityName} onChange={(e) => setNewCityName(e.target.value)} />
            <Button className="w-full mt-4" onClick={createCity} loading={creating}>{t('onb.create_city')}</Button>
          </div>
        </div>
      )}

      {/* Create locality modal */}
      {showCreateLocality && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setShowCreateLocality(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">{t('onb.create_locality')}</h3>
              <button onClick={() => setShowCreateLocality(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <Input label={t('onb.new_locality_name')} required value={newLocalityName} onChange={(e) => setNewLocalityName(e.target.value)} />
            <Button className="w-full mt-4" onClick={createLocality} loading={creating}>{t('onb.create_locality')}</Button>
          </div>
        </div>
      )}

      {/* Create country modal (manual entry) */}
      {showCreateCountry && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setShowCreateCountry(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">{t('onb.create_country')}</h3>
              <button onClick={() => setShowCreateCountry(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <Input label={t('onb.new_country_name')} required value={newCountry.name} onChange={(e) => setNewCountry((c) => ({ ...c, name: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <Input label={t('onb.country_iso2')} required maxLength={2} value={newCountry.iso2} onChange={(e) => setNewCountry((c) => ({ ...c, iso2: e.target.value }))} />
                <Input label={t('onb.country_phone_code')} value={newCountry.phone_code} onChange={(e) => setNewCountry((c) => ({ ...c, phone_code: e.target.value }))} />
                <Input label={t('onb.country_currency')} value={newCountry.currency_code} onChange={(e) => setNewCountry((c) => ({ ...c, currency_code: e.target.value }))} />
                <Input label={t('onb.country_timezone')} value={newCountry.timezone} onChange={(e) => setNewCountry((c) => ({ ...c, timezone: e.target.value }))} />
              </div>
            </div>
            <Button className="w-full mt-4" onClick={createCountry} loading={creating}>{t('onb.create_country')}</Button>
          </div>
        </div>
      )}

      {/* Create region modal (manual entry) */}
      {showCreateRegion && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setShowCreateRegion(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">{t('onb.create_region')}</h3>
              <button onClick={() => setShowCreateRegion(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <Input label={t('onb.new_region_name')} required value={newRegionName} onChange={(e) => setNewRegionName(e.target.value)} />
            <Button className="w-full mt-4" onClick={createRegion} loading={creating}>{t('onb.create_region')}</Button>
          </div>
        </div>
      )}

      {/* Create district modal (manual entry) */}
      {showCreateDistrict && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setShowCreateDistrict(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">{t('onb.create_district')}</h3>
              <button onClick={() => setShowCreateDistrict(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <Input label={t('onb.new_district_name')} required value={newDistrictName} onChange={(e) => setNewDistrictName(e.target.value)} />
            <Button className="w-full mt-4" onClick={createDistrict} loading={creating}>{t('onb.create_district')}</Button>
          </div>
        </div>
      )}

      <footer className="relative bg-gray-900 text-gray-400 py-6">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <CopyrightLine className="text-sm font-medium text-gray-300" />
        </div>
      </footer>
    </div>
  );
}
