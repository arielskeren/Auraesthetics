COLLECT.JS INLINE IMPLEMENTATION SPEC FOR AURA AESTHETICS (MAGICPAY)

────────────────────────────────────
0. GOALS
────────────────────────────────────

– Replace Stripe with MagicPay using Collect.js INLINE integration (card payments only).
– Maintain PCI safety: card data never touches our servers; only payment_token does.
– Support one-off payments at launch, while:
– Saving customers’ card details into MagicPay Customer Vault for future use.
– Keeping the design fully on-brand via explicit CSS configuration.
– Keep architecture simple: a single “Review & Pay” page where:
– Client details and service selection come from prior steps.
– Payment form (inline Collect.js fields) is displayed.
– On “Pay Now”, tokenization runs, then backend charge is executed.

────────────────────────────────────
	1.	CONFIG / CREDENTIALS
────────────────────────────────────

Environment variables (server-side):

– MAGICPAY_API_SECURITY_KEY
– MagicPay API “Security Key” with API permission.
– MAGICPAY_TOKENIZATION_KEY
– MagicPay “Tokenization Key” for Collect.js (public).
– MAGICPAY_MODE
– “test” or “live” (used to switch endpoints/keys and safe logging).

These values must never be hardcoded in frontend code. MAGICPAY_TOKENIZATION_KEY is injected into HTML/server templates only from server config.

────────────────────────────────────
2. HIGH-LEVEL FLOW
────────────────────────────────────
	1.	Client goes through booking flow (service selection, time, client details) on previous steps.
	2.	On the “Payment” step:
– Show read-only summary of booking details (service, date, amount, taxes).
– Show inline Collect.js card fields (ccnumber, ccexp, cvv) styled to match site.
	3.	When user clicks “Pay Now”:
– Collect.js tokenizes card details and returns payment_token to our JS callback.
– Our JS sends payment_token + booking data to backend /api/magicpay/charge.
	4.	Backend calls MagicPay Payment API (type=sale) with payment_token.
	5.	On success:
– Charge is approved.
– Customer is stored in MagicPay Customer Vault in the same call.
– Booking is marked as paid.
– Confirmation screen is shown.
	6.	On failure:
– User sees a clear error message.
– No booking is marked paid; card fields remain for correction.

────────────────────────────────────
3. FRONTEND: COLLECT.JS INLINE SETUP
────────────────────────────────────

3.1 Load Collect.js

– Include the Collect.js script tag in the  or just before closing  of the Payment page.

– Required attributes:
– src = https://secure.magicpaygateway.com/token/Collect.js
– data-tokenization-key = MAGICPAY_TOKENIZATION_KEY (public key from MagicPay).
– data-variant = “inline” (forces inline iframe fields instead of lightbox).

– Additional attributes will be used for:
– paymentSelector (button that triggers tokenization).
– explicit CSS customization.
– validation and lifecycle callbacks (via JS configure).

No other payment library (Stripe.js etc.) should be loaded on this page.

3.2 DOM Structure

On the Payment page:

– One primary form element that wraps:
– Read-only booking summary (service name, package, price, date, time).
– Non-sensitive client details that can be edited or confirmed (if needed).
– Inline card fields container:
– A block element for each of:
– id=“ccnumber”
– id=“ccexp”
– id=“cvv”
– These are empty divs; Collect.js replaces them with secure iframes.
– Hidden fields to store:
– payment_token (added by our JS).
– any internal booking IDs (booking_id, client_id).
– A “Pay Now” button that will:
– Trigger Collect.js tokenization instead of normal form submission.

We are using card payments only; no ACH fields are required for now.

3.3 CollectJS.configure (expert inline mode)

We use explicit JS configuration rather than relying purely on data- attributes.

On DOM ready:

– Call CollectJS.configure with:
– variant: “inline”
– paymentSelector: “#payNowButton” (or another selector for the pay button).
– paymentType: “cc” (cards only for now).
– callback: function(response) { … }
– validationCallback: function(field, valid, message) { … }
– timeoutDuration: e.g. 10000 (ms).
– timeoutCallback: function() { … }
– fieldsAvailableCallback: function() { … }

Required behaviors:

– In callback(response):
– Expect:
– response.token (string) → this is payment_token.
– response.card object:
– number (masked, e.g. 411111******1111)
– type (e.g. “visa”)
– exp (e.g. 1028)
– bin, hash, etc.
– response.check and response.wallet will be unused for now.
– On success:
– Insert response.token into a hidden form field named “payment_token”.
– Option A (preferred): send data via fetch/XHR to /api/magicpay/charge without full page reload, then show success/failure messages.
– Option B: submit the form normally to /api/magicpay/charge.
– On error (if Collect.js rejects or error is indicated):
– Show a general “Payment failed. Please check your card details.” message.
– Do not submit to backend.

