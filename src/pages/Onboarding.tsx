import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, MapPin, FileText, CreditCard, CheckCircle2, ArrowRight, ArrowLeft, Check, Pencil } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { useGeography } from '../lib/geography';
import { supabase } from '../lib/supabase';
import { Button, Input, Select, Card } from '../components/ui';
import { Logo, LangToggle } from '../components/brand';

const STEPS = [
  { key: 'org', icon: Building2 },
  { key: 'loc', icon: MapPin },
  { key: 'docs', icon: FileText },
  { key: 'plan', icon: CreditCard },
  { key: 'review', icon: CheckCircle2 },
];

export function Onboarding() {
  const { t } = useI18n();
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const geo = useGeography();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [plans, setPlans] = useState<{ id: string; name: string; price_monthly: number; price_yearly: number; features: string[] }[]>([]);
  const [plansLoaded, setPlansLoaded] = useState(false);
  const [manualLoc, setManualLoc] = useState(false);

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
    manual_country: '', manual_region: '', manual_district: '', manual_city: '', manual_locality: '',
    address: '', gps_lat: '', gps_lng: '',
    medical_license: '', business_registration: '', tax_certificate: '',
    owner_identification: '', insurance_documents: '', payment_gateway: '',
    plan_id: '',
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const loadPlans = async () => {
    if (plansLoaded) return;
    const { data } = await supabase.from('subscription_plans').select('id, name, price_monthly, price_yearly, features').eq('is_active', true).order('sort_order');
    setPlans((data as any) ?? []);
    setPlansLoaded(true);
  };

  const next = () => {
    if (step === 0) {
      if (!form.legal_name || !form.healthcare_type || !form.email) { setErr(t('onb.err.required')); return; }
    }
    if (step === 1) {
      if (manualLoc) {
        if (!form.manual_country) { setErr(t('onb.err.required')); return; }
      } else {
        if (!form.country_id || !form.region_id) { setErr(t('onb.err.required')); return; }
      }
    }
    setErr(null);
    if (step === 3) loadPlans();
    setStep((s) => Math.min(s + 1, 4));
  };
  const back = () => { setErr(null); setStep((s) => Math.max(s - 1, 0)); };

  const submit = async () => {
    if (!user) { setErr(t('common.error')); return; }
    setSubmitting(true); setErr(null);

    const fullAddress = manualLoc
      ? [form.manual_locality, form.manual_city, form.manual_district, form.manual_region, form.manual_country].filter(Boolean).join(', ') + (form.address ? ` — ${form.address}` : '')
      : form.address || null;

    const payload = {
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
      country_id: manualLoc ? null : (form.country_id || null),
      region_id: manualLoc ? null : (form.region_id || null),
      district_id: manualLoc ? null : (form.district_id || null),
      city_id: manualLoc ? null : (form.city_id || null),
      locality_id: manualLoc ? null : (form.locality_id || null),
      address: fullAddress,
      gps_lat: form.gps_lat ? parseFloat(form.gps_lat) : null,
      gps_lng: form.gps_lng ? parseFloat(form.gps_lng) : null,
      medical_license: form.medical_license || null,
      business_registration: form.business_registration || null,
      tax_certificate: form.tax_certificate || null,
      owner_identification: form.owner_identification || null,
      insurance_documents: form.insurance_documents || null,
      payment_gateway: form.payment_gateway || null,
      plan_id: form.plan_id || null,
    };

    const { data: tenant, error: e1 } = await supabase.from('tenants').insert(payload).select().single();
    if (e1) { setErr(e1.message); setSubmitting(false); return; }
    const { error: e2 } = await supabase.from('tenant_memberships').insert({ tenant_id: tenant.id, user_id: user.id, role: 'admin', permissions: {} });
    if (e2) { setErr(e2.message); setSubmitting(false); return; }
    await supabase.from('audit_logs').insert({ tenant_id: tenant.id, actor_user_id: user.id, action: 'tenant.created', entity_type: 'tenants', entity_id: tenant.id, details: { legal_name: payload.legal_name } });
    await refresh();
    setSubmitting(false);
    setDone(true);
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-emerald-50 px-4">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4"><CheckCircle2 size={32} className="text-emerald-600" /></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('onb.success.title')}</h2>
          <p className="text-gray-500 text-sm mb-6">{t('onb.success.body')}</p>
          <Button className="w-full" onClick={() => nav('/app')}>{t('onb.goto.dashboard')} <ArrowRight size={16} /></Button>
        </Card>
      </div>
    );
  }

  const reviewItems = manualLoc
    ? [
        { label: t('onb.legal'), value: form.legal_name },
        { label: t('onb.type'), value: types.find((x) => x.value === form.healthcare_type)?.label ?? form.healthcare_type },
        { label: t('onb.email'), value: form.email },
        { label: t('onb.phone'), value: form.phone || '—' },
        { label: t('onb.country'), value: form.manual_country },
        { label: t('onb.region'), value: form.manual_region || '—' },
        { label: t('onb.district'), value: form.manual_district || '—' },
        { label: t('onb.city'), value: form.manual_city || '—' },
        { label: t('onb.locality'), value: form.manual_locality || '—' },
        { label: t('onb.address'), value: form.address || '—' },
        { label: t('onb.doctors'), value: form.num_doctors },
        { label: t('onb.beds'), value: form.num_beds },
        { label: t('onb.departments'), value: form.departments || '—' },
        { label: t('onb.services'), value: form.services || '—' },
        { label: t('onb.license'), value: form.medical_license || '—' },
        { label: t('onb.payment'), value: form.payment_gateway || '—' },
      ]
    : [
        { label: t('onb.legal'), value: form.legal_name },
        { label: t('onb.type'), value: types.find((x) => x.value === form.healthcare_type)?.label ?? form.healthcare_type },
        { label: t('onb.email'), value: form.email },
        { label: t('onb.phone'), value: form.phone || '—' },
        { label: t('onb.doctors'), value: form.num_doctors },
        { label: t('onb.beds'), value: form.num_beds },
        { label: t('onb.departments'), value: form.departments || '—' },
        { label: t('onb.services'), value: form.services || '—' },
        { label: t('onb.license'), value: form.medical_license || '—' },
        { label: t('onb.payment'), value: form.payment_gateway || '—' },
      ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Logo />
          <LangToggle />
        </div>
      </header>
      <div className="max-w-4xl mx-auto px-4 py-8">
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
            <>
              <div className="flex items-center justify-end mb-4">
                <button
                  onClick={() => setManualLoc((m) => !m)}
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Pencil size={14} /> {manualLoc ? t('onb.loc.dropdown') : t('onb.loc.manual')}
                </button>
              </div>

              {manualLoc ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label={t('onb.country')} required value={form.manual_country} onChange={(e) => set('manual_country', e.target.value)} />
                  <Input label={t('onb.region')} value={form.manual_region} onChange={(e) => set('manual_region', e.target.value)} />
                  <Input label={t('onb.district')} value={form.manual_district} onChange={(e) => set('manual_district', e.target.value)} />
                  <Input label={t('onb.city')} value={form.manual_city} onChange={(e) => set('manual_city', e.target.value)} />
                  <Input label={t('onb.locality')} value={form.manual_locality} onChange={(e) => set('manual_locality', e.target.value)} />
                  <Input label={t('onb.address')} value={form.address} onChange={(e) => set('address', e.target.value)} />
                  <Input label="GPS Lat" type="number" value={form.gps_lat} onChange={(e) => set('gps_lat', e.target.value)} />
                  <Input label="GPS Lng" type="number" value={form.gps_lng} onChange={(e) => set('gps_lng', e.target.value)} />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Select label={t('onb.country')} required value={form.country_id} options={geo.countries.map((c) => ({ value: c.id, label: c.name }))} loading={geo.loading} onChange={(e) => { set('country_id', e.target.value); set('region_id', ''); set('district_id', ''); set('city_id', ''); set('locality_id', ''); geo.loadRegions(e.target.value); }} />
                  <Select label={t('onb.region')} required value={form.region_id} options={geo.regions.map((r) => ({ value: r.id, label: r.name }))} onChange={(e) => { set('region_id', e.target.value); set('district_id', ''); set('city_id', ''); set('locality_id', ''); geo.loadDistricts(e.target.value); }} />
                  <Select label={t('onb.district')} value={form.district_id} options={geo.districts.map((d) => ({ value: d.id, label: d.name }))} onChange={(e) => { set('district_id', e.target.value); set('city_id', ''); set('locality_id', ''); geo.loadCities(e.target.value); }} />
                  <Select label={t('onb.city')} value={form.city_id} options={geo.cities.map((c) => ({ value: c.id, label: c.name }))} onChange={(e) => { set('city_id', e.target.value); set('locality_id', ''); geo.loadLocalities(e.target.value); }} />
                  <Select label={t('onb.locality')} value={form.locality_id} options={geo.localities.map((l) => ({ value: l.id, label: l.name }))} onChange={(e) => set('locality_id', e.target.value)} />
                  <Input label={t('onb.address')} value={form.address} onChange={(e) => set('address', e.target.value)} />
                  <Input label="GPS Lat" type="number" value={form.gps_lat} onChange={(e) => set('gps_lat', e.target.value)} />
                  <Input label="GPS Lng" type="number" value={form.gps_lng} onChange={(e) => set('gps_lng', e.target.value)} />
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label={t('onb.license')} value={form.medical_license} onChange={(e) => set('medical_license', e.target.value)} />
              <Input label={t('onb.businessreg')} value={form.business_registration} onChange={(e) => set('business_registration', e.target.value)} />
              <Input label={t('onb.taxcert')} value={form.tax_certificate} onChange={(e) => set('tax_certificate', e.target.value)} />
              <Input label={t('onb.ownerid')} value={form.owner_identification} onChange={(e) => set('owner_identification', e.target.value)} />
              <Input label={t('onb.insurance')} value={form.insurance_documents} onChange={(e) => set('insurance_documents', e.target.value)} />
              <Select label={t('onb.payment')} value={form.payment_gateway} options={[
                { value: 'stripe', label: 'Stripe' },
                { value: 'flutterwave', label: 'Flutterwave' },
                { value: 'paystack', label: 'Paystack' },
                { value: 'orange_money', label: 'Orange Money' },
                { value: 'mtn_momo', label: 'MTN Mobile Money' },
              ]} onChange={(e) => set('payment_gateway', e.target.value)} />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              {plans.length === 0 && !plansLoaded && <p className="text-sm text-gray-400">{t('common.loading')}</p>}
              {plans.map((p) => (
                <label key={p.id} className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-colors ${form.plan_id === p.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="flex items-center gap-3">
                    <input type="radio" name="plan" checked={form.plan_id === p.id} onChange={() => set('plan_id', p.id)} className="accent-blue-600" />
                    <div>
                      <span className="font-medium text-gray-900">{p.name}</span>
                      {p.features && p.features.length > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5">{p.features.slice(0, 3).join(' · ')}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-gray-900 font-semibold">${p.price_monthly}</span>
                    <span className="text-gray-400 text-sm">/{t('plan.month')}</span>
                    {p.price_yearly > 0 && <p className="text-xs text-gray-400">${p.price_yearly}/{t('plan.year')}</p>}
                  </div>
                </label>
              ))}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">{t('onb.step.review')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {reviewItems.map((item, i) => (
                  <div key={i} className="flex justify-between border-b border-gray-50 py-1.5">
                    <span className="text-gray-400">{item.label}</span>
                    <span className="text-gray-900 font-medium text-right">{item.value}</span>
                  </div>
                ))}
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
    </div>
  );
}
