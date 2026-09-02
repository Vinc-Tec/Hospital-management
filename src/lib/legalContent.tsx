// Structured legal content for the Privacy Policy and Terms of Service pages.
//
// IMPORTANT: this is a comprehensive DRAFT written to replace the previous
// one-paragraph placeholder. It is NOT a substitute for review by a lawyer
// familiar with health-data regulation in the jurisdictions Health Cloud
// operates in (GDPR if serving EU residents, other local data-protection
// laws depending on the client institution's country, etc.). Support email, address, and governing law are filled in
// (Cameroon for governing law -- a starting choice given the operational
// base, expected to be revisited once confirmed with counsel). The whole
// document should still be validated by counsel before being relied on
// as an actual legal commitment to customers.

export type LegalSection = { heading: string; body: string[] };

type LegalDoc = { intro: string; sections: LegalSection[]; lastUpdated: string };

export const privacyPolicy: Record<'fr' | 'en', LegalDoc> = {
  fr: {
    lastUpdated: 'Dernière mise à jour : à compléter avant publication',
    intro:
      "Cette politique explique quelles données Health Cloud (édité par LiAfrik) collecte, pourquoi, et quels droits vous avez. Health Cloud héberge des données de santé pour le compte d'établissements clients (hôpitaux, cliniques) : dans ce cadre, l'établissement client est responsable du traitement des données de ses patients, et LiAfrik agit comme sous-traitant technique.",
    sections: [
      {
        heading: '1. Qui sommes-nous',
        body: [
          "Health Cloud est édité par LiAfrik. Pour toute question relative à cette politique ou à vos données, contactez support@liafrik.com.",
        ],
      },
      {
        heading: '2. Données collectées',
        body: [
          "Données de compte : nom, adresse email, mot de passe (chiffré), rôle au sein de l'établissement.",
          "Données de l'établissement client : nom légal et commercial, adresse, documents de vérification (licence médicale, immatriculation), informations de facturation.",
          "Données cliniques saisies par l'établissement client : dossiers patients, rendez-vous, prescriptions, résultats d'examens, factures. Ces données appartiennent à l'établissement client et à ses patients, pas à LiAfrik.",
          "Données techniques : adresse IP, type de navigateur, journaux de connexion, à des fins de sécurité et de lutte contre la fraude.",
        ],
      },
      {
        heading: '3. Finalités du traitement',
        body: [
          "Fournir et maintenir le service Health Cloud pour le compte des établissements clients.",
          "Sécuriser les comptes et détecter les activités suspectes ou frauduleuses.",
          "Facturer les abonnements et gérer la relation commerciale avec l'établissement client.",
          "Assurer le support technique et répondre aux demandes des utilisateurs.",
          "Respecter nos obligations légales et réglementaires.",
        ],
      },
      {
        heading: '4. Base légale du traitement',
        body: [
          "L'exécution du contrat d'abonnement conclu avec l'établissement client.",
          "L'intérêt légitime de LiAfrik à sécuriser et améliorer le service.",
          "Le respect d'obligations légales applicables (comptabilité, lutte contre la fraude).",
          "Pour les données cliniques des patients, la base légale relève de la relation entre l'établissement client et son patient ; LiAfrik n'intervient qu'en qualité de sous-traitant technique.",
        ],
      },
      {
        heading: '5. Hébergement et sous-traitants',
        body: [
          "Les données sont hébergées via Supabase (infrastructure Postgres). La ou les régions d'hébergement précises et la liste complète des sous-traitants techniques (hébergement, envoi d'emails, etc.) seront documentées ici avant mise en production.",
          "Nous nous engageons à ne partager les données avec un sous-traitant que dans le cadre strictement nécessaire à la fourniture du service, sous contrat encadrant leurs obligations de confidentialité et de sécurité.",
        ],
      },
      {
        heading: '6. Durée de conservation',
        body: [
          "Les données de compte et de facturation sont conservées pendant la durée de la relation contractuelle, puis archivées pendant la durée requise par les obligations légales applicables (comptables, fiscales).",
          "Les données cliniques des patients sont conservées selon les obligations propres au secteur de la santé applicables dans la juridiction de l'établissement client ; ce dernier reste responsable de la durée de conservation appropriée à son activité.",
        ],
      },
      {
        heading: '7. Sécurité',
        body: [
          "Chaque établissement client évolue dans un espace de données isolé au niveau de la base de données (Row Level Security PostgreSQL) : un établissement ne peut techniquement pas accéder aux données d'un autre établissement.",
          "Les échanges entre votre navigateur et nos serveurs sont chiffrés (TLS/HTTPS).",
          "Les données sont chiffrées au repos au niveau de l'infrastructure d'hébergement (chiffrement disque standard du fournisseur cloud).",
          "L'accès administrateur à la plateforme est restreint, journalisé, et soumis à des contrôles internes.",
          "Aucun système n'est invulnérable : en cas d'incident de sécurité affectant des données personnelles, nous nous engageons à informer les établissements clients concernés dans les meilleurs délais et conformément à nos obligations légales.",
        ],
      },
      {
        heading: '8. Vos droits',
        body: [
          "Selon votre juridiction, vous pouvez disposer d'un droit d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité de vos données personnelles.",
          "Pour les données cliniques d'un patient, ces demandes doivent en priorité être adressées à l'établissement de santé concerné, qui reste responsable du traitement de ces données.",
          "Pour les données de compte utilisateur ou d'établissement client gérées directement par LiAfrik, contactez support@liafrik.com.",
        ],
      },
      {
        heading: '9. Transferts internationaux',
        body: [
          "Si des données sont transférées vers un pays situé en dehors de votre juridiction, nous veillons à ce que ce transfert bénéficie de garanties appropriées conformément à la réglementation applicable.",
        ],
      },
      {
        heading: '10. Cookies',
        body: [
          "Nous utilisons des cookies strictement nécessaires au fonctionnement du service (authentification, préférence de langue). Nous n'utilisons pas de cookies publicitaires tiers.",
        ],
      },
      {
        heading: '11. Modifications de cette politique',
        body: [
          "Cette politique peut être mise à jour. Les modifications substantielles seront notifiées aux établissements clients par email ou via la plateforme.",
        ],
      },
      {
        heading: '12. Réclamation',
        body: [
          "Vous disposez du droit d'introduire une réclamation auprès de l'autorité de protection des données compétente si vous estimez que le traitement de vos données n'est pas conforme à la réglementation applicable.",
        ],
      },
      {
        heading: '13. Contact',
        body: ["Pour toute question : support@liafrik.com — Dubaï, EAU & Yaoundé, Cameroun."],
      },
    ],
  },
  en: {
    lastUpdated: 'Last updated: to be completed before publication',
    intro:
      "This policy explains what data Health Cloud (published by LiAfrik) collects, why, and what rights you have. Health Cloud hosts health data on behalf of client institutions (hospitals, clinics): in that context, the client institution is the data controller for its patients' data, and LiAfrik acts as a technical data processor.",
    sections: [
      { heading: '1. Who we are', body: ["Health Cloud is published by LiAfrik. For any question about this policy or your data, contact support@liafrik.com."] },
      {
        heading: '2. Data we collect',
        body: [
          "Account data: name, email address, password (hashed), role within the institution.",
          "Client institution data: legal and commercial name, address, verification documents (medical license, business registration), billing information.",
          "Clinical data entered by the client institution: patient records, appointments, prescriptions, test results, invoices. This data belongs to the client institution and its patients, not to LiAfrik.",
          "Technical data: IP address, browser type, login logs, for security and fraud-prevention purposes.",
        ],
      },
      {
        heading: '3. Purposes of processing',
        body: [
          "Providing and maintaining the Health Cloud service on behalf of client institutions.",
          "Securing accounts and detecting suspicious or fraudulent activity.",
          "Billing subscriptions and managing the commercial relationship with the client institution.",
          "Providing technical support and responding to user requests.",
          "Complying with applicable legal and regulatory obligations.",
        ],
      },
      {
        heading: '4. Legal basis',
        body: [
          "Performance of the subscription contract with the client institution.",
          "LiAfrik's legitimate interest in securing and improving the service.",
          "Compliance with applicable legal obligations (accounting, fraud prevention).",
          "For patients' clinical data, the legal basis arises from the relationship between the client institution and its patient; LiAfrik only acts as a technical processor.",
        ],
      },
      {
        heading: '5. Hosting and subprocessors',
        body: [
          "Data is hosted via Supabase (Postgres infrastructure). The precise hosting region(s) and the full list of technical subprocessors (hosting, email delivery, etc.) will be documented here before going live.",
          "We only share data with a subprocessor to the extent strictly necessary to provide the service, under contracts governing their confidentiality and security obligations.",
        ],
      },
      {
        heading: '6. Data retention',
        body: [
          "Account and billing data is kept for the duration of the contractual relationship, then archived for as long as required by applicable legal obligations (accounting, tax).",
          "Patients' clinical data is retained according to the healthcare-specific obligations applicable in the client institution's jurisdiction; the institution remains responsible for the retention period appropriate to its activity.",
        ],
      },
      {
        heading: '7. Security',
        body: [
          "Each client institution operates in a database-level isolated data space (PostgreSQL Row Level Security): one institution cannot technically access another institution's data.",
          "Traffic between your browser and our servers is encrypted (TLS/HTTPS).",
          "Data is encrypted at rest at the hosting infrastructure level (standard disk-level encryption provided by the cloud host).",
          "Administrative access to the platform is restricted, logged, and subject to internal controls.",
          "No system is invulnerable: in the event of a security incident affecting personal data, we commit to informing affected client institutions promptly and in accordance with our legal obligations.",
        ],
      },
      {
        heading: '8. Your rights',
        body: [
          "Depending on your jurisdiction, you may have a right of access, rectification, erasure, restriction, objection, and portability regarding your personal data.",
          "For a patient's clinical data, such requests should primarily be directed to the healthcare institution concerned, which remains the data controller for that data.",
          "For user account or client institution data managed directly by LiAfrik, contact support@liafrik.com.",
        ],
      },
      { heading: '9. International transfers', body: ["Where data is transferred outside your jurisdiction, we ensure that transfer benefits from appropriate safeguards under applicable regulation."] },
      { heading: '10. Cookies', body: ["We use cookies strictly necessary for the service to function (authentication, language preference). We do not use third-party advertising cookies."] },
      { heading: '11. Changes to this policy', body: ["This policy may be updated. Material changes will be notified to client institutions by email or via the platform."] },
      { heading: '12. Complaints', body: ["You have the right to lodge a complaint with the competent data protection authority if you believe processing of your data does not comply with applicable regulation."] },
      { heading: '13. Contact', body: ["For any question: support@liafrik.com — Dubai, UAE & Yaoundé, Cameroon."] },
    ],
  },
};

