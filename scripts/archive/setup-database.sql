-- Auraesthetics Database Schema
-- Run this in your Neon database SQL editor

-- Bookings Table
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cal_booking_id VARCHAR(255) UNIQUE,
  hapio_booking_id VARCHAR(255) UNIQUE,
  service_id VARCHAR(100),
  service_name VARCHAR(255),
  client_name VARCHAR(255),
  client_email VARCHAR(255),
  client_phone VARCHAR(50),
  booking_date TIMESTAMP,
  amount DECIMAL(10, 2),
  deposit_amount DECIMAL(10, 2),
  final_amount DECIMAL(10, 2),
  discount_code VARCHAR(50),
  discount_amount DECIMAL(10, 2),
  payment_type VARCHAR(50), -- 'full', 'deposit'
  payment_status VARCHAR(50) DEFAULT 'pending', -- 'paid', 'deposit', 'pending', 'authorized', 'cancelled'
  payment_intent_id VARCHAR(255),
  payment_method_id VARCHAR(255), -- For Stripe payment method
  plaid_authorization_id VARCHAR(255), -- Reserved for future payment plan support
  plaid_authorization_amount DECIMAL(10, 2),
  outlook_event_id VARCHAR(255),
  outlook_sync_status VARCHAR(50) DEFAULT 'pending',
  outlook_sync_log JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB -- Store additional provider data
);

-- Discount Codes Table
CREATE TABLE IF NOT EXISTS discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  stripe_coupon_id VARCHAR(255), -- Link to Stripe coupon
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_bookings_cal_id ON bookings(cal_booking_id);
CREATE INDEX IF NOT EXISTS idx_bookings_hapio_id ON bookings(hapio_booking_id);
CREATE INDEX IF NOT EXISTS idx_bookings_email ON bookings(client_email);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_intent ON bookings(payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_bookings_outlook_event ON bookings(outlook_event_id);
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_discount_codes_active ON discount_codes(is_active);

-- Insert WELCOME15 discount code (you'll need to update the stripe_coupon_id)
INSERT INTO discount_codes (code, stripe_coupon_id, description, is_active)
VALUES ('WELCOME15', '1001', '15% off up to $30', true)
ON CONFLICT (code) DO NOTHING;

-- Integration tokens table for Outlook (and future connectors)
CREATE TABLE IF NOT EXISTS integration_tokens (
  provider VARCHAR(100) PRIMARY KEY,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMP,
  metadata JSONB,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_tokens_provider ON integration_tokens(provider);


