-- Quick script to update prices for all services based on services.json
-- This will update prices for services where price IS NULL

UPDATE services 
SET price = 150.00
WHERE slug = 'aura-facial' AND (price IS NULL OR price = 0);

UPDATE services 
SET price = 165.00
WHERE slug = 'anti-aging-facial' AND (price IS NULL OR price = 0);

UPDATE services 
SET price = 135.00
WHERE slug = 'hydrafacial' AND (price IS NULL OR price = 0);

UPDATE services 
SET price = 155.00
WHERE slug = 'glass-skin-facial' AND (price IS NULL OR price = 0);

UPDATE services 
SET price = 135.00
WHERE slug = 'signature-detox-facial' AND (price IS NULL OR price = 0);

UPDATE services 
SET price = 145.00
WHERE slug = 'lymphatic-drainage-facial' AND (price IS NULL OR price = 0);

UPDATE services 
SET price = 60.00
WHERE slug = 'dermaplaning' AND (price IS NULL OR price = 0);

UPDATE services 
SET price = 230.00
WHERE slug = 'biorepeel' AND (price IS NULL OR price = 0);

UPDATE services 
SET price = 170.00
WHERE slug = 'microneedling' AND (price IS NULL OR price = 0);

UPDATE services 
SET price = 25.00
WHERE slug = 'led-therapy-addon' AND (price IS NULL OR price = 0);

UPDATE services 
SET price = 135.00
WHERE slug = 'oxygen-peel' AND (price IS NULL OR price = 0);

UPDATE services 
SET price = 20.00
WHERE slug = 'brow-tint' AND (price IS NULL OR price = 0);

UPDATE services 
SET price = 35.00
WHERE slug = 'brow-wax-tint' AND (price IS NULL OR price = 0);

UPDATE services 
SET price = 80.00
WHERE slug = 'brow-lamination' AND (price IS NULL OR price = 0);

UPDATE services 
SET price = 80.00
WHERE slug = 'lash-lift-tint' AND (price IS NULL OR price = 0);

UPDATE services 
SET price = 160.00
WHERE slug = 'brow-lamination-lash-lift-combo' AND (price IS NULL OR price = 0);

UPDATE services 
SET price = 20.00
WHERE slug = 'brow-wax' AND (price IS NULL OR price = 0);

UPDATE services 
SET price = 10.00
WHERE slug = 'lip-wax' AND (price IS NULL OR price = 0);

-- Generic fallback: set a default price for any remaining services with null prices
UPDATE services 
SET price = 100.00
WHERE price IS NULL OR price = 0;

-- Verify the updates
SELECT slug, name, price 
FROM services 
ORDER BY slug;


