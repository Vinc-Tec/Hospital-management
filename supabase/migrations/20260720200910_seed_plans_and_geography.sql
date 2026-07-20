/*
# Seed: Subscription Plans + African Countries (Cameroon geography)

## Changes
1. Insert the 4 subscription plans (Starter/Professional/Business/Enterprise)
   with monthly + yearly pricing and feature lists.
2. Insert all African countries (54) with ISO2 + dial codes.
3. Seed Cameroon's 10 regions, their districts, and a few cities/localities
   so the onboarding dropdown cascade works end-to-end out of the box.

## Security
No policy changes — only data inserts into already-RLS-protected tables.
*/

-- ---------- plans ----------
INSERT INTO subscription_plans (code, name, price_monthly, price_yearly, max_users, max_doctors, max_patients, features, sort_order)
VALUES
  ('starter', 'Starter', 49, 470, 10, 5, 1000,
    '["Core dashboard","Patients","Appointments","Basic reports","Email support"]', 1),
  ('professional', 'Professional', 99, 950, 50, 20, 10000,
    '["Everything in Starter","Medical records","Laboratory","Pharmacy","Advanced reports","Priority support"]', 2),
  ('business', 'Business', 189, 1810, 200, 100, 100000,
    '["Everything in Professional","Radiology","Hospitalization","Operating room","Inventory","HR","Payroll"]', 3),
  ('enterprise', 'Enterprise', 469, 4500, 0, 0, 0,
    '["Unlimited users","Unlimited doctors","Unlimited patients","All modules","Marketplace","API access","Premium support","Advanced analytics"]', 4)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_users = EXCLUDED.max_users,
  max_doctors = EXCLUDED.max_doctors,
  max_patients = EXCLUDED.max_patients,
  features = EXCLUDED.features,
  sort_order = EXCLUDED.sort_order;

-- ---------- countries (all 54 African states) ----------
INSERT INTO countries (name, iso2, phone_code, currency_code) VALUES
('Algeria','DZ','+213','DZD'),
('Angola','AO','+244','AOA'),
('Benin','BJ','+229','XOF'),
('Botswana','BW','+267','BWP'),
('Burkina Faso','BF','+226','XOF'),
('Burundi','BI','+257','BIF'),
('Cabo Verde','CV','+238','CVE'),
('Cameroon','CM','+237','XAF'),
('Central African Republic','CF','+236','XAF'),
('Chad','TD','+235','XAF'),
('Comoros','KM','+269','KMF'),
('Congo (Brazzaville)','CG','+242','XAF'),
('Congo (Kinshasa)','CD','+243','CDF'),
('Cote d''Ivoire','CI','+225','XOF'),
('Djibouti','DJ','+253','DJF'),
('Egypt','EG','+20','EGP'),
('Equatorial Guinea','GQ','+240','XAF'),
('Eritrea','ER','+291','ERN'),
('Eswatini','SZ','+268','SZL'),
('Ethiopia','ET','+251','ETB'),
('Gabon','GA','+241','XAF'),
('Gambia','GM','+220','GMD'),
('Ghana','GH','+233','GHS'),
('Guinea','GN','+224','GNF'),
('Guinea-Bissau','GW','+245','XOF'),
('Kenya','KE','+254','KES'),
('Lesotho','LS','+266','LSL'),
('Liberia','LR','+231','LRD'),
('Libya','LY','+218','LYD'),
('Madagascar','MG','+261','MGA'),
('Malawi','MW','+265','MWK'),
('Mali','ML','+223','XOF'),
('Mauritania','MR','+222','MRU'),
('Mauritius','MU','+230','MUR'),
('Morocco','MA','+212','MAD'),
('Mozambique','MZ','+258','MZN'),
('Namibia','NA','+264','NAD'),
('Niger','NE','+227','XOF'),
('Nigeria','NG','+234','NGN'),
('Rwanda','RW','+250','RWF'),
('Sao Tome and Principe','ST','+239','STN'),
('Senegal','SN','+221','XOF'),
('Seychelles','SC','+248','SCR'),
('Sierra Leone','SL','+232','SLL'),
('Somalia','SO','+252','SOS'),
('South Africa','ZA','+27','ZAR'),
('South Sudan','SS','+211','SSP'),
('Sudan','SD','+249','SDG'),
('Tanzania','TZ','+255','TZS'),
('Togo','TG','+228','XOF'),
('Tunisia','TN','+216','TND'),
('Uganda','UG','+256','UGX'),
('Zambia','ZM','+260','ZMW'),
('Zimbabwe','ZW','+263','ZWL')
ON CONFLICT (iso2) DO NOTHING;

-- ---------- Cameroon regions ----------
INSERT INTO regions (country_id, name)
SELECT c.id, v.name FROM countries c, (VALUES
  ('Adamaoua'),('Centre'),('East'),('Far North'),('Littoral'),
  ('North'),('North-West'),('South'),('South-West'),('West')
) AS v(name)
WHERE c.iso2 = 'CM'
ON CONFLICT DO NOTHING;

-- ---------- Districts for Centre region ----------
INSERT INTO districts (region_id, name)
SELECT r.id, v.name FROM regions r, (VALUES
  ('Mfoundi'),('Mbam-et-Inoubou'),('Mbam-et-Kim'),('Nyong-et-Kelle'),
  ('Nyong-et-Mfoumou'),('Nyong-et-Soo'),('Haute-Sanaga')
) AS v(name)
WHERE r.name = 'Centre' AND r.country_id = (SELECT id FROM countries WHERE iso2='CM')
ON CONFLICT DO NOTHING;

-- ---------- Cities for Mfoundi ----------
INSERT INTO cities (district_id, name)
SELECT d.id, v.name FROM districts d, (VALUES
  ('Yaounde I'),('Yaounde II'),('Yaounde III'),('Yaounde IV'),('Yaounde V'),('Yaounde VI'),('Yaounde VII')
) AS v(name)
WHERE d.name = 'Mfoundi'
ON CONFLICT DO NOTHING;

-- ---------- Localities for Yaounde I ----------
INSERT INTO localities (city_id, name)
SELECT c.id, v.name FROM cities c, (VALUES
  ('Bastos'),('Bonanjo'),('Centre Ville'),('Mvan'),('Mokolo'),('Etoudi')
) AS v(name)
WHERE c.name = 'Yaounde I'
ON CONFLICT DO NOTHING;
