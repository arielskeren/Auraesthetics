import type { Metadata } from 'next';
import AboutClient from './AboutClient';

export const metadata: Metadata = {
  title: 'About Amy — Aura Wellness Aesthetics',
  description: 'Meet Amy, Fort Lauderdale aesthetician with a calm, intuitive approach to skin health blending modern modalities with bohemian design.',
};

export default function About() {
  return <AboutClient />;
}
