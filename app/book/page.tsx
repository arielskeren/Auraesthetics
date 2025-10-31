import type { Metadata } from 'next';
import BookClient from './BookClient';

export const metadata: Metadata = {
  title: 'Book Your Treatment | Aura Wellness Aesthetics',
  description: 'Browse services and book your appointment online with Amy. Choose from facials, advanced treatments, brows & lashes, and waxing services.',
};

export default function Book() {
  return <BookClient />;
}
