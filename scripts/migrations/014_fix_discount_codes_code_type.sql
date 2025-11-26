-- Migration: Fix NULL code_type in discount_codes table
-- This ensures all existing codes have a proper code_type set
-- Codes with customer_id are one-time codes, others are global

DO $$
BEGIN
  -- Set code_type for codes with customer_id (one-time codes)
  UPDATE discount_codes
  SET code_type = 'one_time', updated_at = NOW()
  WHERE code_type IS NULL 
    AND customer_id IS NOT NULL;
  
  -- Set code_type for codes without customer_id (global codes)
  UPDATE discount_codes
  SET code_type = 'global', updated_at = NOW()
  WHERE code_type IS NULL 
    AND customer_id IS NULL;
  
  -- Ensure is_active defaults to true for NULL values
  UPDATE discount_codes
  SET is_active = true, updated_at = NOW()
  WHERE is_active IS NULL;
  
  -- Log the changes
  RAISE NOTICE 'Migration 014: Fixed code_type and is_active for discount_codes';
END $$;

-- Verify the migration
SELECT 
  code_type,
  COUNT(*) as count,
  COUNT(CASE WHEN is_active IS NULL THEN 1 END) as null_active_count
FROM discount_codes
GROUP BY code_type
ORDER BY code_type;

