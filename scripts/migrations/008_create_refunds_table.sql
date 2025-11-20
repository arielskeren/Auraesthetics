-- Create refunds table to track individual refund transactions
-- This allows multiple refunds per payment and better audit trail
-- Each refund links to a payment record (which links to a booking)

CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL, -- Denormalized for easier querying (also available via payment_id)
  stripe_refund_id TEXT NOT NULL UNIQUE, -- Stripe refund ID (e.g., re_xxx)
  amount_cents INT NOT NULL CHECK (amount_cents > 0),
  requested_amount_cents INT, -- What was requested (may differ from actual due to fees/rounding)
  currency TEXT NOT NULL DEFAULT 'usd',
  reason TEXT, -- Refund reason provided by admin/user
  refund_type TEXT, -- 'percentage' or 'amount'
  refund_percentage NUMERIC(5, 2), -- If refund_type is 'percentage', store the percentage
  stripe_reason TEXT, -- Stripe's reason (e.g., 'requested_by_customer', 'duplicate', etc.)
  status TEXT NOT NULL DEFAULT 'succeeded', -- 'succeeded', 'pending', 'failed', 'canceled'
  metadata JSONB, -- Additional metadata (e.g., refunded_by, notes, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_booking_id ON refunds(booking_id);
CREATE INDEX IF NOT EXISTS idx_refunds_stripe_refund_id ON refunds(stripe_refund_id);
CREATE INDEX IF NOT EXISTS idx_refunds_created_at ON refunds(created_at DESC);

-- Add comments
COMMENT ON TABLE refunds IS 'Individual refund transactions. Multiple refunds can be issued per payment.';
COMMENT ON COLUMN refunds.payment_id IS 'Reference to the payment record this refund is for';
COMMENT ON COLUMN refunds.booking_id IS 'Denormalized booking ID for easier querying (also available via payment_id)';
COMMENT ON COLUMN refunds.stripe_refund_id IS 'Stripe refund ID (unique, e.g., re_xxx)';
COMMENT ON COLUMN refunds.amount_cents IS 'Actual refund amount in cents (from Stripe)';
COMMENT ON COLUMN refunds.requested_amount_cents IS 'Requested refund amount in cents (may differ from actual due to fees/rounding)';
COMMENT ON COLUMN refunds.reason IS 'Refund reason provided by admin/user';
COMMENT ON COLUMN refunds.refund_type IS 'Type of refund: percentage or amount';
COMMENT ON COLUMN refunds.refund_percentage IS 'Percentage refunded (if refund_type is percentage)';
COMMENT ON COLUMN refunds.stripe_reason IS 'Stripe refund reason (e.g., requested_by_customer, duplicate, etc.)';
COMMENT ON COLUMN refunds.status IS 'Refund status: succeeded, pending, failed, canceled';
COMMENT ON COLUMN refunds.metadata IS 'Additional metadata (refunded_by, notes, etc.)';

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_refunds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_refunds_updated_at
  BEFORE UPDATE ON refunds
  FOR EACH ROW
  EXECUTE FUNCTION update_refunds_updated_at();

-- Optional: Add a view for easier refund queries with payment and booking info
CREATE OR REPLACE VIEW refunds_with_details AS
SELECT 
  r.id,
  r.payment_id,
  r.booking_id,
  r.stripe_refund_id,
  r.amount_cents,
  r.requested_amount_cents,
  r.currency,
  r.reason,
  r.refund_type,
  r.refund_percentage,
  r.stripe_reason,
  r.status,
  r.metadata,
  r.created_at,
  r.updated_at,
  p.stripe_pi_id,
  p.amount_cents AS payment_amount_cents,
  p.refunded_cents AS payment_total_refunded_cents,
  b.client_email,
  b.client_name,
  b.service_name,
  b.booking_date
FROM refunds r
JOIN payments p ON r.payment_id = p.id
JOIN bookings b ON r.booking_id = b.id;

COMMENT ON VIEW refunds_with_details IS 'Refunds with joined payment and booking details for easier querying';
