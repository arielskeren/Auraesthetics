-- Add hapio_service_id column to services table
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS hapio_service_id VARCHAR(255);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_services_hapio_service_id ON services(hapio_service_id);

