-- Migration: Add usage_count column to discount_codes table for local tracking
-- This enables tracking global code usage without querying Stripe every time

-- Add usage_count column (default 0)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' AND column_name = 'usage_count'
  ) THEN
    ALTER TABLE discount_codes ADD COLUMN usage_count INTEGER DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Initialize usage_count to 0 for existing codes if column was just added
-- (This is safe because DEFAULT 0 NOT NULL handles new rows, but we want to ensure existing rows are 0)
UPDATE discount_codes 
SET usage_count = 0 
WHERE usage_count IS NULL;

