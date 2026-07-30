// Knowledge base for the self-service support chat widget (see
// SupportChatWidget in Dashboard.tsx). This is a real, working
// keyword-matched FAQ bot -- not a stub, and not an AI model. It answers
// common questions instantly without any human or AI in the loop; when
// nothing matches well enough, it offers to escalate straight to a real
// support ticket (support_tickets, already wired to Settings > Support)
// instead of leaving the person stuck.
//
// This intentionally does NOT call any AI/LLM API: doing so would need a
// third-party account (OpenAI, Anthropic, etc.) the same way Twilio/
// Sentry do. If you later want a smarter, natural-language bot, this
// same escalation path can be kept as the fallback when the AI is
// unavailable or not configured.

export type FaqEntry = { keywords: string[]; question: Record<'fr' | 'en', string>; answer: Record<'fr' | 'en', string> };

export const faqEntries: FaqEntry[] = [
  {
    keywords: ['password', 'mot de passe', 'reset', 'oublié', 'forgot'],
    question: { fr: 'Comment réinitialiser mon mot de passe ?', en: 'How do I reset my password?' },
    answer: {
      fr: "Sur l'écran de connexion, cliquez sur \"Mot de passe oublié\", entrez votre email, et suivez le lien reçu par email.",
      en: 'On the sign-in screen, click "Forgot password", enter your email, and follow the link you receive by email.',
    },
  },
  {
    keywords: ['2fa', 'mfa', 'deux facteurs', 'two-factor', 'authentification'],
    question: { fr: 'Comment activer le 2FA ?', en: 'How do I enable 2FA?' },
    answer: {
      fr: 'Allez dans Paramètres > Profil, section "Authentification à deux facteurs", cliquez sur "Activer le 2FA" et scannez le QR code avec une application comme Google Authenticator.',
      en: 'Go to Settings > Profile, "Two-factor authentication" section, click "Enable 2FA" and scan the QR code with an app like Google Authenticator.',
    },
  },
  {
    keywords: ['patient', 'ajouter patient', 'add patient', 'nouveau patient'],
    question: { fr: 'Comment ajouter un nouveau patient ?', en: 'How do I add a new patient?' },
    answer: {
      fr: 'Dans le module Patients, cliquez sur le bouton "+" en haut à droite, remplissez le formulaire et enregistrez.',
      en: 'In the Patients module, click the "+" button top-right, fill in the form, and save.',
    },
  },
  {
    keywords: ['équipe', 'team', 'inviter', 'invite', 'collègue', 'colleague', 'membre'],
    question: { fr: 'Comment inviter un collègue ?', en: 'How do I invite a teammate?' },
    answer: {
      fr: "Dans Paramètres > Équipe (visible pour le propriétaire de l'établissement), entrez l'email et choisissez un rôle, puis cliquez sur \"Inviter\". Un email d'invitation est envoyé automatiquement s'il n'a pas encore de compte.",
      en: 'In Settings > Team (visible to the institution owner), enter their email, choose a role, and click "Invite". An invitation email is sent automatically if they don\u2019t have an account yet.',
    },
  },
  {
    keywords: ['rôle', 'role', 'permission', 'accès', 'access', 'restrict'],
    question: { fr: 'Comment restreindre ce que voit un membre de mon équipe ?', en: "How do I restrict what a team member can see?" },
    answer: {
      fr: 'Créez un rôle personnalisé dans le module Rôles avec les permissions souhaitées, puis attribuez ce rôle au membre depuis Paramètres > Équipe.',
      en: 'Create a custom role in the Roles module with the permissions you want, then assign that role to the member from Settings > Team.',
    },
  },
  {
    keywords: ['plan', 'abonnement', 'subscription', 'upgrade', 'changer de plan', 'change plan'],
    question: { fr: 'Comment changer de plan ?', en: 'How do I change my plan?' },
    answer: {
      fr: "Dans Paramètres > Facturation, choisissez le nouveau plan et suivez les étapes de paiement.",
      en: 'In Settings > Billing, choose the new plan and follow the payment steps.',
    },
  },
  {
    keywords: ['export', 'télécharger', 'download', 'données', 'data'],
    question: { fr: 'Comment exporter mes données ?', en: 'How do I export my data?' },
    answer: {
      fr: "Un export complet (patients, rendez-vous, factures, dossiers médicaux) est disponible depuis l'écran de fin de période d'essai/grâce, ou en nous contactant via un ticket support pour un export à la demande.",
      en: 'A full export (patients, appointments, invoices, medical records) is available from the trial/grace-period screen, or by reaching out via a support ticket for an on-demand export.',
    },
  },
  {
    keywords: ['facture', 'invoice', 'paiement', 'payment', 'flutterwave'],
    question: { fr: 'Quels moyens de paiement sont acceptés ?', en: 'What payment methods are accepted?' },
    answer: {
      fr: 'Carte bancaire, Mobile Money (Orange/MTN), et virement bancaire via Flutterwave.',
      en: 'Card, Mobile Money (Orange/MTN), and bank transfer via Flutterwave.',
    },
  },
  {
    keywords: ['hors ligne', 'offline', 'connexion', 'internet', 'pas de réseau'],
    question: { fr: 'Puis-je utiliser Health Cloud sans connexion internet ?', en: 'Can I use Health Cloud without an internet connection?' },
    answer: {
      fr: "Vous pouvez consulter les données déjà chargées hors ligne. La création ou la modification de données nécessite une connexion.",
      en: 'You can view previously loaded data offline. Creating or editing data requires a connection.',
    },
  },
  {
    keywords: ['langue', 'language', 'français', 'anglais', 'traduction'],
    question: { fr: 'Comment changer la langue ?', en: 'How do I change the language?' },
    answer: {
      fr: "Cliquez sur le sélecteur de langue (FR/EN) en haut de l'écran, disponible sur toutes les pages.",
      en: 'Click the language toggle (FR/EN) at the top of the screen, available on every page.',
    },
  },
];

export function matchFaq(query: string, lang: 'fr' | 'en'): FaqEntry | null {
  const q = query.toLowerCase();
  let best: { entry: FaqEntry; score: number } | null = null;
  for (const entry of faqEntries) {
    const score = entry.keywords.filter((k) => q.includes(k.toLowerCase())).length;
    if (score > 0 && (!best || score > best.score)) best = { entry, score };
  }
  return best?.entry ?? null;
}
