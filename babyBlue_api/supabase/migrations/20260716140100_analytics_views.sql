-- §4.2 Clinic flow analytics over data we already collect.
-- security_invoker: views run with the caller's permissions, so staff RLS
-- on the underlying tables applies (service role / admin portal sees all).

CREATE VIEW v_daily_clinic_stats
WITH (security_invoker = true) AS
SELECT
  a.clinic_id,
  a.appointment_date                                            AS day,
  count(*)                                                      AS total_visits,
  count(*) FILTER (WHERE a.status = 'done')                     AS completed_visits,
  count(*) FILTER (WHERE a.status = 'cancelled')                AS cancelled_visits,
  count(*) FILTER (WHERE ev.patient_left)                       AS patient_left_visits,
  round((percentile_cont(0.5) WITHIN GROUP (
    ORDER BY extract(epoch FROM (a.consultation_started_at - a.entered_queue_at)) / 60
  ) FILTER (WHERE a.consultation_started_at IS NOT NULL))::numeric, 1) AS median_wait_minutes,
  round((percentile_cont(0.9) WITHIN GROUP (
    ORDER BY extract(epoch FROM (a.consultation_started_at - a.entered_queue_at)) / 60
  ) FILTER (WHERE a.consultation_started_at IS NOT NULL))::numeric, 1) AS p90_wait_minutes,
  round((percentile_cont(0.5) WITHIN GROUP (
    ORDER BY extract(epoch FROM (a.completed_at - a.consultation_started_at)) / 60
  ) FILTER (WHERE a.completed_at IS NOT NULL AND a.consultation_started_at IS NOT NULL))::numeric, 1)
                                                                AS median_consultation_minutes
FROM appointments a
LEFT JOIN LATERAL (
  SELECT true AS patient_left
  FROM appointment_events e
  WHERE e.appointment_id = a.id AND e.event_type = 'queue_left'
  LIMIT 1
) ev ON true
GROUP BY a.clinic_id, a.appointment_date;

CREATE VIEW v_hourly_arrivals
WITH (security_invoker = true) AS
SELECT
  clinic_id,
  appointment_date                                                        AS day,
  extract(hour FROM entered_queue_at AT TIME ZONE 'Africa/Johannesburg')::int AS hour_of_day,
  count(*)                                                                AS arrivals
FROM appointments
GROUP BY clinic_id, appointment_date, hour_of_day;
