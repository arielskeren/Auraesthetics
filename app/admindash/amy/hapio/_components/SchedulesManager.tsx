'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, AlertCircle } from 'lucide-react';
import LoadingState from './LoadingState';
import ErrorDisplay from './ErrorDisplay';
import RecurringSchedulesEditor from './RecurringSchedulesEditor';
import ScheduleBlocksCalendar from './ScheduleBlocksCalendar';
import RecurringScheduleBlocksEditor from './RecurringScheduleBlocksEditor';

type ScheduleTab = 'recurring' | 'blocks' | 'recurring-blocks';

export default function SchedulesManager() {
  const [activeTab, setActiveTab] = useState<ScheduleTab>('recurring');
  const [resourceId, setResourceId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    loadFirstResourceAndLocation();
  }, []);

  const loadFirstResourceAndLocation = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load first resource
      const resourceResponse = await fetch('/api/admin/hapio/resources?per_page=1');
      if (!resourceResponse.ok) {
        throw new Error('Failed to load resources');
      }
      const resourceData = await resourceResponse.json();
      if (resourceData.data && resourceData.data.length > 0) {
        setResourceId(resourceData.data[0].id);
      }

      // Load first location
      const locationResponse = await fetch('/api/admin/hapio/locations?per_page=1');
      if (!locationResponse.ok) {
        throw new Error('Failed to load locations');
      }
      const locationData = await locationResponse.json();
      if (locationData.data && locationData.data.length > 0) {
        setLocationId(locationData.data[0].id);
      }
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading schedule configuration..." />;
  }

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  if (!resourceId) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <AlertCircle className="w-12 h-12 mx-auto mb-3 text-yellow-600" />
        <p className="text-warm-gray">No resources found. Please create a resource first.</p>
      </div>
    );
  }

  const tabs: { id: ScheduleTab; label: string; icon: React.ReactNode }[] = [
    { id: 'recurring', label: 'Recurring Schedules', icon: <Clock className="w-4 h-4" /> },
    { id: 'blocks', label: 'Schedule Blocks', icon: <Calendar className="w-4 h-4" /> },
    { id: 'recurring-blocks', label: 'Recurring Schedule Blocks', icon: <AlertCircle className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-charcoal">Schedules</h2>
        <div className="text-sm text-warm-gray">
          Resource: {resourceId ? resourceId.slice(0, 8) + '...' : 'Loading...'}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-sand">
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-dark-sage border-b-2 border-dark-sage bg-sage-light/30'
                  : 'text-warm-gray hover:text-charcoal hover:bg-sand/20'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'recurring' && resourceId && (
          <RecurringSchedulesEditor resourceId={resourceId} locationId={locationId} />
        )}
        {activeTab === 'blocks' && resourceId && (
          <ScheduleBlocksCalendar resourceId={resourceId} locationId={locationId} />
        )}
        {activeTab === 'recurring-blocks' && resourceId && (
          <RecurringScheduleBlocksEditor resourceId={resourceId} locationId={locationId} />
        )}
      </div>
    </div>
  );
}
