import type { Metadata } from 'next';
import ServicesClient from './ServicesClient';

export const metadata: Metadata = {
  title: 'Services — Aura Wellness Aesthetics',
  description: 'HydraFacials, dermaplaning, brow lamination, lymphatic drainage, buccal massage, and more. Professional skincare in Fort Lauderdale, FL.',
};

export default function Services() {
  return <ServicesClient />;
}
