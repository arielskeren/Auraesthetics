-- One-time discount codes table
CREATE TABLE IF NOT EXISTS one_time_discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  code VARCHAR(50) UNIQUE NOT NULL,
  discount_type VARCHAR(10) NOT NULL CHECK (discount_type IN ('percent', 'dollar')),
  discount_value NUMERIC(10, 2) NOT NULL CHECK (discount_value > 0),
  used BOOLEAN NOT NULL DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  stripe_coupon_id VARCHAR(255),
  email_sent BOOLEAN NOT NULL DEFAULT FALSE,
  email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by VARCHAR(100) -- Track who created it (e.g., 'admin', 'system')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_one_time_codes_customer ON one_time_discount_codes(customer_id);
CREATE INDEX IF NOT EXISTS idx_one_time_codes_code ON one_time_discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_one_time_codes_used ON one_time_discount_codes(used);
CREATE INDEX IF NOT EXISTS idx_one_time_codes_expires ON one_time_discount_codes(expires_at);

