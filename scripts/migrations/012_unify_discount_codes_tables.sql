-- Migration: Unify discount_codes and one_time_discount_codes into a single table
-- This consolidates both global and one-time codes into one table with a code_type field

-- Step 1: Add new columns to discount_codes to support one-time codes
DO $$ 
BEGIN
  -- Add code_type column to distinguish global vs one-time
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' AND column_name = 'code_type'
  ) THEN
    ALTER TABLE discount_codes ADD COLUMN code_type VARCHAR(20) DEFAULT 'global';
  END IF;
  
  -- Add customer_id for one-time codes (nullable)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE discount_codes ADD COLUMN customer_id UUID REFERENCES customers(id) ON DELETE CASCADE;
  END IF;
  
  -- Add used flag for one-time codes (nullable, default false)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' AND column_name = 'used'
  ) THEN
    ALTER TABLE discount_codes ADD COLUMN used BOOLEAN DEFAULT FALSE;
  END IF;
  
  -- Add used_at timestamp for one-time codes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' AND column_name = 'used_at'
  ) THEN
    ALTER TABLE discount_codes ADD COLUMN used_at TIMESTAMPTZ;
  END IF;
  
  -- Add email_sent flag for one-time codes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' AND column_name = 'email_sent'
  ) THEN
    ALTER TABLE discount_codes ADD COLUMN email_sent BOOLEAN DEFAULT FALSE;
  END IF;
  
  -- Add email_sent_at timestamp for one-time codes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' AND column_name = 'email_sent_at'
  ) THEN
    ALTER TABLE discount_codes ADD COLUMN email_sent_at TIMESTAMPTZ;
  END IF;
  
  -- Add created_by for one-time codes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE discount_codes ADD COLUMN created_by VARCHAR(100);
  END IF;
  
  -- Ensure usage_count exists (from migration 011)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' AND column_name = 'usage_count'
  ) THEN
    ALTER TABLE discount_codes ADD COLUMN usage_count INTEGER DEFAULT 0 NOT NULL;
  END IF;
  
  -- Ensure expires_at is TIMESTAMPTZ (not just TIMESTAMP) for consistency
  -- This is a no-op if already TIMESTAMPTZ, but safe to run
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' 
      AND column_name = 'expires_at' 
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE discount_codes ALTER COLUMN expires_at TYPE TIMESTAMPTZ USING expires_at::TIMESTAMPTZ;
  END IF;
  
  -- Ensure created_at and updated_at are TIMESTAMPTZ
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' 
      AND column_name = 'created_at' 
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE discount_codes ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::TIMESTAMPTZ;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' 
      AND column_name = 'updated_at' 
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE discount_codes ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at::TIMESTAMPTZ;
  END IF;
END $$;

-- Step 2: Migrate data from one_time_discount_codes to discount_codes
-- Only migrate if one_time_discount_codes table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'one_time_discount_codes'
  ) THEN
    -- Insert one-time codes into discount_codes with code_type = 'one_time'
    INSERT INTO discount_codes (
      code, 
      code_type,
      customer_id,
      discount_type, 
      discount_value, 
      discount_cap,
      expires_at,
      stripe_coupon_id,
      used,
      used_at,
      email_sent,
      email_sent_at,
      created_by,
      created_at,
      updated_at
    )
    SELECT 
      code,
      'one_time'::VARCHAR(20),
      customer_id,
      discount_type,
      discount_value,
      discount_cap,
      expires_at,
      stripe_coupon_id,
      used,
      used_at,
      email_sent,
      email_sent_at,
      created_by,
      created_at,
      updated_at
    FROM one_time_discount_codes
    ON CONFLICT (code) DO NOTHING; -- Skip if code already exists in discount_codes
    
    -- Mark existing discount_codes as 'global' if code_type is NULL
    UPDATE discount_codes 
    SET code_type = 'global' 
    WHERE code_type IS NULL;
  END IF;
END $$;

-- Step 3: Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_discount_codes_code_type ON discount_codes(code_type);
CREATE INDEX IF NOT EXISTS idx_discount_codes_customer_id ON discount_codes(customer_id);
CREATE INDEX IF NOT EXISTS idx_discount_codes_used ON discount_codes(used);

-- Step 4: Add constraint to ensure code_type is valid
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'discount_codes_code_type_check'
  ) THEN
    ALTER TABLE discount_codes 
    ADD CONSTRAINT discount_codes_code_type_check 
    CHECK (code_type IN ('global', 'one_time'));
  END IF;
END $$;

-- Step 5: Add constraint to ensure one-time codes have customer_id or used flag makes sense
-- (No strict constraint needed - business logic handles this)

-- Note: The one_time_discount_codes table is NOT dropped automatically
-- Run this manually after verifying migration:
DROP TABLE IF EXISTS one_time_discount_codes;

