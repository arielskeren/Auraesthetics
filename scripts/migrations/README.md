# Database Migrations

This directory contains SQL migration scripts for the Auraesthetics database.

## Running Migrations

Migrations should be run manually against the Neon database using the Neon console or a PostgreSQL client.

## Migration Scripts

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

