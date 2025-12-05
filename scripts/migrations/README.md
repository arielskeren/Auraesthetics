# Database Migrations

This directory contains SQL migration scripts for the Auraesthetics database.

## Running Migrations

Migrations should be run manually against the Neon database using the Neon console or a PostgreSQL client.

## Migration Scripts

### add-magicpay-columns.sql
- **Purpose**: Add columns to support MagicPay payment gateway
- **Changes**:
  - `customers.magicpay_customer_vault_id` - For stored payment methods
  - `payments.magicpay_transaction_id` - MagicPay transaction reference
  - `payments.magicpay_auth_code` - Authorization code
  - `payments.payment_provider` - Track which gateway was used (stripe/magicpay)
  - `bookings.magicpay_transaction_id` - Transaction reference on booking
  - `bookings.magicpay_auth_code` - Authorization code on booking
  - Creates indexes for query performance
- **Run Date**: Before deploying MagicPay integration
- **Note**: Existing Stripe columns are preserved for historical data

### add-discount-codes-is-active-constraints.sql
- **Purpose**: Adds CHECK constraint and indexes on `discount_codes.is_active` column
- **Changes**:
  - Updates NULL values to false (inactive)
  - Adds CHECK constraint to prevent NULL values
  - Sets NOT NULL constraint
  - Creates indexes for query performance
- **Run Date**: After implementing discount code active status fixes

## Migration Guidelines

1. Always backup the database before running migrations
2. Test migrations on a staging environment first
3. Run migrations during low-traffic periods
4. Verify migration success using the verification queries in the script
5. Document any issues or rollback procedures

