import { Fragment } from 'react';
import {
  Users, CalendarDays, Stethoscope, FileText, ClipboardList, Pill, FlaskConical,
  ScanLine, BedDouble, LogIn, Scissors, Siren, Video, Syringe, FileOutput,
  ShieldPlus, Receipt, Boxes, FileBarChart, UserCog, Briefcase, Wallet,
  ShieldCheck, TrendingUp, Plug, Key, Check, Minus, type LucideIcon,
} from 'lucide-react';
import { useI18n } from '../lib/i18n';

type PlanCol = 0 | 1 | 2 | 3; // Starter, Professional, Business, Enterprise

type ModuleRow = { icon: LucideIcon; labelKey: string; plans: [boolean, boolean, boolean, boolean] };

// Mirrors, module for module, the real `subscription_plans.module_flags`
// seeded in supabase/migrations/20260726090000_missing_modules_and_plan_gating.sql
// and supabase/migrations/20260824000000_integrations_module.sql — this is
// the same data that actually gates each route via ModuleGate in App.tsx,
// not independent marketing copy. If a plan's entitlements ever change,
// this table (and the migration) both need updating together.
const CATEGORIES: { titleKey: string; rows: ModuleRow[] }[] = [
  {
    titleKey: 'matrix.cat.core',
    rows: [
      { icon: Users, labelKey: 'dash.nav.patients', plans: [true, true, true, true] },
      { icon: CalendarDays, labelKey: 'dash.nav.appointments', plans: [true, true, true, true] },
      { icon: Stethoscope, labelKey: 'dash.nav.doctors', plans: [true, true, true, true] },
      { icon: Receipt, labelKey: 'dash.nav.invoices', plans: [true, true, true, true] },
      { icon: FileBarChart, labelKey: 'dash.nav.reports', plans: [true, true, true, true] },
    ],
  },
  {
    titleKey: 'matrix.cat.clinical',
    rows: [
      { icon: FileText, labelKey: 'dash.nav.records', plans: [false, true, true, true] },
      { icon: ClipboardList, labelKey: 'dash.nav.consultations', plans: [false, true, true, true] },
      { icon: Pill, labelKey: 'dash.nav.prescriptions', plans: [false, true, true, true] },
      { icon: FlaskConical, labelKey: 'dash.nav.lab', plans: [false, true, true, true] },
      { icon: Pill, labelKey: 'dash.nav.pharmacy', plans: [false, true, true, true] },
    ],
  },
  {
    titleKey: 'matrix.cat.operations',
    rows: [
      { icon: ScanLine, labelKey: 'dash.nav.radiology', plans: [false, false, true, true] },
      { icon: BedDouble, labelKey: 'dash.nav.beds', plans: [false, false, true, true] },
      { icon: LogIn, labelKey: 'dash.nav.admissions', plans: [false, false, true, true] },
      { icon: Scissors, labelKey: 'dash.nav.surgeries', plans: [false, false, true, true] },
      { icon: Boxes, labelKey: 'dash.nav.inventory', plans: [false, false, true, true] },
      { icon: Briefcase, labelKey: 'dash.nav.hr', plans: [false, false, true, true] },
      { icon: Wallet, labelKey: 'dash.nav.payroll', plans: [false, false, true, true] },
      { icon: UserCog, labelKey: 'dash.nav.staff', plans: [false, false, true, true] },
      { icon: ShieldCheck, labelKey: 'dash.nav.roles', plans: [false, false, true, true] },
    ],
  },
  {
    titleKey: 'matrix.cat.advanced',
    rows: [
      { icon: TrendingUp, labelKey: 'dash.nav.performance', plans: [false, false, false, true] },
      { icon: Video, labelKey: 'dash.nav.telemedicine', plans: [false, false, false, true] },
      { icon: ShieldPlus, labelKey: 'dash.nav.insurance', plans: [false, false, false, true] },
      { icon: Siren, labelKey: 'dash.nav.emergency', plans: [false, false, false, true] },
      { icon: Syringe, labelKey: 'dash.nav.immunizations', plans: [false, false, false, true] },
      { icon: FileOutput, labelKey: 'dash.nav.discharge', plans: [false, false, false, true] },
    ],
  },
  {
    titleKey: 'matrix.cat.connect',
    rows: [
      { icon: Plug, labelKey: 'dash.nav.integrations', plans: [false, true, true, true] },
      { icon: Key, labelKey: 'settings.api', plans: [false, false, true, true] },
    ],
  },
];

const PLAN_NAMES = ['Starter', 'Professional', 'Business', 'Enterprise'];
const HIGHLIGHT: PlanCol = 1;

export function PricingMatrix() {
  const { t } = useI18n();
  return (
    <div className="mt-14 reveal">
      <div className="max-w-2xl mx-auto text-center mb-8">
        <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">{t('matrix.title')}</h3>
        <p className="text-sm text-gray-500">{t('matrix.sub')}</p>
      </div>

      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="text-left font-semibold text-gray-500 pb-3 pr-4 w-1/3 align-bottom">{t('matrix.module_col')}</th>
              {PLAN_NAMES.map((name, i) => (
                <th key={name} className={`text-center font-semibold pb-3 px-2 align-bottom ${i === HIGHLIGHT ? 'text-blue-600' : 'text-gray-700'}`}>
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map((cat) => (
              <Fragment key={cat.titleKey}>
                <tr className="bg-gray-50/80">
                  <td colSpan={5} className="text-xs font-bold uppercase tracking-widest text-gray-400 py-2 px-2 rounded-md">
                    {t(cat.titleKey)}
                  </td>
                </tr>
                {cat.rows.map((row) => (
                  <tr key={row.labelKey} className="border-b border-gray-100 last:border-0">
                    <td className="py-2.5 pr-4">
                      <span className="inline-flex items-center gap-2 text-gray-700">
                        <row.icon size={15} className="text-gray-400 flex-shrink-0" />
                        {t(row.labelKey)}
                      </span>
                    </td>
                    {row.plans.map((included, i) => (
                      <td key={i} className={`text-center py-2.5 px-2 ${i === HIGHLIGHT ? 'bg-blue-50/50' : ''}`}>
                        {included ? (
                          <Check size={16} className="inline text-emerald-500" strokeWidth={2.5} />
                        ) : (
                          <span className="inline-flex items-center gap-1 text-gray-300 line-through decoration-gray-300">
                            <Minus size={13} />
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
