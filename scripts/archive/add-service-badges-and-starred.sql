-- Add starred, featured, best_seller, most_popular fields to services table
ALTER TABLE services 
  ADD COLUMN IF NOT EXISTS starred BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS best_seller BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS most_popular BOOLEAN DEFAULT false;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_services_starred ON services(starred) WHERE starred = true;
CREATE INDEX IF NOT EXISTS idx_services_featured ON services(featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS idx_services_best_seller ON services(best_seller) WHERE best_seller = true;
CREATE INDEX IF NOT EXISTS idx_services_most_popular ON services(most_popular) WHERE most_popular = true;
CREATE INDEX IF NOT EXISTS idx_services_display_order ON services(display_order);