– In validationCallback(field, valid, message):
– field will be “ccnumber”, “ccexp” or “cvv”.
– valid is boolean.
– message is explanation (e.g. “Invalid card number.”).
– For each Collect.js field:
– Maintain state (valid/invalid) in JS.
– Add/remove an error message below/near that field container.
– Add/remove error CSS classes on wrapper divs (not on the iframe itself).
– Prevent tokenization if any field is invalid (disable Pay Now button until all fields are valid).

– In fieldsAvailableCallback():
– Called when inline iframes are loaded.
– Remove any “Loading payment fields…” placeholders.
– Enable Pay Now button here to avoid clicking before fields exist.

– In timeoutCallback():
– Called if tokenization request exceeds timeoutDuration.
– Show message: “Payment service timed out. Please check your internet connection and try again.”
– Keep Pay Now button enabled for retry.

3.4 Tokenization and submission rules

– Pay Now button click should:
– Prevent default form submit behavior.
– Check local JS state for field validity.
– If valid:
– Call CollectJS.startPaymentRequest(event) to initiate tokenization.
– If invalid:
– Focus first invalid field and show error messages.

– Collect.js will:
– Handle collecting card values from iframes.
– Trigger our callback with payment_token if successful.
– Trigger validationCallback as user types.

– Only after we have a payment_token do we hit our backend /api/magicpay/charge.

3.5 Explicit CSS control

We do not rely on automatic “style sniffer”. Instead we:

– Disable style sniffer (if applicable) by not using data-style-sniffer or setting it to false.
– Use CollectJS.configure or data- attributes to pass JSON for CSS states:

Required CSS states:
	1.	customCss (base state)
– Fonts, colors, border style, padding.
– Example (conceptual):
– font-family: brand body font.
– font-size: 16px.
– color: brand text color.
– background-color: transparent or page background.
– border: 1px solid brand border color.
– border-radius: 6–8px.
– padding: 10–12px.
	2.	validCss
– Optional subtle success outline:
– border-color: soft green or brand accent.
– box-shadow: minimal.
	3.	invalidCss
– Distinct error state:
– border-color: red.
– box-shadow: minimal or none.
– color: regular text color (avoid hard red text inside iframe; show error text outside iframe instead).
	4.	placeholderCss
– Placeholder grey, slightly lighter than normal text.
	5.	focusCss
– On focus:
– border-color: primary brand color.
– outline: none.
– box-shadow: small glow matching brand.

Implementation:

– Use CollectJS.configure with properties like:
– customCss
– validCss
– invalidCss
– placeholderCss
– focusCss

These should be defined as JSON objects per Collect.js documentation. Keep them minimal and in-line with existing site design.

────────────────────────────────────
4. BACKEND: /api/magicpay/charge
────────────────────────────────────

4.1 Endpoint contract

Path: /api/magicpay/charge
Method: POST
Content-Type: application/json from frontend; we will translate to form-encoded for MagicPay.

Expected input from frontend:

– payment_token (required; string from Collect.js).
– amount (required; decimal string “x.xx”).
– currency (required; e.g. “USD”).
– booking_id (required; internal booking reference).
– client_id (optional; internal client reference).
– client details (optional if not already stored on server):
– first_name
– last_name
– email
– phone
– billing_address (street, city, state, zip, country).
– save_card (boolean; default true, to save in Customer Vault).

Validation:

– Reject if payment_token is missing or empty.
– Reject if amount or currency invalid.
– Reject if booking_id missing.

4.2 MagicPay Payment API call

Endpoint: https://secure.magicpaygateway.com/api/transact.php
Method: POST
Format: application/x-www-form-urlencoded

Transaction type: “sale”

Minimum fields to send:

– security_key: MAGICPAY_API_SECURITY_KEY
– type: “sale”
– amount: amount
– currency: currency (ex: “USD”)
– payment_token: payment_token (from Collect.js)
– orderid: booking_id
– order_description: short description (“Hydrafacial package”, etc.)
– first_name, last_name, address1, city, state, zip, country, email (if available)
– ipaddress: client IP from request (if possible)

Customer Vault (save card for future):

– To save the card while charging, include:
– customer_vault: “add_customer”
– If client has existing vault id:
– customer_vault_id: existing ID and set customer_vault=“update_customer” instead.
– Also pass customer fields (name, email, etc.) to tie vault entry to that customer.
– After approval, parse returned customer_vault_id from result (if provided) and save to our DB on client record.

