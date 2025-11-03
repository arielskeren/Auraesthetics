import type { Metadata } from 'next';
import LandingClient from './LandingClient';

export const metadata: Metadata = {
  title: 'Aura Wellness Aesthetics — Welcome',
  description: 'Welcome to Aura Wellness Aesthetics. Join our waitlist for exclusive offers.',
};

export default function Landing() {
  return <LandingClient />;
}

