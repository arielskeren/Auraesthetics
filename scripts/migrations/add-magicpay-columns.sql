-- Migration: Add MagicPay payment columns
-- Purpose: Add columns to support MagicPay payment gateway (replacing Stripe)
-- Date: 2024
-- Note: Existing Stripe columns (stripe_customer_id, stripe_pi_id, stripe_charge_id) 
--       are preserved for historical data reference

-- =============================================================================
-- CUSTOMERS TABLE - Add MagicPay Customer Vault ID
-- =============================================================================

-- Add magicpay_customer_vault_id column for storing Customer Vault references
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'customers' 
        AND column_name = 'magicpay_customer_vault_id'
    ) THEN
        ALTER TABLE customers ADD COLUMN magicpay_customer_vault_id VARCHAR(255) NULL;
        COMMENT ON COLUMN customers.magicpay_customer_vault_id IS 'MagicPay Customer Vault ID for stored payment methods';
    END IF;
END $$;

-- Create index for faster Customer Vault lookups
CREATE INDEX IF NOT EXISTS idx_customers_magicpay_vault_id 
ON customers(magicpay_customer_vault_id) 
WHERE magicpay_customer_vault_id IS NOT NULL;

-- =============================================================================
-- PAYMENTS TABLE - Add MagicPay transaction details
-- =============================================================================

-- Add magicpay_transaction_id column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' 
        AND column_name = 'magicpay_transaction_id'
    ) THEN
        ALTER TABLE payments ADD COLUMN magicpay_transaction_id VARCHAR(255) NULL;
        COMMENT ON COLUMN payments.magicpay_transaction_id IS 'MagicPay transaction ID from successful sale';
    END IF;
END $$;

-- Add magicpay_auth_code column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' 
        AND column_name = 'magicpay_auth_code'
    ) THEN
        ALTER TABLE payments ADD COLUMN magicpay_auth_code VARCHAR(50) NULL;
        COMMENT ON COLUMN payments.magicpay_auth_code IS 'MagicPay authorization code from successful sale';
    END IF;
END $$;

-- Add payment_provider column to track which gateway was used
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' 
        AND column_name = 'payment_provider'
    ) THEN
        ALTER TABLE payments ADD COLUMN payment_provider VARCHAR(20) DEFAULT 'stripe';
        COMMENT ON COLUMN payments.payment_provider IS 'Payment gateway used: stripe (legacy) or magicpay';
    END IF;
END $$;

-- Create index for MagicPay transaction lookups
CREATE INDEX IF NOT EXISTS idx_payments_magicpay_transaction_id 
ON payments(magicpay_transaction_id) 
WHERE magicpay_transaction_id IS NOT NULL;

-- Create index for payment provider filtering
CREATE INDEX IF NOT EXISTS idx_payments_payment_provider 
ON payments(payment_provider);

-- =============================================================================
-- BOOKINGS TABLE - Add MagicPay transaction reference
-- =============================================================================

-- Add magicpay_transaction_id column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' 
        AND column_name = 'magicpay_transaction_id'
    ) THEN
        ALTER TABLE bookings ADD COLUMN magicpay_transaction_id VARCHAR(255) NULL;
        COMMENT ON COLUMN bookings.magicpay_transaction_id IS 'MagicPay transaction ID for this booking payment';
    END IF;
END $$;

-- Add magicpay_auth_code column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' 
        AND column_name = 'magicpay_auth_code'
    ) THEN
        ALTER TABLE bookings ADD COLUMN magicpay_auth_code VARCHAR(50) NULL;
        COMMENT ON COLUMN bookings.magicpay_auth_code IS 'MagicPay authorization code for this booking payment';
    END IF;
END $$;

-- Create index for MagicPay transaction lookups on bookings
CREATE INDEX IF NOT EXISTS idx_bookings_magicpay_transaction_id 
ON bookings(magicpay_transaction_id) 
WHERE magicpay_transaction_id IS NOT NULL;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================
-- Run these to verify the migration was successful:

-- Check customers table:
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'customers' AND column_name LIKE 'magicpay%';

-- Check payments table:
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'payments' AND column_name LIKE 'magicpay%';

-- Check bookings table:
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'bookings' AND column_name LIKE 'magicpay%';

-- Check indexes:
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename IN ('customers', 'payments', 'bookings') 
-- AND indexname LIKE '%magicpay%';

