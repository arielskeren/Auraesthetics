'use client';

import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import ErrorDisplay from './ErrorDisplay';
import RecurringScheduleEditModal from './RecurringScheduleEditModal';

interface RecurringSchedulesEditorProps {
  resourceId: string;
  locationId: string | null;
}

interface DaySchedule {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  enabled: boolean;
  serviceIds: string[];
}

const DAYS = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
];

interface ExistingSchedule {
  id: string;
  start_date: string | null;
  end_date: string | null;
  interval: number | null;
  location: { id: string; name: string | null } | null;
  created_at: string;
  updated_at: string;
}

export default function RecurringSchedulesEditor({
  resourceId,
  locationId,
}: RecurringSchedulesEditorProps) {
  const [existingSchedules, setExistingSchedules] = useState<ExistingSchedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    loadSchedulesList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceId]);

  const loadSchedulesList = async () => {
    try {
      setLoadingList(true);
      const response = await fetch(
        `/api/admin/hapio/resources/${resourceId}/recurring-schedules?per_page=100`
      );
      if (response.ok) {
        const data = await response.json();
        const schedulesList = (data.data || []) as ExistingSchedule[];
        
        // Sort by start_date (most recent first, then by created_at)
        schedulesList.sort((a, b) => {
          if (a.start_date && b.start_date) {
            return b.start_date.localeCompare(a.start_date);
          }
          if (a.start_date) return -1;
          if (b.start_date) return 1;
          return (b.created_at || '').localeCompare(a.created_at || '');
        });
        
        setExistingSchedules(schedulesList);
        console.log('[RecurringSchedulesEditor] Loaded schedules list:', schedulesList);
      } else if (response.status === 404) {
        setExistingSchedules([]);
      }
    } catch (err) {
      console.warn('[RecurringSchedulesEditor] Error loading schedules list:', err);
      setExistingSchedules([]);
    } finally {
      setLoadingList(false);
    }
  };


  const handleAddNew = () => {
    setSelectedScheduleId(null);
    setShowEditModal(true);
    setError(null);
  };

  const handleViewSchedule = (scheduleId: string) => {
    setSelectedScheduleId(scheduleId);
    setShowEditModal(true);
    setError(null);
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to delete this schedule? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/hapio/resources/${resourceId}/recurring-schedules/${scheduleId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete schedule');
      }

      loadSchedulesList();
    } catch (err: any) {
      setError(err);
    }
  };

  const handleCloseModal = () => {
    setShowEditModal(false);
    setSelectedScheduleId(null);
    setError(null);
  };

  return (
    <div className="space-y-6">

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-charcoal">Recurring Schedules</h3>
        <button
          onClick={handleAddNew}
          className="flex items-center gap-2 px-4 py-2 bg-dark-sage text-charcoal rounded-lg hover:bg-dark-sage/80 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add New Schedule
        </button>
      </div>

      {error && <ErrorDisplay error={error} />}

      {loadingList ? (
        <div className="text-center py-8 text-warm-gray">Loading schedules...</div>
      ) : existingSchedules.length === 0 ? (
        <div className="bg-white border border-sand rounded-lg p-8 text-center">
          <p className="text-warm-gray mb-4">No recurring schedules found.</p>
          <button
            onClick={handleAddNew}
            className="px-4 py-2 bg-dark-sage text-charcoal rounded-lg hover:bg-dark-sage/80 transition-colors text-sm font-medium"
          >
            Create Your First Schedule
          </button>
        </div>
      ) : (
        <div className="bg-white border border-sand rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-sage-light/30 border-b border-sand">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Start Date</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">End Date</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Location</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Created</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand">
                {existingSchedules.map((schedule) => (
                  <tr key={schedule.id} className="hover:bg-sand/20">
                    <td className="px-4 py-3 text-sm text-charcoal">
                      {schedule.start_date || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-warm-gray">
                      {schedule.end_date || 'Indefinite'}
                    </td>
                    <td className="px-4 py-3 text-sm text-warm-gray">
                      {schedule.location?.name || schedule.location?.id || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-warm-gray">
                      {schedule.created_at ? new Date(schedule.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewSchedule(schedule.id)}
                          className="px-3 py-1.5 bg-dark-sage text-charcoal rounded-lg hover:bg-dark-sage/80 transition-colors text-sm font-medium"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleDeleteSchedule(schedule.id)}
                          className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit/Create Modal */}
      {showEditModal && (
        <RecurringScheduleEditModal
          resourceId={resourceId}
          locationId={locationId}
          scheduleId={selectedScheduleId}
          onClose={handleCloseModal}
          onSave={() => {
            loadSchedulesList();
            handleCloseModal();
          }}
        />
      )}
    </div>
  );
}
