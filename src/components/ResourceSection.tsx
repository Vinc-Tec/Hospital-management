import { ArrowRight } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import resourcePhoto from '../assets/photos/doctor-patient-consult.jpg';

export function ResourceSection() {
  const { t } = useI18n();
  return (
    <section className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center reveal">
          <div>
            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">{t('insight.label')}</span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mt-3 mb-4 leading-tight">
              {t('insight.title')}
            </h2>
            <p className="text-sm font-semibold text-gray-800 mb-1">{t('insight.byline')}</p>
            <p className="text-gray-500 leading-relaxed mb-8 max-w-lg">
              {t('insight.excerpt')}
            </p>
            <a
              href="/insights/data-ready-healthcare"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors text-sm"
            >
              {t('insight.cta')}
              <ArrowRight size={16} />
            </a>
          </div>
          <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-lg">
            <img src={resourcePhoto} alt={t('insight.title')} className="w-full h-[280px] sm:h-[340px] object-cover" loading="lazy" />
          </div>
        </div>
      </div>
    </section>
  );
}
