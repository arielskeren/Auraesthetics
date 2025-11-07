import { Metadata } from 'next';
import AdminDashboardClient from './AdminDashboardClient';

export const metadata: Metadata = {
  title: 'Admin Dashboard - Aura Wellness Aesthetics',
  description: 'Admin dashboard for managing bookings and operations',
};

export default function AdminDashboardPage() {
  return <AdminDashboardClient />;
}

