import type { Metadata } from 'next';
import HomeClient from './HomeClient';

export const metadata: Metadata = {
  title: 'Aura Wellness Aesthetics — Amy | Fort Lauderdale Skincare Studio',
  description: 'Skin rituals, done gently. Customized facials, HydraFacials, brow lamination, lymphatic drainage, and advanced treatments in Fort Lauderdale, FL. Servicing all of South Florida.',
};

export default function Home() {
  return <HomeClient />;
}
