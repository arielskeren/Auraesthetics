-- Add used_welcome_offer tracking to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS used_welcome_offer BOOLEAN NOT NULL DEFAULT FALSE;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_used_welcome_offer ON customers(used_welcome_offer);
CREATE INDEX IF NOT EXISTS idx_customers_email_lower ON customers(LOWER(email));

