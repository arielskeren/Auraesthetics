-- Add payment_type column to bookings table if it doesn't exist
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS payment_type VARCHAR(50);

-- Update existing bookings to extract payment type from metadata
UPDATE bookings
SET payment_type = metadata->>'paymentType'
WHERE payment_type IS NULL AND metadata->>'paymentType' IS NOT NULL;

-- Add index for payment type queries
CREATE INDEX IF NOT EXISTS idx_bookings_payment_type ON bookings(payment_type);