export const termsOfService: Record<'fr' | 'en', LegalDoc> = {
  fr: {
    lastUpdated: 'Dernière mise à jour : à compléter avant publication',
    intro:
      "Les présentes conditions générales d'utilisation (CGU) régissent l'accès et l'utilisation de la plateforme Health Cloud, éditée par LiAfrik, par tout établissement client et ses utilisateurs.",
    sections: [
      {
        heading: '1. Objet',
        body: [
          "Health Cloud est une plateforme logicielle en mode SaaS destinée à la gestion des établissements de santé (patients, rendez-vous, dossiers médicaux, facturation, et modules complémentaires selon le plan souscrit).",
        ],
      },
      {
        heading: '2. Acceptation des conditions',
        body: [
          "La création d'un compte et l'utilisation de la plateforme valent acceptation pleine et entière des présentes CGU par l'établissement client et la personne qui s'inscrit en son nom.",
        ],
      },
      {
        heading: '3. Compte et inscription',
        body: [
          "L'établissement client garantit l'exactitude des informations fournies lors de l'inscription (dénomination, adresse, documents de vérification).",
          "L'établissement client est responsable de la confidentialité des identifiants de ses utilisateurs et de toute activité réalisée sous leurs comptes.",
        ],
      },
      {
        heading: '4. Abonnement et facturation',
        body: [
          "L'accès à la plateforme est proposé selon différents plans tarifaires (Starter, Professional, Business, Enterprise), chacun donnant accès à un périmètre de modules et à des limites d'utilisation propres, précisés sur la page tarifs.",
          "Une période d'essai gratuite peut être proposée ; à l'issue de celle-ci, la poursuite de l'accès est conditionnée à la souscription d'un plan payant.",
          "Les modalités de paiement (moyens acceptés, périodicité, conditions de résiliation et de remboursement) seront précisées lors de la mise en place effective de la facturation.",
        ],
      },
      {
        heading: "5. Responsabilité de l'établissement client sur les données patients",
        body: [
          "L'établissement client demeure seul responsable du traitement des données de ses patients (exactitude, base légale, durée de conservation, information des patients) et du respect des obligations réglementaires propres à son secteur d'activité dans sa juridiction.",
          "LiAfrik agit en qualité de sous-traitant technique et met en œuvre les mesures de sécurité décrites dans la politique de confidentialité.",
        ],
      },
      {
        heading: '6. Propriété intellectuelle',
        body: [
          "La plateforme Health Cloud, son code, son design et sa marque demeurent la propriété exclusive de LiAfrik. Aucune licence autre que le droit d'usage prévu par les présentes CGU n'est concédée à l'établissement client.",
          "Les données saisies par l'établissement client (dossiers patients, contenus propres) restent sa propriété.",
        ],
      },
      {
        heading: '7. Disponibilité du service',
        body: [
          "LiAfrik met en œuvre ses meilleurs efforts pour assurer la disponibilité continue de la plateforme, sans garantie de disponibilité contractuelle formelle (SLA) à ce stade. Des interruptions ponctuelles pour maintenance peuvent survenir, avec notification préalable dans la mesure du possible.",
        ],
      },
      {
        heading: '8. Limitation de responsabilité',
        body: [
          "Dans la limite permise par la loi applicable, la responsabilité de LiAfrik ne saurait être engagée pour les dommages indirects résultant de l'utilisation ou de l'impossibilité d'utiliser la plateforme.",
          "LiAfrik ne saurait être tenu responsable des décisions cliniques prises par l'établissement client ou son personnel sur la base des informations saisies dans la plateforme.",
        ],
      },
      {
        heading: '9. Résiliation',
        body: [
          "L'établissement client peut résilier son abonnement selon les modalités précisées lors de la souscription.",
          "LiAfrik peut suspendre ou résilier l'accès en cas de manquement grave aux présentes CGU, avec notification préalable sauf urgence justifiée (par exemple en cas de risque pour la sécurité de la plateforme ou d'autres établissements clients).",
        ],
      },
      {
        heading: '10. Droit applicable',
        body: ["Les présentes CGU sont soumises au droit du Cameroun, sans préjudice des dispositions impératives éventuellement applicables au lieu d'établissement du client."],
      },
      {
        heading: '11. Modification des CGU',
        body: ["LiAfrik peut modifier les présentes CGU ; les établissements clients seront informés de toute modification substantielle."],
      },
      { heading: '12. Contact', body: ["Pour toute question relative aux présentes CGU : support@liafrik.com — Dubaï, EAU & Yaoundé, Cameroun."] },
    ],
  },
  en: {
    lastUpdated: 'Last updated: to be completed before publication',
    intro:
      "These Terms of Service govern access to and use of the Health Cloud platform, published by LiAfrik, by any client institution and its users.",
    sections: [
      { heading: '1. Purpose', body: ["Health Cloud is a SaaS platform for managing healthcare institutions (patients, appointments, medical records, billing, and additional modules depending on the subscribed plan)."] },
      { heading: '2. Acceptance of terms', body: ["Creating an account and using the platform constitutes full acceptance of these Terms by the client institution and the person registering on its behalf."] },
      {
        heading: '3. Account and registration',
        body: [
          "The client institution warrants the accuracy of the information provided during registration (name, address, verification documents).",
          "The client institution is responsible for the confidentiality of its users' credentials and for any activity carried out under their accounts.",
        ],
      },
      {
        heading: '4. Subscription and billing',
        body: [
          "Access to the platform is offered under different pricing plans (Starter, Professional, Business, Enterprise), each granting access to a specific set of modules and usage limits, as detailed on the pricing page.",
          "A free trial period may be offered; continued access after the trial requires subscribing to a paid plan.",
          "Payment terms (accepted methods, billing frequency, cancellation and refund conditions) will be detailed once billing is actually put in place.",
        ],
      },
      {
        heading: "5. Client institution's responsibility for patient data",
        body: [
          "The client institution remains solely responsible for processing its patients' data (accuracy, legal basis, retention period, patient information) and for complying with the regulatory obligations specific to its sector of activity in its jurisdiction.",
          "LiAfrik acts as a technical processor and implements the security measures described in the Privacy Policy.",
        ],
      },
      {
        heading: '6. Intellectual property',
        body: [
          "The Health Cloud platform, its code, design, and brand remain the exclusive property of LiAfrik. No license other than the right of use granted under these Terms is given to the client institution.",
          "Data entered by the client institution (patient records, own content) remains its property.",
        ],
      },
      { heading: '7. Service availability', body: ["LiAfrik uses reasonable efforts to ensure continuous availability of the platform, without a formal contractual service-level guarantee (SLA) at this stage. Occasional maintenance downtime may occur, with prior notice where possible."] },
      {
        heading: '8. Limitation of liability',
        body: [
          "To the extent permitted by applicable law, LiAfrik shall not be liable for indirect damages resulting from the use or inability to use the platform.",
          "LiAfrik shall not be liable for clinical decisions made by the client institution or its staff based on information entered into the platform.",
        ],
      },
      {
        heading: '9. Termination',
        body: [
          "The client institution may terminate its subscription under the terms specified at the time of subscription.",
          "LiAfrik may suspend or terminate access in the event of a serious breach of these Terms, with prior notice except in justified emergencies (e.g. a risk to the security of the platform or other client institutions).",
        ],
      },
      { heading: '10. Governing law', body: ["These Terms are governed by the law of Cameroon, without prejudice to any mandatory provisions applicable at the client's place of establishment."] },
      { heading: '11. Changes to these terms', body: ["LiAfrik may modify these Terms; client institutions will be informed of any material change."] },
      { heading: '12. Contact', body: ["For any question about these Terms: support@liafrik.com — Dubai, UAE & Yaoundé, Cameroon."] },
    ],
  },
};

