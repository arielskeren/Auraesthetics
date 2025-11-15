'use client';

import { useState, useEffect } from 'react';
import { Calendar, Users, Settings, TrendingUp } from 'lucide-react';
import LoadingState from './LoadingState';
import ErrorDisplay from './ErrorDisplay';

type Tab = 'bookings' | 'resources' | 'schedules';

interface HapioOverviewProps {
  onNavigate?: (tab: Tab) => void;
}

export default function HapioOverview({ onNavigate }: HapioOverviewProps) {
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [stats, setStats] = useState({
    totalBookings: 0,
    upcomingBookings: 0,
    totalResources: 0,
    totalServices: 0,
  });

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const [projectRes, bookingsRes, resourcesRes, servicesRes] = await Promise.all([
          fetch('/api/admin/hapio/project'),
          fetch('/api/admin/hapio/bookings?from=' + new Date().toISOString().split('T')[0]),
          fetch('/api/admin/hapio/resources'),
          fetch('/api/admin/hapio/services'),
        ]);

        if (projectRes.ok) {
          const projectData = await projectRes.json();
          setProject(projectData.project);
        }

        if (bookingsRes.ok) {
          const bookingsData = await bookingsRes.json();
          setStats((prev) => ({
            ...prev,
            totalBookings: bookingsData.meta?.total || 0,
            upcomingBookings: bookingsData.data?.filter(
              (b: any) => new Date(b.startsAt) >= new Date()
            ).length || 0,
          }));
        }

        if (resourcesRes.ok) {
          const resourcesData = await resourcesRes.json();
          setStats((prev) => ({
            ...prev,
            totalResources: resourcesData.meta?.total || 0,
          }));
        }

        if (servicesRes.ok) {
          const servicesData = await servicesRes.json();
          setStats((prev) => ({
            ...prev,
            totalServices: servicesData.meta?.total || 0,
          }));
        }
      } catch (err: any) {
        setError(err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) {
    return <LoadingState message="Loading overview..." />;
  }

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  return (
    <div className="space-y-6">
      {/* Project Info */}
      {project && (
        <div className="bg-sage-light/30 rounded-lg p-6 border border-sage-light">
          <h2 className="text-xl font-semibold text-charcoal mb-2">Project Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-warm-gray">Project Name</p>
              <p className="font-medium text-charcoal">{project.name}</p>
            </div>
            {project.timezone && (
              <div>
                <p className="text-sm text-warm-gray">Timezone</p>
                <p className="font-medium text-charcoal">{project.timezone}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-sand rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-warm-gray mb-1">Total Bookings</p>
              <p className="text-2xl font-bold text-charcoal">{stats.totalBookings}</p>
            </div>
            <Calendar className="w-8 h-8 text-dark-sage" />
          </div>
        </div>

        <div className="bg-white border border-sand rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-warm-gray mb-1">Upcoming</p>
              <p className="text-2xl font-bold text-charcoal">{stats.upcomingBookings}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-dark-sage" />
          </div>
        </div>

        <div className="bg-white border border-sand rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-warm-gray mb-1">Resources</p>
              <p className="text-2xl font-bold text-charcoal">{stats.totalResources}</p>
            </div>
            <Users className="w-8 h-8 text-dark-sage" />
          </div>
        </div>

        <div className="bg-white border border-sand rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-warm-gray mb-1">Services</p>
              <p className="text-2xl font-bold text-charcoal">{stats.totalServices}</p>
            </div>
            <Settings className="w-8 h-8 text-dark-sage" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white border border-sand rounded-lg p-6">
        <h2 className="text-xl font-semibold text-charcoal mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => onNavigate?.('bookings')}
            className="px-4 py-2 bg-dark-sage text-charcoal rounded-lg hover:bg-dark-sage/80 transition-colors text-sm font-medium"
          >
            View All Bookings
          </button>
          <button
            onClick={() => onNavigate?.('resources')}
            className="px-4 py-2 bg-sage-light text-charcoal rounded-lg hover:bg-sage-light/80 transition-colors text-sm font-medium"
          >
            Manage Resources
          </button>
          <button
            onClick={() => onNavigate?.('schedules')}
            className="px-4 py-2 bg-sage-light text-charcoal rounded-lg hover:bg-sage-light/80 transition-colors text-sm font-medium"
          >
            Configure Schedules
          </button>
        </div>
      </div>
    </div>
  );
}

