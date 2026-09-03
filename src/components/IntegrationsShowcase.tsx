import { useI18n } from '../lib/i18n';

import openai from '../assets/integrations/openai.svg';
import flutterwave from '../assets/integrations/flutterwave.png';
import notion from '../assets/integrations/notion.png';
import twilio from '../assets/integrations/twilio.png';
import mailchimp from '../assets/integrations/mailchimp.png';
import googleCalendar from '../assets/integrations/google-calendar.png';
import googleDrive from '../assets/integrations/google-drive.png';
import googleMeet from '../assets/integrations/google-meet.png';
import zoom from '../assets/integrations/zoom.png';
import telegram from '../assets/integrations/telegram.jpg';
import whatsapp from '../assets/integrations/whatsapp.png';
import slack from '../assets/integrations/slack.png';
import payunit from '../assets/integrations/payunit.jpg';
import stripe from '../assets/integrations/stripe.png';
import outlook from '../assets/integrations/outlook.png';
import gmail from '../assets/integrations/gmail.png';
import gemini from '../assets/integrations/gemini.png';

type AppEntry = { name: string; logo: string; bg: string; useCaseKey: string };

// Real, working integrations partners — the same set surfaced to tenants in
// the in-app Integrations module (src/pages/Integrations.tsx) or reachable
// through the generic webhook connector there. Kept here as the marketing
// "logo wall"; each tile states one concrete way a clinic uses it.
const APPS: AppEntry[] = [
  { name: 'WhatsApp Business', logo: whatsapp, bg: 'bg-[#E9FBF0]', useCaseKey: 'integrations.use.whatsapp' },
  { name: 'Slack', logo: slack, bg: 'bg-[#F1EEFC]', useCaseKey: 'integrations.use.slack' },
  { name: 'Google Calendar', logo: googleCalendar, bg: 'bg-[#FDECEA]', useCaseKey: 'integrations.use.calendar' },
  { name: 'Google Meet', logo: googleMeet, bg: 'bg-[#E8F5EF]', useCaseKey: 'integrations.use.meet' },
  { name: 'Stripe', logo: stripe, bg: 'bg-[#EDEBFE]', useCaseKey: 'integrations.use.stripe' },
  { name: 'Flutterwave', logo: flutterwave, bg: 'bg-[#FFF6E5]', useCaseKey: 'integrations.use.flutterwave' },
  { name: 'PayUnit', logo: payunit, bg: 'bg-[#E7FAF7]', useCaseKey: 'integrations.use.payunit' },
  { name: 'Zoom', logo: zoom, bg: 'bg-[#EAF1FF]', useCaseKey: 'integrations.use.zoom' },
  { name: 'Telegram', logo: telegram, bg: 'bg-[#E7F6FE]', useCaseKey: 'integrations.use.telegram' },
  { name: 'Gmail', logo: gmail, bg: 'bg-[#FCECEA]', useCaseKey: 'integrations.use.gmail' },
  { name: 'Google Drive', logo: googleDrive, bg: 'bg-[#EAF6ED]', useCaseKey: 'integrations.use.drive' },
  { name: 'Outlook', logo: outlook, bg: 'bg-[#EAF3FF]', useCaseKey: 'integrations.use.outlook' },
  { name: 'Mailchimp', logo: mailchimp, bg: 'bg-[#FFF9E0]', useCaseKey: 'integrations.use.mailchimp' },
  { name: 'Notion', logo: notion, bg: 'bg-[#F4F4F4]', useCaseKey: 'integrations.use.notion' },
  { name: 'Twilio', logo: twilio, bg: 'bg-[#FDEAEC]', useCaseKey: 'integrations.use.twilio' },
  { name: 'OpenAI', logo: openai, bg: 'bg-[#F0F0F0]', useCaseKey: 'integrations.use.openai' },
  { name: 'Gemini', logo: gemini, bg: 'bg-[#EEF3FF]', useCaseKey: 'integrations.use.gemini' },
];

function LogoTile({ front, back, delay }: { front: AppEntry; back: AppEntry; delay: number }) {
  const { t } = useI18n();
  return (
    <div
      className="group relative reveal"
      title={`${front.name} — ${t(front.useCaseKey)}`}
      style={{ perspective: '600px', transitionDelay: `${(delay % 6) * 60}ms` }}
    >
      <div
        className="relative w-14 h-14 sm:w-16 sm:h-16 mx-auto animate-logo-flip"
        style={{ animationDelay: `${delay * 0.9}s` }}
      >
        <div className={`logo-flip-face absolute inset-0 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-center p-2.5 ${front.bg}`}>
          <img src={front.logo} alt={front.name} className="w-full h-full object-contain" loading="lazy" />
        </div>
        <div className={`logo-flip-face logo-flip-face-back absolute inset-0 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-center p-2.5 ${back.bg}`}>
          <img src={back.logo} alt={back.name} className="w-full h-full object-contain" loading="lazy" />
        </div>
      </div>
    </div>
  );
}

export function IntegrationsShowcase() {
  const { t } = useI18n();
  return (
    <section id="integrations" className="py-16 sm:py-20 bg-white border-y border-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="max-w-2xl mx-auto text-center mb-10 reveal">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">{t('integrations.showcase.label')}</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-3 mb-3">{t('integrations.showcase.title')}</h2>
          <p className="text-gray-500">{t('integrations.showcase.sub')}</p>
        </div>

        <div className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-10 gap-3 sm:gap-4 justify-items-center mb-8">
          {APPS.map((app, i) => (
            <LogoTile key={app.name} front={app} back={APPS[(i + 1) % APPS.length]} delay={i} />
          ))}
        </div>

        <div className="text-center">
          <a href="/app/integrations" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline">
            {t('integrations.showcase.cta')} →
          </a>
        </div>
      </div>
    </section>
  );
}
