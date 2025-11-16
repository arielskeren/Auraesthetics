-- Update WELCOME15 coupon with correct Stripe coupon ID
UPDATE discount_codes 
SET stripe_coupon_id = 'L0DshEg5'
WHERE code = 'WELCOME15';

-- Verify the update
SELECT * FROM discount_codes WHERE code = 'WELCOME15';


