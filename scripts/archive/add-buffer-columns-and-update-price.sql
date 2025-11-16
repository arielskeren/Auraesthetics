-- Add buffer columns to services table
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS buffer_before_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS buffer_after_minutes INTEGER DEFAULT 0;

-- Migrate price from VARCHAR to NUMERIC
-- First, create a new price_numeric column
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS price_numeric NUMERIC(10, 2);

-- Extract numeric value from existing price strings (e.g., "from $150" -> 150)
-- This handles various formats: "from $150", "$150", "150", etc.
UPDATE services 
SET price_numeric = CASE
  WHEN price IS NULL OR price = '' THEN NULL
  WHEN price ~ '^\$?(\d+(?:\.\d+)?)' THEN 
    CAST(REGEXP_REPLACE(price, '[^0-9.]', '', 'g') AS NUMERIC)
  ELSE NULL
END
WHERE price_numeric IS NULL;

-- Drop the old price column and rename price_numeric to price
ALTER TABLE services DROP COLUMN IF EXISTS price;
ALTER TABLE services RENAME COLUMN price_numeric TO price;

-- Add comment to clarify price format
COMMENT ON COLUMN services.price IS 'Numeric price in dollars (e.g., 150.00 for $150)';


