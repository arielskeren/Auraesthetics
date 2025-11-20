-- Migration: Add fields to discount_codes table for global discount code management
-- This allows discount_codes to support max_uses, expiry, discount_cap, etc.

-- Add discount_type column (percent or dollar)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' AND column_name = 'discount_type'
  ) THEN
    ALTER TABLE discount_codes ADD COLUMN discount_type VARCHAR(20) DEFAULT 'percent';
  END IF;
END $$;

-- Add discount_value column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' AND column_name = 'discount_value'
  ) THEN
    ALTER TABLE discount_codes ADD COLUMN discount_value DECIMAL(10, 2);
  END IF;
END $$;

-- Add discount_cap column (for percentage discounts)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' AND column_name = 'discount_cap'
  ) THEN
    ALTER TABLE discount_codes ADD COLUMN discount_cap DECIMAL(10, 2);
  END IF;
END $$;

-- Add max_uses column (null = unlimited)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' AND column_name = 'max_uses'
  ) THEN
    ALTER TABLE discount_codes ADD COLUMN max_uses INTEGER;
  END IF;
END $$;

-- Add expires_at column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE discount_codes ADD COLUMN expires_at TIMESTAMP;
  END IF;
END $$;

-- Add stripe_promotion_code_id column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' AND column_name = 'stripe_promotion_code_id'
  ) THEN
    ALTER TABLE discount_codes ADD COLUMN stripe_promotion_code_id VARCHAR(255);
  END IF;
END $$;

-- Add updated_at column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE discount_codes ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
  END IF;
END $$;

-- Update existing WELCOME15 code if it exists and doesn't have discount_type/value
UPDATE discount_codes 
SET 
  discount_type = 'percent',
  discount_value = 15,
  discount_cap = 30,
  updated_at = NOW()
WHERE code = 'WELCOME15' 
  AND (discount_type IS NULL OR discount_value IS NULL);

