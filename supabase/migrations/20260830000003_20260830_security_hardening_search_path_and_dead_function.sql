/*
# Security hardening: fix search_path on 8 functions, revoke a dead admin-email-probe function

1. function_search_path_mutable (8 functions): touch_updated_at,
   fn_set_updated_at, enforce_max_users, enforce_max_doctors,
   enforce_max_patients, fn_generate_invoice_number, is_super_admin_email,
   get_staff_performance. None had a fixed search_path, making them
   theoretically vulnerable to search_path-shadowing attacks. Added
   `SET search_path = public` to each -- bodies are byte-for-byte
   identical to their prior definitions, only the SET clause is new.

2. is_super_admin_email(email text): confirmed dead code -- no policy,
   trigger, function, or frontend code references it anywhere in this
   repo (superseded by the protected_admin_emails table +
   is_super_admin()). It carried a hardcoded, STALE admin email
   whitelist (missing liyahjoha@gmail.com, present in the real
   protected_admin_emails table) and was callable by the `anon` role --
   anyone on the internet could probe
   /rest/v1/rpc/is_super_admin_email?email_to_check=X to test whether a
   given address is a platform admin. Revoked EXECUTE from anon and
   authenticated; zero functional impact since nothing calls it.

Applied directly to the live database via the Supabase connector; this
file brings the repo's migration history in sync with that.
*/

REVOKE EXECUTE ON FUNCTION public.is_super_admin_email(text) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $function$;

CREATE OR REPLACE FUNCTION public.enforce_max_users()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $function$
DECLARE v_max int; v_count int; BEGIN
  SELECT sp.max_users INTO v_max FROM tenants t LEFT JOIN subscription_plans sp ON sp.id = t.plan_id WHERE t.id = NEW.tenant_id;
  IF v_max IS NOT NULL AND v_max > 0 THEN
    SELECT count(*) INTO v_count FROM tenant_memberships WHERE tenant_id = NEW.tenant_id;
    IF v_count >= v_max THEN
      RAISE EXCEPTION 'plan_limit_exceeded: max_users (%) reached for this plan', v_max;
    END IF;
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.enforce_max_doctors()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $function$
DECLARE v_max int; v_count int; BEGIN
  SELECT sp.max_doctors INTO v_max FROM tenants t LEFT JOIN subscription_plans sp ON sp.id = t.plan_id WHERE t.id = NEW.tenant_id;
  IF v_max IS NOT NULL AND v_max > 0 THEN
    SELECT count(*) INTO v_count FROM doctors WHERE tenant_id = NEW.tenant_id;
    IF v_count >= v_max THEN
      RAISE EXCEPTION 'plan_limit_exceeded: max_doctors (%) reached for this plan', v_max;
    END IF;
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.enforce_max_patients()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $function$
DECLARE v_max int; v_count int; BEGIN
  SELECT sp.max_patients INTO v_max FROM tenants t LEFT JOIN subscription_plans sp ON sp.id = t.plan_id WHERE t.id = NEW.tenant_id;
  IF v_max IS NOT NULL AND v_max > 0 THEN
    SELECT count(*) INTO v_count FROM patients WHERE tenant_id = NEW.tenant_id;
    IF v_count >= v_max THEN
      RAISE EXCEPTION 'plan_limit_exceeded: max_patients (%) reached for this plan', v_max;
    END IF;
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.fn_generate_invoice_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $function$
DECLARE
  v_date text := to_char(now(), 'YYYYMMDD');
  v_seq bigint;
BEGIN
  SELECT COALESCE(MAX((regexp_match(invoice_number, 'INV-' || v_date || '-(\d+)'))[1]::bigint), 0)
  INTO v_seq FROM billing_invoices WHERE invoice_number LIKE 'INV-' || v_date || '-%';
  NEW.invoice_number := 'INV-' || v_date || '-' || lpad((v_seq + 1)::text, 4, '0');
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.is_super_admin_email(email_to_check text DEFAULT NULL::text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  check_email text;
  whitelist text[] := ARRAY[
    'vincentnogue2@gmail.com',
    'vincentnogue@yahoo.com',
    'webdxb1@gmail.com'
  ];
  user_email text;
BEGIN
  IF email_to_check IS NOT NULL THEN
    check_email := lower(trim(email_to_check));
    RETURN check_email = ANY(whitelist);
  END IF;
  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
  IF user_email IS NULL THEN RETURN false; END IF;
  RETURN lower(trim(user_email)) = ANY(whitelist);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_staff_performance(p_tenant_id uuid)
RETURNS TABLE(doctor_id uuid, first_name text, last_name text, specialty text, status text, appointments_count bigint, consultations_count bigint, prescriptions_count bigint, lab_orders_count bigint, radiology_orders_count bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
BEGIN
  IF NOT (is_tenant_member(p_tenant_id) OR is_super_admin()) THEN
    RAISE EXCEPTION 'forbidden: not a member of this tenant';
  END IF;
  IF NOT tenant_module_enabled(p_tenant_id, 'performance') THEN
    RAISE EXCEPTION 'forbidden: performance module not included in this tenant''s plan';
  END IF;

  RETURN QUERY
  SELECT
    d.id, d.first_name, d.last_name, d.specialty, d.status,
    COALESCE(apt.cnt, 0), COALESCE(con.cnt, 0), COALESCE(pre.cnt, 0), COALESCE(lab.cnt, 0), COALESCE(rad.cnt, 0)
  FROM doctors d
  LEFT JOIN (SELECT doctor_id, count(*) AS cnt FROM appointments WHERE tenant_id = p_tenant_id AND doctor_id IS NOT NULL GROUP BY doctor_id) apt ON apt.doctor_id = d.id
  LEFT JOIN (SELECT doctor_id, count(*) AS cnt FROM consultations WHERE tenant_id = p_tenant_id AND doctor_id IS NOT NULL GROUP BY doctor_id) con ON con.doctor_id = d.id
  LEFT JOIN (SELECT doctor_id, count(*) AS cnt FROM prescriptions WHERE tenant_id = p_tenant_id AND doctor_id IS NOT NULL GROUP BY doctor_id) pre ON pre.doctor_id = d.id
  LEFT JOIN (SELECT doctor_id, count(*) AS cnt FROM lab_orders WHERE tenant_id = p_tenant_id AND doctor_id IS NOT NULL GROUP BY doctor_id) lab ON lab.doctor_id = d.id
  LEFT JOIN (SELECT doctor_id, count(*) AS cnt FROM radiology_orders WHERE tenant_id = p_tenant_id AND doctor_id IS NOT NULL GROUP BY doctor_id) rad ON rad.doctor_id = d.id
  WHERE d.tenant_id = p_tenant_id;
END;
$function$;
