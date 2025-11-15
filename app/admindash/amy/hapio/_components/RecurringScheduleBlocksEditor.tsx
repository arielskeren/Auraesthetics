'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2 } from 'lucide-react';
import ErrorDisplay from './ErrorDisplay';
import RecurringScheduleBlockEditModal from './RecurringScheduleBlockEditModal';

interface RecurringScheduleBlocksEditorProps {
  resourceId: string;
  locationId: string | null;
}

interface ExistingBlock {
  id: string;
  recurring_schedule_id: string;
  weekday?: string | number | null;
  start_time?: string | null;
  end_time?: string | null;
  parent_schedule?: {
    id: string;
    start_date: string | null;
    end_date: string | null;
  };
  created_at?: string;
  updated_at?: string;
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

export default function RecurringScheduleBlocksEditor({
  resourceId,
  locationId,
}: RecurringScheduleBlocksEditorProps) {
  const [existingBlocks, setExistingBlocks] = useState<ExistingBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    loadBlocksList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceId]);

  const loadBlocksList = async () => {
    try {
      setLoadingList(true);
      const response = await fetch(
        `/api/admin/hapio/resources/${resourceId}/recurring-schedule-blocks?list_all=true&per_page=100`
      );
      if (response.ok) {
        const data = await response.json();
        const blocksList = (data.data || []) as ExistingBlock[];
        
        // Sort by weekday (Sunday=0, Monday=1, etc.), then by start time
        blocksList.sort((a, b) => {
          // Convert weekday to number for sorting
          const getWeekdayNumber = (weekday: string | number | null | undefined): number => {
            if (weekday === null || weekday === undefined) return 7; // Put nulls at end
            if (typeof weekday === 'number') return weekday;
            // Convert string to number
            const dayMap: Record<string, number> = {
              'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
              'thursday': 4, 'friday': 5, 'saturday': 6
            };
            return dayMap[weekday.toLowerCase()] ?? 7;
          };
          
          const aWeekdayNum = getWeekdayNumber(a.weekday);
          const bWeekdayNum = getWeekdayNumber(b.weekday);
          
          if (aWeekdayNum !== bWeekdayNum) {
            return aWeekdayNum - bWeekdayNum;
          }
          
          // If same weekday, sort by start time
          const aStart = a.start_time || '00:00';
          const bStart = b.start_time || '00:00';
          return aStart.localeCompare(bStart);
        });
        
        setExistingBlocks(blocksList);
        console.log('[RecurringScheduleBlocksEditor] Loaded blocks list:', blocksList);
      } else if (response.status === 404) {
        setExistingBlocks([]);
      }
    } catch (err) {
      console.warn('[RecurringScheduleBlocksEditor] Error loading blocks list:', err);
      setExistingBlocks([]);
    } finally {
      setLoadingList(false);
    }
  };

  const handleAddNew = () => {
    setSelectedBlockId(null);
    setShowEditModal(true);
    setError(null);
  };

  const handleViewBlock = (blockId: string) => {
    setSelectedBlockId(blockId);
    setShowEditModal(true);
    setError(null);
  };

  const handleDeleteBlock = async (block: ExistingBlock) => {
    if (!confirm('Are you sure you want to delete this recurring exception? This action cannot be undone.')) {
      return;
    }

    // Get recurring_schedule_id from block or parent_schedule
    const recurringScheduleId = block.recurring_schedule_id || block.parent_schedule?.id;
    
    if (!recurringScheduleId) {
      setError(new Error('Cannot delete: missing recurring_schedule_id'));
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/hapio/resources/${resourceId}/recurring-schedule-blocks/${block.id}?recurring_schedule_id=${recurringScheduleId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete recurring schedule block');
      }

      loadBlocksList();
    } catch (err: any) {
      setError(err);
    }
  };

  const handleCloseModal = () => {
    setShowEditModal(false);
    setSelectedBlockId(null);
    setError(null);
  };

  const getWeekdayLabel = (weekday: string | number | null | undefined): string => {
    if (weekday === null || weekday === undefined) return '—';
    if (typeof weekday === 'string') {
      const day = DAYS.find((d) => d.label.toLowerCase() === weekday.toLowerCase());
      return day ? day.label : weekday;
    }
    // Handle numeric weekday (0-6)
    const day = DAYS.find((d) => d.value === weekday);
    return day ? day.label : String(weekday);
  };

  const formatTime = (time: string | null | undefined): string => {
    if (!time) return '—';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const isAllDay = (block: ExistingBlock): boolean => {
    if (!block.start_time || !block.end_time) return false;
    return block.start_time === '00:00:00' && block.end_time === '23:59:59';
  };

  return (
    <div className="space-y-6">

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-charcoal">Recurring Schedule Blocks</h3>
        <button
          onClick={handleAddNew}
          className="flex items-center gap-2 px-4 py-2 bg-dark-sage text-charcoal rounded-lg hover:bg-dark-sage/80 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add New Block
        </button>
      </div>

      {error && <ErrorDisplay error={error} />}

      {loadingList ? (
        <div className="text-center py-8 text-warm-gray">Loading recurring schedule blocks...</div>
      ) : existingBlocks.length === 0 ? (
        <div className="bg-white border border-sand rounded-lg p-8 text-center">
          <p className="text-warm-gray mb-4">No recurring schedule blocks found.</p>
          <button
            onClick={handleAddNew}
            className="px-4 py-2 bg-dark-sage text-charcoal rounded-lg hover:bg-dark-sage/80 transition-colors text-sm font-medium"
          >
            Create Your First Block
          </button>
        </div>
      ) : (
        <div className="bg-white border border-sand rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-sage-light/30 border-b border-sand">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Weekday</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Time Range</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Schedule Start</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Schedule End</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand">
                {existingBlocks.map((block) => (
                  <tr key={block.id} className="hover:bg-sand/20">
                    <td className="px-4 py-3 text-sm text-charcoal">
                      {getWeekdayLabel(block.weekday)}
                    </td>
                    <td className="px-4 py-3 text-sm text-charcoal">
                      {formatTime(block.start_time)} - {formatTime(block.end_time)}
                    </td>
                    <td className="px-4 py-3 text-sm text-warm-gray">
                      {isAllDay(block) ? (
                        <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                          All Day Closed
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                          Partial Hours
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-warm-gray">
                      {block.parent_schedule?.start_date || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-warm-gray">
                      {block.parent_schedule?.end_date || 'Indefinite'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewBlock(block.id)}
                          className="p-1.5 bg-dark-sage text-charcoal rounded-lg hover:bg-dark-sage/80 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteBlock(block)}
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
        <RecurringScheduleBlockEditModal
          resourceId={resourceId}
          locationId={locationId}
          blockId={selectedBlockId}
          onClose={handleCloseModal}
          onSave={() => {
            loadBlocksList();
            handleCloseModal();
          }}
        />
      )}
    </div>
  );
}