// Mentions légales / Legal Notice — publisher identification, hosting,
// and IP ownership. Distinct from the Privacy Policy (data protection)
// and Terms of Service (contractual terms): this is the statutory
// "who runs this site" notice.
export const legalNotice: Record<'fr' | 'en', LegalDoc> = {
  fr: {
    lastUpdated: 'Dernière mise à jour : à compléter avant publication',
    intro: "Conformément aux usages en matière de transparence en ligne, cette page identifie l'éditeur, l'hébergeur et les conditions de propriété intellectuelle du site et de la plateforme Health Cloud.",
    sections: [
      { heading: 'Éditeur', body: ["Health Cloud est édité par LiAfrik, société opérant depuis Dubaï (Émirats Arabes Unis) et Yaoundé (Cameroun).", "Contact : cs@liafrik.com"] },
      { heading: 'Directeur de publication', body: ["La direction de la publication est assurée par l'équipe dirigeante de LiAfrik. Coordonnées disponibles sur demande via cs@liafrik.com."] },
      { heading: 'Hébergement', body: ["L'application et les données sont hébergées via Supabase (infrastructure Postgres) et déployées sur une infrastructure cloud tierce. La liste précise des sous-traitants d'hébergement est détaillée dans la Politique de confidentialité."] },
      { heading: 'Propriété intellectuelle', body: ["L'ensemble des éléments du site et de la plateforme Health Cloud (code, design, marque, logo, contenus) sont la propriété exclusive de LiAfrik, sauf mention contraire. Toute reproduction non autorisée est interdite.", "Les logos des services tiers (intégrations) affichés sur ce site restent la propriété de leurs détenteurs respectifs et sont utilisés à titre d'identification des connecteurs disponibles, sans affiliation ni approbation implicite de leur part."] },
      { heading: 'Signalement', body: ["Pour signaler un contenu ou un problème sur le site, contactez cs@liafrik.com."] },
    ],
  },
  en: {
    lastUpdated: 'Last updated: to be completed before publication',
    intro: 'In line with standard online-transparency practice, this page identifies the publisher, host, and intellectual-property terms for the Health Cloud website and platform.',
    sections: [
      { heading: 'Publisher', body: ['Health Cloud is published by LiAfrik, operating from Dubai (United Arab Emirates) and Yaoundé (Cameroon).', 'Contact: cs@liafrik.com'] },
      { heading: 'Publication director', body: ['Publication is overseen by the LiAfrik leadership team. Details available on request via cs@liafrik.com.'] },
      { heading: 'Hosting', body: ['The application and its data are hosted via Supabase (Postgres infrastructure) and deployed on third-party cloud infrastructure. The precise list of hosting sub-processors is detailed in the Privacy Policy.'] },
      { heading: 'Intellectual property', body: ['All elements of the Health Cloud website and platform (code, design, brand, logo, content) are the exclusive property of LiAfrik unless stated otherwise. Unauthorized reproduction is prohibited.', 'Third-party service logos (integrations) shown on this site remain the property of their respective owners and are used solely to identify available connectors, without implying affiliation or endorsement.'] },
      { heading: 'Reporting', body: ['To report content or an issue on this site, contact cs@liafrik.com.'] },
    ],
  },
};

