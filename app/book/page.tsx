import type { Metadata } from 'next';
import BookClient from './BookClient';

export const metadata: Metadata = {
  title: 'Book Online — Aura Wellness Aesthetics',
  description: 'Online booking opens soon in Fort Lauderdale. Join the list to be notified when appointments become available and receive launch-week perks.',
};

export default function Book() {
  return <BookClient />;
}
