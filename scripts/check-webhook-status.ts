import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
    ? `https://${(process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || '').replace(/^https?:\\/\\//, '')}`
    : 'http://localhost:5555';

const hapioWebhookUrl = `${siteUrl.replace(/\\/$/, '')}/api/webhooks/hapio`;
const stripeWebhookUrl = `${siteUrl.replace(/\\/$/, '')}/api/webhooks/stripe`;

const hapioToken = process.env.HAPIO_API_TOKEN;
const hapioSecret = process.env.HAPIO_SECRET;
const stripeSecret = process.env.STRIPE_SECRET_KEY;

function printDivider(label: string) {
  console.log(`\n=== ${label} ===\n`);
}

async function main() {
  printDivider('Webhook Configuration Checklist');

  console.log(`Hapio webhook URL:   ${hapioWebhookUrl}`);
  console.log(`Stripe webhook URL:  ${stripeWebhookUrl}`);

  printDivider('Environment Variables');
  console.log(`HAPIO_API_TOKEN set: ${hapioToken ? '✅' : '❌'}`);
  console.log(`HAPIO_SECRET set:    ${hapioSecret ? '✅' : '❌'} (used to verify X-Hapio-Signature)`);
  console.log(`STRIPE_SECRET_KEY:   ${stripeSecret ? '✅' : '❌'}`);

  if (!hapioToken || !hapioSecret) {
    console.log(
      '\n⚠️  Hapio credentials are missing. Generate a token in the Hapio console and copy the webhook signing secret.'
    );
  }

  if (!stripeSecret) {
    console.log('\n⚠️  Stripe secret key is missing. Set STRIPE_SECRET_KEY to run webhook verification locally.');
  }

  printDivider('Manual Steps');
  console.log('1. Hapio → Settings → Webhooks: add the URL above with your signing secret.');
  console.log('2. Stripe CLI or Dashboard: point the webhook to /api/webhooks/stripe and select payment intents events.');
  console.log('3. Deploy and trigger a test booking to confirm Hapio + Stripe webhooks succeed.');
  console.log('4. Monitor logs in Vercel or your terminal for `[Hapio webhook]` and `[Stripe webhook]` entries.');

  printDivider('Testing Tips');
  console.log('- Use `stripe listen` locally and forward to `/api/webhooks/stripe` when developing.');
  console.log('- Hapio sends a `ping` event. You can trigger it from their dashboard to confirm signature validation.');
  console.log('- The admin dashboard now shows Hapio booking IDs and statuses inside `metadata.hapio`.');
}

main().catch((error) => {
  console.error('Webhook status script failed:', error);
  process.exit(1);
});
