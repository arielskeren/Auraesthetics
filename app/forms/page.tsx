import type { Metadata } from 'next';
import FormsClient from './FormsClient';

export const metadata: Metadata = {
  title: 'Client Forms — Aura Wellness Aesthetics',
  description: 'Complete intake forms and consent documents for your appointment at Aura Wellness Aesthetics.',
};

export default function Forms() {
  return <FormsClient />;
}

