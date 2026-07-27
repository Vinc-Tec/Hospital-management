/*
# ICD-10 reference codes + drug interaction advisory list

## Scope and honesty note
These are curated, NON-EXHAUSTIVE reference tables covering common cases,
not a licensed medical terminology database or a certified drug
interaction engine:
- `icd10_reference` holds ~80 commonly used ICD-10 codes across major
  categories. The full ICD-10-CM standard has 70,000+ codes; a complete,
  regularly-updated set is normally licensed from a terminology provider
  (WHO, CMS, or a commercial vendor) -- that is out of scope here.
- `drug_interactions` holds a small list of well-known, textbook-level
  interaction pairs, for illustrative/advisory purposes only. It is NOT a
  substitute for a licensed clinical decision support database (e.g. First
  Databank, Multum, Lexicomp) and must never be relied upon as the sole
  safety check before dispensing a medication.

Both tables are global reference data (not tenant-scoped), readable by any
authenticated user, writable only by super admins so the reference lists
stay curated centrally.
*/

CREATE TABLE IF NOT EXISTS icd10_reference (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label_en text NOT NULL,
  label_fr text NOT NULL,
  category text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE icd10_reference ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "icd10_select" ON icd10_reference;
CREATE POLICY "icd10_select" ON icd10_reference FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "icd10_write" ON icd10_reference;
CREATE POLICY "icd10_write" ON icd10_reference FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

INSERT INTO icd10_reference (code, label_en, label_fr, category) VALUES
('A09', 'Infectious gastroenteritis and colitis', 'Gastro-entérite et colite infectieuses', 'Infectious diseases'),
('B34.9', 'Viral infection, unspecified', 'Infection virale, sans précision', 'Infectious diseases'),
('J00', 'Acute nasopharyngitis (common cold)', 'Rhinopharyngite aiguë', 'Respiratory'),
('J01.9', 'Acute sinusitis, unspecified', 'Sinusite aiguë, sans précision', 'Respiratory'),
('J02.9', 'Acute pharyngitis, unspecified', 'Pharyngite aiguë, sans précision', 'Respiratory'),
('J03.9', 'Acute tonsillitis, unspecified', 'Amygdalite aiguë, sans précision', 'Respiratory'),
('J06.9', 'Acute upper respiratory infection, unspecified', 'Infection aiguë des voies respiratoires supérieures', 'Respiratory'),
('J18.9', 'Pneumonia, unspecified organism', 'Pneumonie, organisme non précisé', 'Respiratory'),
('J45.9', 'Asthma, unspecified', 'Asthme, sans précision', 'Respiratory'),
('J44.9', 'COPD, unspecified', 'BPCO, sans précision', 'Respiratory'),
('I10', 'Essential (primary) hypertension', 'Hypertension artérielle essentielle', 'Cardiovascular'),
('I25.9', 'Chronic ischemic heart disease, unspecified', 'Cardiopathie ischémique chronique', 'Cardiovascular'),
('I50.9', 'Heart failure, unspecified', 'Insuffisance cardiaque, sans précision', 'Cardiovascular'),
('I48.91', 'Atrial fibrillation, unspecified', 'Fibrillation auriculaire', 'Cardiovascular'),
('E11.9', 'Type 2 diabetes mellitus without complications', 'Diabète de type 2 sans complication', 'Endocrine'),
('E10.9', 'Type 1 diabetes mellitus without complications', 'Diabète de type 1 sans complication', 'Endocrine'),
('E03.9', 'Hypothyroidism, unspecified', 'Hypothyroïdie, sans précision', 'Endocrine'),
('E66.9', 'Obesity, unspecified', 'Obésité, sans précision', 'Endocrine'),
('E78.5', 'Hyperlipidemia, unspecified', 'Hyperlipidémie, sans précision', 'Endocrine'),
('K21.9', 'Gastro-esophageal reflux disease', 'Reflux gastro-œsophagien', 'Digestive'),
('K29.70', 'Gastritis, unspecified', 'Gastrite, sans précision', 'Digestive'),
('K35.80', 'Acute appendicitis, unspecified', 'Appendicite aiguë, sans précision', 'Digestive'),
('K59.00', 'Constipation, unspecified', 'Constipation, sans précision', 'Digestive'),
('K92.2', 'Gastrointestinal hemorrhage, unspecified', 'Hémorragie digestive, sans précision', 'Digestive'),
('N39.0', 'Urinary tract infection, site not specified', 'Infection urinaire, siège non précisé', 'Genitourinary'),
('N18.9', 'Chronic kidney disease, unspecified', 'Maladie rénale chronique, sans précision', 'Genitourinary'),
('N40.0', 'Benign prostatic hyperplasia without symptoms', 'Hyperplasie bénigne de la prostate', 'Genitourinary'),
('O80', 'Encounter for full-term uncomplicated delivery', 'Accouchement unique spontané, sans complication', 'Obstetrics'),
('Z34.90', 'Encounter for supervision of normal pregnancy', 'Surveillance de grossesse normale', 'Obstetrics'),
('M54.5', 'Low back pain', 'Lombalgie', 'Musculoskeletal'),
('M25.50', 'Pain in joint, unspecified', 'Douleur articulaire, sans précision', 'Musculoskeletal'),
('M79.1', 'Myalgia', 'Myalgie', 'Musculoskeletal'),
('M06.9', 'Rheumatoid arthritis, unspecified', 'Polyarthrite rhumatoïde, sans précision', 'Musculoskeletal'),
('S06.0', 'Concussion', 'Commotion cérébrale', 'Injury'),
('S52.5', 'Fracture of lower end of radius', 'Fracture de l''extrémité inférieure du radius', 'Injury'),
('S72.0', 'Fracture of neck of femur', 'Fracture du col du fémur', 'Injury'),
('T78.40', 'Allergy, unspecified', 'Allergie, sans précision', 'Injury'),
('R50.9', 'Fever, unspecified', 'Fièvre, sans précision', 'Symptoms'),
('R51', 'Headache', 'Céphalée', 'Symptoms'),
('R05', 'Cough', 'Toux', 'Symptoms'),
('R10.9', 'Abdominal pain, unspecified', 'Douleur abdominale, sans précision', 'Symptoms'),
('R11.0', 'Nausea', 'Nausée', 'Symptoms'),
('R42', 'Dizziness and giddiness', 'Étourdissement et vertige', 'Symptoms'),
('R53.83', 'Fatigue', 'Fatigue', 'Symptoms'),
('R55', 'Syncope and collapse', 'Syncope et collapsus', 'Symptoms'),
('F32.9', 'Major depressive disorder, unspecified', 'Trouble dépressif majeur, sans précision', 'Mental health'),
('F41.9', 'Anxiety disorder, unspecified', 'Trouble anxieux, sans précision', 'Mental health'),
('F51.01', 'Primary insomnia', 'Insomnie primaire', 'Mental health'),
('G43.9', 'Migraine, unspecified', 'Migraine, sans précision', 'Neurological'),
('G40.909', 'Epilepsy, unspecified', 'Épilepsie, sans précision', 'Neurological'),
('G47.00', 'Insomnia, unspecified', 'Insomnie, sans précision', 'Neurological'),
('L03.90', 'Cellulitis, unspecified', 'Cellulite, sans précision', 'Skin'),
('L23.9', 'Allergic contact dermatitis, unspecified', 'Dermatite allergique de contact', 'Skin'),
('L20.9', 'Atopic dermatitis, unspecified', 'Dermatite atopique, sans précision', 'Skin'),
('H10.9', 'Conjunctivitis, unspecified', 'Conjonctivite, sans précision', 'Eye/ENT'),
('H66.90', 'Otitis media, unspecified', 'Otite moyenne, sans précision', 'Eye/ENT'),
('H61.20', 'Impacted cerumen', 'Bouchon de cérumen', 'Eye/ENT'),
('B50.9', 'Plasmodium falciparum malaria, unspecified', 'Paludisme à Plasmodium falciparum, sans précision', 'Infectious diseases (regional)'),
('A00.9', 'Cholera, unspecified', 'Choléra, sans précision', 'Infectious diseases (regional)'),
('A01.0', 'Typhoid fever', 'Fièvre typhoïde', 'Infectious diseases (regional)'),
('B54', 'Malaria, unspecified', 'Paludisme, sans précision', 'Infectious diseases (regional)'),
('A15.9', 'Respiratory tuberculosis, unspecified', 'Tuberculose respiratoire, sans précision', 'Infectious diseases (regional)'),
('B20', 'HIV disease', 'Maladie à VIH', 'Infectious diseases (regional)'),
('Z00.00', 'Encounter for general adult medical examination', 'Examen médical général adulte', 'Wellness/Preventive'),
('Z23', 'Encounter for immunization', 'Consultation pour vaccination', 'Wellness/Preventive')
ON CONFLICT (code) DO NOTHING;

-- NOTE: medical_records.icd10_code already exists as a free-text column in
-- the original schema. We deliberately do NOT add a foreign key constraint
-- to icd10_reference here: any tenant that already entered a code outside
-- this curated ~80-code list would break the migration, and clinicians
-- must remain able to enter a code not yet in our reference list. This
-- table is offered as a lookup/autocomplete helper in the UI, not a rigid
-- constraint.

CREATE TABLE IF NOT EXISTS drug_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_a text NOT NULL,
  drug_b text NOT NULL,
  severity text NOT NULL DEFAULT 'moderate' CHECK (severity IN ('minor', 'moderate', 'major')),
  description_en text NOT NULL,
  description_fr text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE drug_interactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "drug_interactions_select" ON drug_interactions;
CREATE POLICY "drug_interactions_select" ON drug_interactions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "drug_interactions_write" ON drug_interactions;
CREATE POLICY "drug_interactions_write" ON drug_interactions FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

INSERT INTO drug_interactions (drug_a, drug_b, severity, description_en, description_fr) VALUES
('warfarin', 'aspirin', 'major', 'Increased bleeding risk when combined.', 'Risque hémorragique accru en association.'),
('warfarin', 'ibuprofen', 'major', 'NSAIDs increase bleeding risk with anticoagulants.', 'Les AINS augmentent le risque hémorragique avec les anticoagulants.'),
('warfarin', 'amiodarone', 'major', 'Amiodarone potentiates warfarin, increasing bleeding risk.', 'L''amiodarone potentialise la warfarine, augmentant le risque hémorragique.'),
('aspirin', 'ibuprofen', 'moderate', 'Combined use may reduce cardioprotective effect of aspirin and increase GI risk.', 'L''association peut réduire l''effet cardioprotecteur de l''aspirine et augmenter le risque digestif.'),
('methotrexate', 'ibuprofen', 'major', 'NSAIDs can increase methotrexate toxicity.', 'Les AINS peuvent augmenter la toxicité du méthotrexate.'),
('sildenafil', 'nitroglycerin', 'major', 'Combination can cause severe, life-threatening hypotension.', 'L''association peut provoquer une hypotension sévère mettant en jeu le pronostic vital.'),
('lisinopril', 'spironolactone', 'moderate', 'Combined use increases risk of hyperkalemia.', 'L''association augmente le risque d''hyperkaliémie.'),
('lisinopril', 'potassium', 'moderate', 'ACE inhibitors combined with potassium supplements increase hyperkalemia risk.', 'Les IEC associés à des suppléments de potassium augmentent le risque d''hyperkaliémie.'),
('simvastatin', 'clarithromycin', 'major', 'Macrolides can raise statin levels, increasing risk of myopathy/rhabdomyolysis.', 'Les macrolides peuvent augmenter le taux de statine, majorant le risque de myopathie/rhabdomyolyse.'),
('simvastatin', 'erythromycin', 'major', 'Same mechanism as with clarithromycin: increased myopathy risk.', 'Même mécanisme qu''avec la clarithromycine : risque accru de myopathie.'),
('metformin', 'contrast media', 'moderate', 'Risk of lactic acidosis in patients with reduced renal function after iodinated contrast.', 'Risque d''acidose lactique chez les patients à fonction rénale réduite après un produit de contraste iodé.'),
('fluoxetine', 'tramadol', 'major', 'Combined serotonergic effect increases risk of serotonin syndrome.', 'L''effet sérotoninergique combiné augmente le risque de syndrome sérotoninergique.'),
('sertraline', 'tramadol', 'major', 'Combined serotonergic effect increases risk of serotonin syndrome.', 'L''effet sérotoninergique combiné augmente le risque de syndrome sérotoninergique.'),
('fluoxetine', 'phenelzine', 'major', 'SSRI + MAOI combination can cause life-threatening serotonin syndrome.', 'L''association ISRS + IMAO peut provoquer un syndrome sérotoninergique mettant en jeu le pronostic vital.'),
('digoxin', 'furosemide', 'moderate', 'Furosemide-induced hypokalemia increases digoxin toxicity risk.', 'L''hypokaliémie induite par le furosémide augmente le risque de toxicité digitalique.'),
('ciprofloxacin', 'theophylline', 'moderate', 'Ciprofloxacin can raise theophylline levels, increasing toxicity risk.', 'La ciprofloxacine peut augmenter le taux de théophylline, majorant le risque de toxicité.'),
('clopidogrel', 'omeprazole', 'moderate', 'Omeprazole may reduce clopidogrel effectiveness via CYP2C19 inhibition.', 'L''oméprazole peut réduire l''efficacité du clopidogrel par inhibition du CYP2C19.'),
('insulin', 'prednisone', 'moderate', 'Corticosteroids raise blood glucose, may require insulin dose adjustment.', 'Les corticoïdes augmentent la glycémie, un ajustement de la dose d''insuline peut être nécessaire.')
ON CONFLICT DO NOTHING;