4.3 Response handling

MagicPay responds with a URL-encoded string like:

response=1&responsetext=SUCCESS&transactionid=123456&authcode=ABC123&customer_vault_id=XYZ123…

Server must:

– Parse into key-value map.
– Key fields to check:
– response or response_code (1 / 100 = success; 2 / 200 = decline; 3 / 300 = error).
– responsetext.
– transactionid.
– authcode.
– customer_vault_id (if present when saving card).

If approved:

– Mark booking with:
– payment_status = “paid”
– magicpay_transaction_id = transactionid
– magicpay_auth_code = authcode
– magicpay_customer_vault_id = customer_vault_id (if any)
– Return JSON to frontend:
– { status: “succeeded”, booking_id, amount, currency }

If declined or error:

– Do not mark booking as paid.
– Log full MagicPay response for diagnostics (but never card data; MagicPay will not send it anyway).
– Return JSON to frontend:
– { status: “failed”, message: friendly message, code: response or response_code }

4.4 Idempotency

– Ensure that if frontend repeats the same request (due to network retry) we do not double-book:
– Use booking_id as a unique key:
– If booking is already marked as paid with a MagicPay transactionid, ignore subsequent attempts or handle them as refunds/manual review.
– Optionally store last request hash to detect duplicate submissions.

────────────────────────────────────
5. CUSTOMER VAULT STRATEGY
────────────────────────────────────

Goal: one-off charge now, but store card for future use.

– During sale:
– Include customer_vault and (if applicable) customer_vault_id in Payment API call.
– On first payment for a client with no vault id:
– Use customer_vault=“add_customer”.
– On success, read customer_vault_id from response.
– Save it to the client table as magicpay_customer_vault_id.
– On subsequent payments for that client:
– You can either:
– Run a new Collect.js tokenization and use payment_token again (most secure for consent).
– Or (future feature) charge the vault directly, depending on business rules and MagicPay’s vault charge method.

– DB changes:
– Add magicpay_customer_vault_id column on client table.
– Add magicpay_transaction_id, magicpay_auth_code and gateway metadata on payment/booking table.

────────────────────────────────────
6. FUTURE APPLE PAY / GOOGLE PAY EXTENSIONS
────────────────────────────────────

Do not implement on day one, but code should be structured so that:

– All payment methods still return a payment_token from Collect.js.
– The backend /api/magicpay/charge remains unchanged:
– It doesn’t care whether the token came from cards, Apple Pay, or Google Pay.
– When we add wallets:
– We will add additional DOM containers for wallet buttons.
– We will pass appropriate data-field-google-pay-* and data-field-apple-pay-* attributes or equivalent JS config:
– price, currency, country.
– shipping/billing requirement flags.
– button styles.
– The callback(response) handler remains the same; wallet.follow data appears under response.wallet, but payment flow stays identical.

Design today so that any payment method is just a “source of payment_token”.

────────────────────────────────────
7. USER FLOW DECISION (TOKENIZATION STEP)
────────────────────────────────────

Selected pattern:

– A single “Payment” step at the end of booking flow:
– Step 1–N (service selection, date/time, client info) are separate screens or earlier steps.
– Final step shows:
– Read-only summary of all booking data (service, date/time, total price with tax).
– “Edit details” link to go back if necessary.
– Inline Collect.js card fields.
– Pay Now button that triggers tokenization.

Reasoning:

– Minimizes friction: user reviews everything once, then pays.
– Keeps payment logic isolated to one page (easier to implement and debug).
– Aligns with Collect.js inline model (fields integrated cleanly into a final form).

Implementation notes:

– All non-payment fields on Payment step are either:
– Read-only, populated from previous steps, or
– Minor editable items that do not change price.
– If user goes back and changes service or price:
– Return them to Payment step with updated amount and summary.
– Tokenization happens only after final review.

────────────────────────────────────
8. SUMMARY FOR CODING AI
────────────────────────────────────

– Use Collect.js inline variant with explicit JS configuration and explicit CSS JSON.
– Use card-only configuration initially; no ACH or wallets.
– Implement a single Payment page with:
– Divs for ccnumber/ccexp/cvv.
– Structured validation via validationCallback.
– Tokenization triggered by Pay Now button.
– Backend provides /api/magicpay/charge:
– Accepts payment_token and booking data.
– Calls MagicPay Payment API (type=sale) with payment_token.
– Saves transaction details and customer_vault_id when available.
– Design everything so that Apple Pay / Google Pay can be added later without touching backend contract, only Collect.js configuration and DOM.