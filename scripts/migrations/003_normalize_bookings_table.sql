-- Normalize bookings table to align with current application usage
-- Safe additions first; optional DROP statements are provided but commented out.
-- Review and uncomment drops only after confirming UI no longer relies on those fields.

-- Ensure core columns exist
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS hapio_booking_id TEXT;

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS service_id TEXT,
ADD COLUMN IF NOT EXISTS service_name TEXT;

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS client_name TEXT,
ADD COLUMN IF NOT EXISTS client_email TEXT,
ADD COLUMN IF NOT EXISTS client_phone TEXT;

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS booking_date TIMESTAMPTZ;

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS payment_status TEXT;

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS payment_intent_id TEXT;

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS outlook_event_id TEXT,
ADD COLUMN IF NOT EXISTS outlook_sync_status TEXT,
ADD COLUMN IF NOT EXISTS outlook_sync_log JSONB;

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Link to customers table (FK optional if desired)
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS customer_id UUID;

-- Timestamps
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Defaults for JSONB fields
UPDATE bookings SET metadata = '{}'::jsonb WHERE metadata IS NULL;
UPDATE bookings SET outlook_sync_log = '{}'::jsonb WHERE outlook_sync_log IS NULL;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_bookings_hapio_booking_id ON bookings(hapio_booking_id);
CREATE INDEX IF NOT EXISTS idx_bookings_client_email ON bookings(client_email);
CREATE INDEX IF NOT EXISTS idx_bookings_booking_date ON bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON bookings(customer_id);

-- OPTIONAL legacy columns that can be dropped once UI no longer references them:
-- NOTE: Current UI may still reference these. Drop only after removing dependencies.
-- ALTER TABLE bookings DROP COLUMN IF EXISTS amount;
-- ALTER TABLE bookings DROP COLUMN IF EXISTS deposit_amount;
-- ALTER TABLE bookings DROP COLUMN IF EXISTS final_amount;
-- ALTER TABLE bookings DROP COLUMN IF EXISTS discount_code;
-- ALTER TABLE bookings DROP COLUMN IF EXISTS discount_amount;
-- ALTER TABLE bookings DROP COLUMN IF EXISTS payment_method_id;
-- ALTER TABLE bookings DROP COLUMN IF EXISTS plaid_authorization_id;
-- ALTER TABLE bookings DROP COLUMN IF EXISTS plaid_authorization_amount;
-- ALTER TABLE bookings DROP COLUMN IF EXISTS payment_type;
-- ALTER TABLE bookings DROP COLUMN IF EXISTS cal_booking_id;


