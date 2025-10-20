import type { Metadata } from 'next';
import FAQClient from './FAQClient';

export const metadata: Metadata = {
  title: 'FAQ — Aura Wellness Aesthetics',
  description: 'Frequently asked questions about booking, services, policies, and what to expect at Aura Wellness Aesthetics in Fort Lauderdale, FL.',
};

export default function FAQ() {
  return <FAQClient />;
}
