# MagicPay Test Cards

Use these test cards in **test mode** (`MAGICPAY_MODE=test`):

| Card Type | Number | CVV | Expiry |
|-----------|--------|-----|--------|
| **Visa** | `4111 1111 1111 1111` | Any 3 digits | Any future date |
| **Mastercard** | `5555 5555 5555 4444` | Any 3 digits | Any future date |
| **American Express** | `3782 8224 6310 005` | Any 4 digits | Any future date |
| **Discover** | `6011 1111 1111 1117` | Any 3 digits | Any future date |

### Decline Testing
- Use amount `$0.01` to simulate a declined transaction
- Use card `4000 0000 0000 0002` for explicit decline

---

# Receipts

**MagicPay does NOT provide automatic customer email receipts** (unlike Stripe).

We handle receipts via our own booking confirmation email which includes:
- Service name and date/time
- Amount charged
- Transaction reference (MagicPay Transaction ID)
- Business contact information

For refunds, we send a separate cancellation/refund email.

---
