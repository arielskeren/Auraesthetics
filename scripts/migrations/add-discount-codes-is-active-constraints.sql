-- Migration: Add CHECK constraint and index on discount_codes.is_active
-- Purpose: Ensure data integrity for is_active field and improve query performance
-- Date: 2024

-- Step 1: Ensure is_active column exists and has correct type
-- (This should already exist, but we check to be safe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'discount_codes' 
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE discount_codes ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
END $$;

-- Step 2: Update any NULL values to false (inactive) for data integrity
-- This ensures NULL values are treated as inactive (not active)
UPDATE discount_codes 
SET is_active = false 
WHERE is_active IS NULL;

-- Step 3: Add CHECK constraint to ensure is_active is always a boolean (not NULL)
-- This prevents NULL values from being inserted in the future
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'discount_codes_is_active_check'
        AND table_name = 'discount_codes'
    ) THEN
        ALTER TABLE discount_codes 
        ADD CONSTRAINT discount_codes_is_active_check 
        CHECK (is_active IS NOT NULL);
    END IF;
END $$;

-- Step 4: Set NOT NULL constraint on is_active column
-- This ensures the column can never be NULL
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'discount_codes' 
        AND column_name = 'is_active'
        AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE discount_codes 
        ALTER COLUMN is_active SET NOT NULL;
    END IF;
END $$;

-- Step 5: Set default value to true for new rows
-- This ensures new codes are active by default
DO $$
BEGIN
    ALTER TABLE discount_codes 
    ALTER COLUMN is_active SET DEFAULT true;
END $$;

-- Step 6: Create index on is_active for query performance
-- This improves performance of queries filtering by is_active
CREATE INDEX IF NOT EXISTS idx_discount_codes_is_active 
ON discount_codes(is_active) 
WHERE is_active = true;

-- Also create a partial index for inactive codes if needed for reporting
CREATE INDEX IF NOT EXISTS idx_discount_codes_is_active_false 
ON discount_codes(is_active) 
WHERE is_active = false;

-- Step 7: Create composite index for common query patterns
-- This improves performance of queries filtering by code_type and is_active
CREATE INDEX IF NOT EXISTS idx_discount_codes_code_type_is_active 
ON discount_codes(code_type, is_active) 
WHERE is_active = true;

-- Verification queries (run these to verify the migration)
-- SELECT column_name, data_type, is_nullable, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'discount_codes' AND column_name = 'is_active';

-- SELECT constraint_name, constraint_type 
-- FROM information_schema.table_constraints 
-- WHERE table_name = 'discount_codes' AND constraint_name = 'discount_codes_is_active_check';

-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename = 'discount_codes' AND indexname LIKE '%is_active%';

