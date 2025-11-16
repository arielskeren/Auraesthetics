-- Add customer reference to bookings
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS customer_id UUID NULL;

-- Optional: index for faster agenda loads
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON bookings(customer_id);


