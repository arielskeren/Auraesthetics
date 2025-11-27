/**
 * Calendar link generation for email templates
 */

import { EMAIL_STYLES } from './styles';

export function generateCalendarLinks(
  serviceName: string,
  startDate: Date,
  endDate: Date,
  address: string = EMAIL_STYLES.defaultAddress
) {
  const formatDate = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const start = formatDate(startDate);
  const end = formatDate(endDate);
  const title = encodeURIComponent(serviceName);
  const location = encodeURIComponent(address);
  const description = encodeURIComponent(`Appointment for ${serviceName} at Aura Aesthetics`);

  // Google Calendar
  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${description}&location=${location}`;

  // Outlook Calendar
  const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${startDate.toISOString()}&enddt=${endDate.toISOString()}&location=${location}&body=${description}`;

  // iCal file (data URI)
  const icalContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Aura Aesthetics//Booking Confirmation//EN',
    'BEGIN:VEVENT',
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${serviceName}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${address}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const icalDataUri = `data:text/calendar;charset=utf8,${encodeURIComponent(icalContent)}`;

  return {
    google: googleUrl,
    outlook: outlookUrl,
    ical: icalDataUri,
    icalContent,
  };
}

