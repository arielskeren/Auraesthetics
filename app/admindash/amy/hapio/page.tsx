import { Metadata } from 'next';
import HapioManagementClient from './HapioManagementClient';

export const metadata: Metadata = {
  title: 'Hapio Management - Admin Dashboard',
  description: 'Manage Hapio resources, schedules, bookings, and availability',
};

export default function HapioManagementPage() {
  return <HapioManagementClient />;
}

