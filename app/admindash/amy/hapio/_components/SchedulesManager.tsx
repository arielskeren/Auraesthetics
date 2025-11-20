'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, AlertCircle, Code, X } from 'lucide-react';
import LoadingState from './LoadingState';
import ErrorDisplay from './ErrorDisplay';
import RecurringSchedulesEditor from './RecurringSchedulesEditor';
import ScheduleBlocksCalendar from './ScheduleBlocksCalendar';
import RecurringScheduleBlocksEditor from './RecurringScheduleBlocksEditor';
import { useHapioData } from '../_contexts/HapioDataContext';

type ScheduleTab = 'recurring' | 'blocks' | 'recurring-blocks';

export default function SchedulesManager() {
  const { resources, locations, loadResources, loadLocations, isLoadingResources, isLoadingLocations } = useHapioData();
  const [activeTab, setActiveTab] = useState<ScheduleTab>('recurring');
  const [resourceId, setResourceId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [showDeveloperInfo, setShowDeveloperInfo] = useState(false);

  // Don't call loadResources/loadLocations - they're auto-loaded by context
  // Just wait for the data to be available

  // Set first resource and location from context data
  useEffect(() => {
    if (Object.keys(resources).length > 0 && !resourceId) {
      const firstResourceId = Object.keys(resources)[0];
      setResourceId(firstResourceId);
    }
    if (locations.length > 0 && !locationId) {
      setLocationId(locations[0].id);
    }
    if ((Object.keys(resources).length > 0 || isLoadingResources === false) && 
        (locations.length > 0 || isLoadingLocations === false)) {
      setLoading(false);
    }
  }, [resources, locations, resourceId, locationId, isLoadingResources, isLoadingLocations]);

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
        <button
          onClick={() => setShowDeveloperInfo(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm border border-sand text-warm-gray rounded-lg hover:bg-sand/20 transition-colors"
        >
          <Code className="w-4 h-4" />
          Developer Info
        </button>
      </div>

      {/* Developer Info Modal */}
      {showDeveloperInfo && (
        <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
            <div className="px-6 py-4 border-b border-sand flex items-center justify-between">
              <h3 className="text-lg font-semibold text-charcoal">Developer Information</h3>
              <button
                onClick={() => setShowDeveloperInfo(false)}
                className="p-1 hover:bg-sand/30 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-warm-gray mb-1">Resource ID</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={resourceId || ''}
                    readOnly
                    className="flex-1 px-3 py-2 border border-sand rounded-lg text-sm bg-sand/20 font-mono text-xs"
                  />
                  <button
                    onClick={() => {
                      if (resourceId) {
                        navigator.clipboard.writeText(resourceId);
                      }
                    }}
                    className="px-3 py-2 text-sm border border-sand text-charcoal rounded-lg hover:bg-sand/20 transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>
              {locationId && (
                <div>
                  <label className="block text-sm font-medium text-warm-gray mb-1">Location ID</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={locationId}
                      readOnly
                      className="flex-1 px-3 py-2 border border-sand rounded-lg text-sm bg-sand/20 font-mono text-xs"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(locationId);
                      }}
                      className="px-3 py-2 text-sm border border-sand text-charcoal rounded-lg hover:bg-sand/20 transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
