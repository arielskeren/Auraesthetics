-- Add deleted column to customers table for soft deletes
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT FALSE;

-- Create index for faster queries filtering out deleted customers
CREATE INDEX IF NOT EXISTS idx_customers_deleted ON customers(deleted) WHERE deleted = FALSE;

