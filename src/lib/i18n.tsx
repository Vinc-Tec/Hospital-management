import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type Lang = 'fr' | 'en';
type Dict = Record<string, string>;

const fr: Dict = {
  'app.name': 'Health Cloud', 'app.tagline': 'Une plateforme. Chaque établissement de santé.',
  'app.developed': 'Développé par LIYAH GROUP', 'app.cameroon': '100% Technologie Camerounaise',
  'nav.signin': 'Connexion', 'nav.signup': "S'inscrire", 'nav.dashboard': 'Tableau de bord', 'nav.signout': 'Déconnexion',
  'hero.title': "La plateforme de santé cloud pour toute l'Afrique",
  'hero.subtitle': 'Gérez votre établissement de santé avec une solution moderne, sécurisée et multilocale. Isolation stricte des données par établissement.',
  'hero.cta': "Commencer l'essai gratuit", 'hero.cta2': 'Voir les offres',
  'feature.isolation.title': 'Isolation multi-locataire stricte', 'feature.isolation.desc': 'Chaque établissement possède un espace de travail isolé. Aucun accès croisé possible.',
  'feature.onboarding.title': 'Onboarding intelligent', 'feature.onboarding.desc': 'Sélection par pays, région, district, ville et localité. Aucune saisie libre.',
  'feature.billing.title': 'Facturation par abonnement', 'feature.billing.desc': 'Essai gratuit de 7 jours. Plans Starter, Professional, Business, Enterprise.',
  'feature.security.title': 'Sécurité de niveau santé', 'feature.security.desc': 'JWT, RLS, audit logs, isolation des données par établissement.',
  'plan.trial': "7 jours d'essai gratuit", 'plan.choose': 'Choisir ce plan', 'plan.month': 'mois', 'plan.year': 'an', 'plan.save': 'Économisez',
  'auth.email': 'Email', 'auth.password': 'Mot de passe', 'auth.fullname': 'Nom complet',
  'auth.signin.title': 'Connexion à Health Cloud', 'auth.signup.title': 'Créer votre compte',
  'auth.signin.cta': 'Se connecter', 'auth.signup.cta': 'Créer le compte',
  'auth.to.signup': "Pas encore de compte ? S'inscrire", 'auth.to.signin': 'Déjà un compte ? Se connecter',
  'onb.title': 'Configuration de votre établissement', 'onb.subtitle': 'Renseignez les informations de votre établissement de santé. Vos données sont isolées et sécurisées.',
  'onb.step.org': 'Établissement', 'onb.step.loc': 'Localisation', 'onb.step.docs': 'Documents', 'onb.step.plan': 'Abonnement', 'onb.step.review': 'Vérification',
  'onb.legal': 'Nom légal', 'onb.commercial': 'Nom commercial', 'onb.type': "Type d'établissement",
  'onb.email': 'Email de contact', 'onb.phone': 'Téléphone', 'onb.website': 'Site web',
  'onb.doctors': 'Nombre de médecins', 'onb.beds': 'Nombre de lits', 'onb.departments': 'Départements', 'onb.services': 'Services médicaux',
  'onb.country': 'Pays', 'onb.region': 'Région / Province', 'onb.district': 'Département / District',
  'onb.city': 'Ville', 'onb.locality': 'Localité / Quartier', 'onb.address': 'Adresse', 'onb.gps': 'Coordonnées GPS (lat, lng)',
  'onb.license': 'Licence médicale', 'onb.businessreg': 'Registre de commerce', 'onb.taxcert': 'Attestation fiscale',
  'onb.ownerid': "Pièce d'identité du propriétaire", 'onb.insurance': "Documents d'assurance", 'onb.payment': 'Passerelle de paiement',
  'onb.next': 'Suivant', 'onb.back': 'Retour', 'onb.submit': 'Soumettre la demande', 'onb.select': 'Sélectionner...', 'onb.loading': 'Chargement...',
  'onb.success.title': 'Demande envoyée !', 'onb.success.body': 'Votre établissement a été enregistré. Votre essai gratuit de 7 jours a commencé. Vous recevrez une notification après vérification.',
  'onb.goto.dashboard': 'Aller au tableau de bord', 'onb.err.required': 'Ce champ est obligatoire',
  'dash.welcome': 'Bienvenue', 'dash.tenant': 'Établissement',
  'dash.status.pending': 'En attente de vérification', 'dash.status.approved': 'Approuvé', 'dash.status.rejected': 'Rejeté',
  'dash.status.request_info': 'Informations complémentaires requises', 'dash.status.suspended': 'Suspendu', 'dash.trial': "Essai gratuit jusqu'au",
  'dash.no.tenant': 'Aucun établissement configuré', 'dash.no.tenant.desc': "Vous n'avez pas encore configuré votre établissement de santé.",
  'dash.start.onb': "Démarrer l'onboarding", 'dash.patients': 'Patients', 'dash.appointments': 'Rendez-vous', 'dash.doctors': 'Médecins', 'dash.revenue': 'Revenu',
  'dash.nav.overview': "Vue d'ensemble", 'dash.nav.patients': 'Patients', 'dash.nav.appointments': 'Rendez-vous',
  'dash.nav.doctors': 'Médecins', 'dash.nav.records': 'Dossiers médicaux', 'dash.nav.consultations': 'Consultations',
  'dash.nav.prescriptions': 'Prescriptions', 'dash.nav.lab': 'Laboratoire', 'dash.nav.radiology': 'Radiologie',
  'dash.nav.pharmacy': 'Pharmacie', 'dash.nav.beds': 'Hospitalisation', 'dash.nav.invoices': 'Facturation',
  'dash.nav.staff': 'Personnel', 'dash.nav.roles': 'Rôles & Permissions', 'dash.nav.settings': 'Paramètres', 'dash.nav.onboarding': 'Onboarding',
  'common.cancel': 'Annuler', 'common.save': 'Enregistrer', 'common.loading': 'Chargement...', 'common.error': 'Une erreur est survenue',
  'common.add': 'Ajouter', 'common.edit': 'Modifier', 'common.delete': 'Supprimer', 'common.search': 'Rechercher...',
  'common.actions': 'Actions', 'common.confirm.delete': 'Confirmer la suppression ?', 'common.none': 'Aucun',
  'common.name': 'Nom', 'common.status': 'Statut', 'common.date': 'Date', 'common.type': 'Type', 'common.pdf': 'PDF',
  'sa.title': 'Super Admin — LIYAH GROUP', 'sa.nav.overview': "Vue d'ensemble", 'sa.nav.tenants': 'Établissements',
  'sa.nav.plans': "Plans d'abonnement", 'sa.nav.geography': 'Géographie', 'sa.nav.audit': "Journaux d'audit",
  'sa.tenants': 'Établissements', 'sa.verify': 'Vérifier', 'sa.approve': 'Approuver', 'sa.reject': 'Rejeter',
  'sa.suspend': 'Suspendre', 'sa.request_info': 'Demander info', 'sa.mrr': 'MRR', 'sa.arr': 'ARR', 'sa.total_revenue': 'Revenu total',
  'sa.active_tenants': 'Établissements actifs', 'sa.pending': 'En attente', 'sa.suspended': 'Suspendus', 'sa.plans': 'Plans',
  'sa.add_plan': 'Ajouter un plan', 'sa.edit_plan': 'Modifier le plan', 'sa.plan_code': 'Code', 'sa.plan_name': 'Nom',
  'sa.price_monthly': 'Prix mensuel', 'sa.price_yearly': 'Prix annuel', 'sa.max_users': 'Utilisateurs max',
  'sa.max_doctors': 'Médecins max', 'sa.max_patients': 'Patients max', 'sa.features': 'Fonctionnalités',
  'sa.countries': 'Pays', 'sa.regions': 'Régions', 'sa.add_country': 'Ajouter pays', 'sa.add_region': 'Ajouter région',
  'sa.iso2': 'ISO2', 'sa.phone_code': 'Indicatif', 'sa.currency': 'Devise', 'sa.audit_logs': "Journaux d'audit",
  'sa.action': 'Action', 'sa.actor': 'Acteur', 'sa.details': 'Détails', 'sa.no_access': 'Accès refusé',
  'sa.no_access_desc': 'Cette zone est réservée à LIYAH GROUP.', 'sa.tenant_detail': "Détails de l'établissement",
  'sa.verification_note': 'Note de vérification', 'sa.save_note': 'Enregistrer la note', 'sa.set_status': 'Changer le statut',
};

