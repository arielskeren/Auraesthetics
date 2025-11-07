# Stripe Test Card Numbers

Use these test card numbers when testing payments in **Stripe Test Mode**. These cards will **NOT** charge real money.

## ✅ Success Cards

### Basic Success Card
- **Card Number:** `4242 4242 4242 4242`
- **Expiry:** Any future date (e.g., `12/34`)
- **CVC:** Any 3 digits (e.g., `123`)
- **ZIP:** Any 5 digits (e.g., `12345`)
- **Use Case:** Standard successful payment

### Success Card (3D Secure)
- **Card Number:** `4000 0025 0000 3155`
- **Use Case:** Tests 3D Secure authentication flow

### Visa Debit
- **Card Number:** `4000 0566 5566 5556`
- **Use Case:** Tests debit card processing

## ❌ Error Cards (For Testing Edge Cases)

### Card Declined
- **Card Number:** `4000 0000 0000 0002`
- **Result:** Card will be declined

### Insufficient Funds
- **Card Number:** `4000 0000 0000 9995`
- **Result:** Payment fails due to insufficient funds

### Requires Authentication
- **Card Number:** `4000 0027 6000 3184`
- **Result:** Payment requires additional authentication

## 🧪 Testing Your Payment Flow

### Test Full Payment
1. Select "Pay Full Amount"
2. Use card: `4242 4242 4242 4242`
3. Should charge immediately

### Test Deposit Payment
1. Select "Pay 50% Deposit"
2. Use card: `4242 4242 4242 4242`
3. Should charge 50% of the amount

### Test Pay Later (Authorization)
1. Select "Pay Later"
2. Use card: `4242 4242 4242 4242`
3. Should create authorization hold (no charge, just hold)
4. Amount will be held but not charged until you capture it

### Test Discount Codes
1. Enter discount code: `WELCOME15`
2. Should apply 15% discount (capped at $30)
3. Use any success card above

## 📝 Important Notes

- **Test Mode Only:** These cards only work in Stripe Test Mode
- **No Real Charges:** These are test cards - no real money is charged
- **Real Cards:** Never use real card numbers in test mode
- **Production:** When you go live, switch to Stripe Live Mode and use real cards

## 🔍 Verifying Test Mode

You can verify you're in test mode by checking:
- Stripe Dashboard → Toggle in top right should say "Test mode"
- API keys should start with `pk_test_` (publishable) and `sk_test_` (secret)
- Test payments will appear in Stripe Dashboard with a "TEST" badge

## 📚 Resources

- [Stripe Test Cards Documentation](https://stripe.com/docs/testing)
- [Stripe Testing Guide](https://stripe.com/docs/testing#cards)