export const cookiePolicy: Record<'fr' | 'en', LegalDoc> = {
  fr: {
    lastUpdated: 'Dernière mise à jour : à compléter avant publication',
    intro: "Cette page explique quels cookies et technologies similaires Health Cloud utilise, et comment les gérer. Health Cloud utilise volontairement un nombre restreint de cookies : aucun cookie publicitaire ni de traçage cross-site tiers.",
    sections: [
      { heading: '1. Cookies strictement nécessaires', body: ["Session d'authentification (Supabase Auth) : maintient votre connexion active. Sans lui, vous seriez déconnecté à chaque navigation.", "Préférence de langue (fr/en) et préférence de fermeture des bannières promotionnelles : stockées en local storage, pas de cookie tiers."] },
      { heading: '2. Cookies de mesure d\'audience', body: ["Aucun outil d'analytics tiers (Google Analytics ou équivalent) n'est activé par défaut sur ce site à la date de rédaction. Si un tel outil venait à être ajouté, cette page serait mise à jour au préalable."] },
      { heading: '3. Cookies tiers liés aux intégrations', body: ["Si votre établissement active une intégration (WhatsApp, paiement, calendrier), le fournisseur tiers concerné peut déposer ses propres cookies lors de l'utilisation de son service depuis votre tableau de bord. Reportez-vous à la politique de confidentialité de ce fournisseur."] },
      { heading: '4. Gérer vos préférences', body: ["Vous pouvez supprimer ou bloquer les cookies via les réglages de votre navigateur. Le blocage du cookie de session empêchera la connexion à votre espace Health Cloud."] },
      { heading: '5. Contact', body: ["Pour toute question sur cette politique : cs@liafrik.com."] },
    ],
  },
  en: {
    lastUpdated: 'Last updated: to be completed before publication',
    intro: 'This page explains which cookies and similar technologies Health Cloud uses, and how to manage them. Health Cloud deliberately keeps this list short: no advertising cookies and no third-party cross-site tracking.',
    sections: [
      { heading: '1. Strictly necessary cookies', body: ['Authentication session (Supabase Auth): keeps you signed in. Without it you would be logged out on every navigation.', 'Language preference (fr/en) and promotional-banner dismissal: stored in local storage, no third-party cookie involved.'] },
      { heading: '2. Analytics cookies', body: ['No third-party analytics tool (Google Analytics or equivalent) is enabled by default on this site as of this writing. Should one be added later, this page will be updated beforehand.'] },
      { heading: '3. Third-party cookies from integrations', body: ["If your institution enables an integration (WhatsApp, payment, calendar), that third-party provider may set its own cookies when its service is used from your dashboard. Refer to that provider's own privacy policy."] },
      { heading: '4. Managing your preferences', body: ['You can delete or block cookies via your browser settings. Blocking the session cookie will prevent signing in to your Health Cloud workspace.'] },
      { heading: '5. Contact', body: ['For any question about this policy: cs@liafrik.com.'] },
    ],
  },
};
