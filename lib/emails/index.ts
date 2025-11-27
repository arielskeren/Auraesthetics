/**
 * Email templates - centralized exports
 * 
 * Usage:
 *   import { generateBookingConfirmationEmail } from '@/lib/emails';
 *   import { generateBookingCancellationEmail } from '@/lib/emails/booking';
 *   import { generateCalendarLinks } from '@/lib/emails';
 */

// Booking emails
export * from './booking';

// Shared utilities (for advanced usage)
export { escapeHtml, formatDateForEmail, formatTimeForEmail } from './_shared/utils';
export { generateCalendarLinks } from './_shared/calendar';
export { EMAIL_STYLES, getEmailStyles } from './_shared/styles';

