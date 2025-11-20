-- Backfill refunds table from existing booking_events and payments data
-- This migration extracts refund information from booking_events where type = 'refund'
-- and creates corresponding refunds table records

INSERT INTO refunds (
  payment_id,
  booking_id,
  stripe_refund_id,
  amount_cents,
  requested_amount_cents,
  currency,
  reason,
  refund_type,
  refund_percentage,
  stripe_reason,
  status,
  metadata,
  created_at
)
SELECT 
  p.id AS payment_id,
  be.booking_id,
  be.data->>'refundId' AS stripe_refund_id,
  (be.data->>'amount_cents')::INT AS amount_cents,
  (be.data->>'requested_amount_cents')::INT AS requested_amount_cents,
  'usd' AS currency,
  be.data->>'reason' AS reason,
  be.data->>'refund_type' AS refund_type,
  (be.data->>'refund_percentage')::NUMERIC(5, 2) AS refund_percentage,
  'requested_by_customer' AS stripe_reason, -- Default, as we don't have this in old data
  'succeeded' AS status, -- Assume succeeded if it's in booking_events
  jsonb_build_object(
    'total_refunded_cents', be.data->>'total_refunded_cents',
    'total_payment_cents', be.data->>'total_payment_cents',
    'already_refunded_before', be.data->>'already_refunded_before',
    'refunded_on_this_payment', be.data->>'refunded_on_this_payment',
    'payment_record_id', be.data->>'payment_record_id',
    'migrated_from', 'booking_events'
  ) AS metadata,
  be.created_at
FROM booking_events be
JOIN payments p ON p.booking_id = be.booking_id
WHERE be.type = 'refund'
  AND be.data->>'refundId' IS NOT NULL
  AND be.data->>'amount_cents' IS NOT NULL
  -- Only insert if not already exists (idempotent)
  AND NOT EXISTS (
    SELECT 1 FROM refunds r 
    WHERE r.stripe_refund_id = be.data->>'refundId'
  )
ORDER BY be.created_at ASC;

-- Update payments.refunded_cents to match sum of refunds (in case of discrepancies)
UPDATE payments p
SET refunded_cents = COALESCE(
  (SELECT SUM(amount_cents) FROM refunds r WHERE r.payment_id = p.id),
  0
)
WHERE EXISTS (
  SELECT 1 FROM refunds r WHERE r.payment_id = p.id
);

COMMENT ON TABLE refunds IS 'Refunds table backfilled from booking_events. Future refunds will be inserted directly into this table.';
