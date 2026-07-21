/*
# Staff performance RPC function

## Summary
Creates a `get_staff_performance` RPC function that returns aggregated performance metrics per doctor for a given tenant. This allows the Performance module to fetch all metrics in a single call.

## Security
- SECURITY DEFINER function
- Takes a tenant_id parameter
- Returns aggregated counts from appointments, consultations, prescriptions, lab_orders, radiology_orders
*/

CREATE OR REPLACE FUNCTION get_staff_performance(p_tenant_id uuid)
RETURNS TABLE (
  doctor_id uuid,
  first_name text,
  last_name text,
  specialty text,
  status text,
  appointments_count bigint,
  consultations_count bigint,
  prescriptions_count bigint,
  lab_orders_count bigint,
  radiology_orders_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id AS doctor_id,
    d.first_name,
    d.last_name,
    d.specialty,
    d.status,
    COALESCE(apt.cnt, 0) AS appointments_count,
    COALESCE(con.cnt, 0) AS consultations_count,
    COALESCE(pre.cnt, 0) AS prescriptions_count,
    COALESCE(lab.cnt, 0) AS lab_orders_count,
    COALESCE(rad.cnt, 0) AS radiology_orders_count
  FROM doctors d
  LEFT JOIN (SELECT doctor_id, count(*) AS cnt FROM appointments WHERE tenant_id = p_tenant_id AND doctor_id IS NOT NULL GROUP BY doctor_id) apt ON apt.doctor_id = d.id
  LEFT JOIN (SELECT doctor_id, count(*) AS cnt FROM consultations WHERE tenant_id = p_tenant_id AND doctor_id IS NOT NULL GROUP BY doctor_id) con ON con.doctor_id = d.id
  LEFT JOIN (SELECT doctor_id, count(*) AS cnt FROM prescriptions WHERE tenant_id = p_tenant_id AND doctor_id IS NOT NULL GROUP BY doctor_id) pre ON pre.doctor_id = d.id
  LEFT JOIN (SELECT doctor_id, count(*) AS cnt FROM lab_orders WHERE tenant_id = p_tenant_id AND doctor_id IS NOT NULL GROUP BY doctor_id) lab ON lab.doctor_id = d.id
  LEFT JOIN (SELECT doctor_id, count(*) AS cnt FROM radiology_orders WHERE tenant_id = p_tenant_id AND doctor_id IS NOT NULL GROUP BY doctor_id) rad ON rad.doctor_id = d.id
  WHERE d.tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
