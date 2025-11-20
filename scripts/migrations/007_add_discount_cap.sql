-- Add discount_cap column to one_time_discount_codes table
-- This allows percentage discounts to be capped at a maximum dollar amount
-- Example: 15% off up to $40

ALTER TABLE one_time_discount_codes 
ADD COLUMN IF NOT EXISTS discount_cap NUMERIC(10, 2) CHECK (discount_cap > 0);

-- Add comment
COMMENT ON COLUMN one_time_discount_codes.discount_cap IS 'Maximum discount amount in dollars (for percentage discounts only). Example: 15% off capped at $40';