const en: Dict = {
  'app.name': 'Health Cloud', 'app.tagline': 'One Platform. Every Healthcare Institution.',
  'app.developed': 'Developed by LIYAH GROUP', 'app.cameroon': '100% Cameroonian Technology',
  'nav.signin': 'Sign in', 'nav.signup': 'Sign up', 'nav.dashboard': 'Dashboard', 'nav.signout': 'Sign out',
  'hero.title': 'The cloud health platform for all of Africa',
  'hero.subtitle': 'Manage your healthcare institution with a modern, secure, multi-tenant solution. Strict data isolation per institution.',
  'hero.cta': 'Start free trial', 'hero.cta2': 'See plans',
  'feature.isolation.title': 'Strict multi-tenant isolation', 'feature.isolation.desc': 'Each institution owns an isolated workspace. No cross-tenant access possible.',
  'feature.onboarding.title': 'Intelligent onboarding', 'feature.onboarding.desc': 'Country, region, district, city and locality selection. No free-text location.',
  'feature.billing.title': 'Subscription billing', 'feature.billing.desc': '7-day free trial. Starter, Professional, Business, Enterprise plans.',
  'feature.security.title': 'Healthcare-grade security', 'feature.security.desc': 'JWT, RLS, audit logs, per-institution data isolation.',
  'plan.trial': '7-day free trial', 'plan.choose': 'Choose this plan', 'plan.month': 'month', 'plan.year': 'year', 'plan.save': 'Save',
  'auth.email': 'Email', 'auth.password': 'Password', 'auth.fullname': 'Full name',
  'auth.signin.title': 'Sign in to Health Cloud', 'auth.signup.title': 'Create your account',
  'auth.signin.cta': 'Sign in', 'auth.signup.cta': 'Create account',
  'auth.to.signup': "Don't have an account? Sign up", 'auth.to.signin': 'Already have an account? Sign in',
  'onb.title': 'Set up your institution', 'onb.subtitle': 'Enter your healthcare institution details. Your data is isolated and secure.',
  'onb.step.org': 'Institution', 'onb.step.loc': 'Location', 'onb.step.docs': 'Documents', 'onb.step.plan': 'Plan', 'onb.step.review': 'Review',
  'onb.legal': 'Legal name', 'onb.commercial': 'Commercial name', 'onb.type': 'Institution type',
  'onb.email': 'Contact email', 'onb.phone': 'Phone', 'onb.website': 'Website',
  'onb.doctors': 'Number of doctors', 'onb.beds': 'Number of beds', 'onb.departments': 'Departments', 'onb.services': 'Medical services',
  'onb.country': 'Country', 'onb.region': 'Region / Province', 'onb.district': 'District / Department',
  'onb.city': 'City', 'onb.locality': 'Locality / Quarter', 'onb.address': 'Address', 'onb.gps': 'GPS coordinates (lat, lng)',
  'onb.license': 'Medical license', 'onb.businessreg': 'Business registration', 'onb.taxcert': 'Tax certificate',
  'onb.ownerid': 'Owner ID document', 'onb.insurance': 'Insurance documents', 'onb.payment': 'Payment gateway',
  'onb.next': 'Next', 'onb.back': 'Back', 'onb.submit': 'Submit application', 'onb.select': 'Select...', 'onb.loading': 'Loading...',
  'onb.success.title': 'Application submitted!', 'onb.success.body': 'Your institution has been registered. Your 7-day free trial has started. You will receive a notification after verification.',
  'onb.goto.dashboard': 'Go to dashboard', 'onb.err.required': 'This field is required',
  'dash.welcome': 'Welcome', 'dash.tenant': 'Institution',
  'dash.status.pending': 'Pending verification', 'dash.status.approved': 'Approved', 'dash.status.rejected': 'Rejected',
  'dash.status.request_info': 'Additional information required', 'dash.status.suspended': 'Suspended', 'dash.trial': 'Free trial until',
  'dash.no.tenant': 'No institution configured', 'dash.no.tenant.desc': "You haven't set up your healthcare institution yet.",
  'dash.start.onb': 'Start onboarding', 'dash.patients': 'Patients', 'dash.appointments': 'Appointments', 'dash.doctors': 'Doctors', 'dash.revenue': 'Revenue',
  'dash.nav.overview': 'Overview', 'dash.nav.patients': 'Patients', 'dash.nav.appointments': 'Appointments',
  'dash.nav.doctors': 'Doctors', 'dash.nav.records': 'Medical Records', 'dash.nav.consultations': 'Consultations',
  'dash.nav.prescriptions': 'Prescriptions', 'dash.nav.lab': 'Laboratory', 'dash.nav.radiology': 'Radiology',
  'dash.nav.pharmacy': 'Pharmacy', 'dash.nav.beds': 'Hospitalization', 'dash.nav.invoices': 'Billing',
  'dash.nav.staff': 'Staff', 'dash.nav.roles': 'Roles & Permissions', 'dash.nav.settings': 'Settings', 'dash.nav.onboarding': 'Onboarding',
  'common.cancel': 'Cancel', 'common.save': 'Save', 'common.loading': 'Loading...', 'common.error': 'An error occurred',
  'common.add': 'Add', 'common.edit': 'Edit', 'common.delete': 'Delete', 'common.search': 'Search...',
  'common.actions': 'Actions', 'common.confirm.delete': 'Confirm delete?', 'common.none': 'None',
  'common.name': 'Name', 'common.status': 'Status', 'common.date': 'Date', 'common.type': 'Type', 'common.pdf': 'PDF',
  'sa.title': 'Super Admin — LIYAH GROUP', 'sa.nav.overview': 'Overview', 'sa.nav.tenants': 'Institutions',
  'sa.nav.plans': 'Subscription Plans', 'sa.nav.geography': 'Geography', 'sa.nav.audit': 'Audit Logs',
  'sa.tenants': 'Institutions', 'sa.verify': 'Verify', 'sa.approve': 'Approve', 'sa.reject': 'Reject',
  'sa.suspend': 'Suspend', 'sa.request_info': 'Request info', 'sa.mrr': 'MRR', 'sa.arr': 'ARR', 'sa.total_revenue': 'Total revenue',
  'sa.active_tenants': 'Active institutions', 'sa.pending': 'Pending', 'sa.suspended': 'Suspended', 'sa.plans': 'Plans',
  'sa.add_plan': 'Add plan', 'sa.edit_plan': 'Edit plan', 'sa.plan_code': 'Code', 'sa.plan_name': 'Name',
  'sa.price_monthly': 'Monthly price', 'sa.price_yearly': 'Yearly price', 'sa.max_users': 'Max users',
  'sa.max_doctors': 'Max doctors', 'sa.max_patients': 'Max patients', 'sa.features': 'Features',
  'sa.countries': 'Countries', 'sa.regions': 'Regions', 'sa.add_country': 'Add country', 'sa.add_region': 'Add region',
  'sa.iso2': 'ISO2', 'sa.phone_code': 'Phone code', 'sa.currency': 'Currency', 'sa.audit_logs': 'Audit logs',
  'sa.action': 'Action', 'sa.actor': 'Actor', 'sa.details': 'Details', 'sa.no_access': 'Access denied',
  'sa.no_access_desc': 'This area is restricted to LIYAH GROUP.', 'sa.tenant_detail': 'Institution details',
  'sa.verification_note': 'Verification note', 'sa.save_note': 'Save note', 'sa.set_status': 'Set status',
};

const dictionaries: Record<Lang, Dict> = { fr, en };
type I18nContext = { lang: Lang; setLang: (l: Lang) => void; t: (key: string) => string };
const Ctx = createContext<I18nContext | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem('hc_lang') as Lang) || 'fr');
  useEffect(() => { localStorage.setItem('hc_lang', lang); document.documentElement.lang = lang; }, [lang]);
  const value = useMemo<I18nContext>(() => ({ lang, setLang: setLangState, t: (key: string) => dictionaries[lang][key] ?? dictionaries.en[key] ?? key }), [lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
