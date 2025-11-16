-- Strengthen bookings constraints and indexes
CREATE UNIQUE INDEX IF NOT EXISTS ux_bookings_hapio_booking_id
ON bookings(hapio_booking_id)
WHERE hapio_booking_id IS NOT NULL;

ALTER TABLE bookings
ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;

-- Optional strictness (uncomment if desired once data is consistent)
-- ALTER TABLE payments ALTER COLUMN booking_id SET NOT NULL;


