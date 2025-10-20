import type { Metadata } from 'next';
import ContactClient from './ContactClient';

export const metadata: Metadata = {
  title: 'Contact — Aura Wellness Aesthetics',
  description: 'Contact Aura Wellness Aesthetics in Fort Lauderdale, FL. Email hello@auraesthetics.com. Servicing all of South Florida by appointment.',
};

export default function Contact() {
  return <ContactClient />;
}
