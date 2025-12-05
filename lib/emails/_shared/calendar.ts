/**
 * Calendar link generation for email templates
 */

import { EMAIL_STYLES } from './styles';

export function generateCalendarLinks(
  serviceName: string,
  startDate: Date,
  endDate: Date,
  address: string = EMAIL_STYLES.defaultAddress,
  details?: {
    amountPaid?: number | null;
    transactionId?: string | null;
    bookingId?: string | null;
    clientName?: string | null;
  }
) {
  const formatDateForICal = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const start = formatDateForICal(startDate);
  const end = formatDateForICal(endDate);
  
  // Build rich description with receipt info and useful links
  const descriptionLines = [
    `${serviceName} at Aura Aesthetics`,
    '',
    '📍 LOCATION',
    address,
    'https://maps.google.com/?q=' + encodeURIComponent(address),
    '',
  ];

  if (details?.amountPaid) {
    descriptionLines.push('💳 PAYMENT DETAILS');
    descriptionLines.push(`Amount Paid: $${details.amountPaid.toFixed(2)}`);
    if (details.transactionId) {
      descriptionLines.push(`Transaction Ref: ${details.transactionId}`);
    }
    if (details.bookingId) {
      descriptionLines.push(`Booking ID: ${details.bookingId}`);
    }
    descriptionLines.push('');
  }

  descriptionLines.push(
    '✨ PREPARATION TIPS',
    '• Arrive 10 minutes early',
    '• Come with clean, makeup-free skin',
    '• Stay hydrated',
    '',
    '🔗 QUICK LINKS',
    'Manage Booking: https://www.theauraesthetics.com/manage-booking' + (details?.bookingId ? `?id=${details.bookingId}` : ''),
    'Our Services: https://www.theauraesthetics.com/services',
    'Contact Us: https://www.theauraesthetics.com/contact',
    '',
    '—',
    'Aura Aesthetics',
    'www.theauraesthetics.com'
  );

  const description = descriptionLines.join('\n');
  const descriptionEncoded = encodeURIComponent(description);
  const title = encodeURIComponent(`${serviceName} - Aura Aesthetics`);
  const location = encodeURIComponent(address);

  // Google Calendar
  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${descriptionEncoded}&location=${location}`;

  // Outlook Calendar
  const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${startDate.toISOString()}&enddt=${endDate.toISOString()}&location=${location}&body=${descriptionEncoded}`;

  // Generate UID for iCal
  const uid = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@theauraesthetics.com`;
  
  // Calculate alarm time (in seconds before event)
  const twoHoursBefore = 2 * 60 * 60; // 7200 seconds

  // iCal file content with proper formatting and alarms
  const icalDescription = description.replace(/\n/g, '\\n');
  
  const icalContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Aura Aesthetics//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatDateForICal(new Date())}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${serviceName} - Aura Aesthetics`,
    `DESCRIPTION:${icalDescription}`,
    `LOCATION:${address}`,
    'STATUS:CONFIRMED',
    // Alarm 1: 24 hours before
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:Reminder: ${serviceName} tomorrow at Aura Aesthetics`,
    'END:VALARM',
    // Alarm 2: 2 hours before
    'BEGIN:VALARM',
    `TRIGGER:-PT${twoHoursBefore}S`,
    'ACTION:DISPLAY',
    `DESCRIPTION:Reminder: ${serviceName} in 2 hours at Aura Aesthetics`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  // Use base64 encoding for better email client compatibility
  const icalBase64 = Buffer.from(icalContent).toString('base64');
  const icalDataUri = `data:text/calendar;base64,${icalBase64}`;

  return {
    google: googleUrl,
    outlook: outlookUrl,
    ical: icalDataUri,
    icalContent,
  };
}
