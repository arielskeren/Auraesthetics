import { Metadata } from 'next';
import AdminDashboardClient from './AdminDashboardClient';
import AdminPasswordProtection from '@/app/_components/AdminPasswordProtection';

export const metadata: Metadata = {
  title: 'Admin Dashboard - Aura Wellness Aesthetics',
  description: 'Admin dashboard for managing bookings and operations',
};

export default function AdminDashboardPage() {
  return (
    <AdminPasswordProtection>
      <AdminDashboardClient />
    </AdminPasswordProtection>
  );
}

