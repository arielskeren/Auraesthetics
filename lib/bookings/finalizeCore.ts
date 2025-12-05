/**
 * @deprecated Stripe finalization has been replaced with MagicPay
 * 
 * This file is a stub to prevent import errors. The original implementation
 * has been moved to scripts/archive/stripe/lib/bookings/finalizeCore.ts
 * 
 * For MagicPay payments, finalization happens in /api/magicpay/charge which:
 * - Processes payment via MagicPay
 * - Confirms booking in Hapio
 * - Creates/updates customer record with vault ID
 * - Sends confirmation email
 * - Syncs to Outlook calendar
 * 
 * All in one atomic transaction.
 */

export type FinalizeResult = {
  bookingId: string;
  ensuredBookingRowId: string | null;
  customerId: string | null;
  paymentId: string | null;
};

/**
 * @deprecated Use /api/magicpay/charge instead
 */
export async function finalizeBookingTransactional(_args: {
  paymentIntentId: string;
  hapioBookingId: string;
  debug?: boolean;
}): Promise<FinalizeResult & { debug?: any }> {
  throw new Error(
    'Stripe finalization is deprecated. ' +
    'MagicPay payments are finalized automatically in /api/magicpay/charge. ' +
    'The original implementation is archived at scripts/archive/stripe/lib/bookings/finalizeCore.ts'
  );
}
