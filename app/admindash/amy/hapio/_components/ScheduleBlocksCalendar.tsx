'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Trash2, Edit2, Plus } from 'lucide-react';
import ErrorDisplay from './ErrorDisplay';
import ServiceSelectionModal from './ServiceSelectionModal';
import { formatDateForHapioUTC } from '@/lib/hapioDateUtils';

interface ScheduleBlocksCalendarProps {
  resourceId: string;
  locationId: string | null;
}

interface ScheduleBlock {
  id: string;
  starts_at: string;
  ends_at: string;
  metadata?: Record<string, unknown> | null;
}

export default function ScheduleBlocksCalendar({
  resourceId,
  locationId,
}: ScheduleBlocksCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingBlock, setEditingBlock] = useState<ScheduleBlock | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [formData, setFormData] = useState({
    startTime: '00:00',
    endTime: '23:59',
    blockType: 'closed' as 'closed' | 'open',
    serviceIds: [] as string[],
  });

  useEffect(() => {
    loadBlocks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceId, currentDate]);

  useEffect(() => {
    if (selectedDate && !editingBlock && !isAddingNew) {
      // Reset form when date changes and not editing/adding
      setFormData({
        startTime: '00:00',
        endTime: '23:59',
        blockType: 'closed',
        serviceIds: [],
      });
    }
  }, [selectedDate, editingBlock, isAddingNew]);

  const loadBlocks = async () => {
    try {
      setLoading(true);
      setError(null);

      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const fromDate = new Date(year, month, 1);
      fromDate.setHours(0, 0, 0, 0);
      const toDate = new Date(year, month + 1, 0);
      toDate.setHours(23, 59, 59, 999);
      
      const from = formatDateForHapioUTC(fromDate);
      const to = formatDateForHapioUTC(toDate);

      const response = await fetch(
        `/api/admin/hapio/resources/${resourceId}/schedule-blocks?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&per_page=100`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load schedule blocks');
      }

      const data = await response.json();
      setBlocks(data.data || []);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const getBlocksForDate = (date: Date): ScheduleBlock[] => {
    const dateStr = date.toISOString().split('T')[0];
    return blocks.filter((block) => {
      const blockDate = new Date(block.starts_at).toISOString().split('T')[0];
      return blockDate === dateStr;
    });
  };

  const getBlockType = (block: ScheduleBlock): 'closed' | 'open' => {
    const start = new Date(block.starts_at);
    const end = new Date(block.ends_at);
    const isAllDay = start.getHours() === 0 && start.getMinutes() === 0 &&
                     end.getHours() === 23 && end.getMinutes() === 59;
    return isAllDay ? 'closed' : 'open';
  };

  const isPastDate = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < today;
  };

  const handleDateClick = (date: Date) => {
    if (isPastDate(date)) return;
    setSelectedDate(date);
  };

  const handleSave = async () => {
    if (!selectedDate || !locationId) {
      setError(new Error('Date and location are required'));
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const dateStr = selectedDate.toISOString().split('T')[0];
      const startDateTime = new Date(`${dateStr}T${formData.startTime}:00`);
      const endDateTime = new Date(`${dateStr}T${formData.endTime}:00`);

      if (endDateTime <= startDateTime) {
        endDateTime.setDate(endDateTime.getDate() + 1);
      }

      const startsAtFormatted = formatDateForHapioUTC(startDateTime);
      const endsAtFormatted = formatDateForHapioUTC(endDateTime);

      const payload: any = {
        location_id: locationId,
        starts_at: startsAtFormatted,
        ends_at: endsAtFormatted,
        metadata: {},
      };

      if (formData.blockType === 'open' && formData.serviceIds.length > 0) {
        payload.metadata.service_ids = formData.serviceIds;
      }

      const url = editingBlock
        ? `/api/admin/hapio/resources/${resourceId}/schedule-blocks/${editingBlock.id}`
        : `/api/admin/hapio/resources/${resourceId}/schedule-blocks`;
      const method = editingBlock ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${editingBlock ? 'update' : 'create'} schedule block`);
      }

      await loadBlocks();
      setEditingBlock(null);
      setIsAddingNew(false);
      setFormData({
        startTime: '00:00',
        endTime: '23:59',
        blockType: 'closed',
        serviceIds: [],
      });
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (blockId: string) => {
    if (!confirm('Are you sure you want to delete this schedule block?')) return;

    try {
      setLoading(true);
      const response = await fetch(
        `/api/admin/hapio/resources/${resourceId}/schedule-blocks/${blockId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete schedule block');
      }

      await loadBlocks();
      if (editingBlock?.id === blockId) {
        setEditingBlock(null);
        setIsAddingNew(false);
        setFormData({
          startTime: '00:00',
          endTime: '23:59',
          blockType: 'closed',
          serviceIds: [],
        });
      }
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (loading && blocks.length === 0) {
    return <div className="text-center py-8 text-warm-gray">Loading calendar...</div>;
  }

  const selectedDateBlocks = selectedDate ? getBlocksForDate(selectedDate) : [];

  return (
    <div className="space-y-6">
      {/* ID Display */}
      <div className="bg-sage-light/30 border border-sand rounded-lg p-4">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-warm-gray font-medium">Resource ID:</span>
            <span className="font-mono text-xs text-charcoal">{resourceId}</span>
          </div>
          {locationId && (
            <div className="flex items-center gap-2">
              <span className="text-warm-gray font-medium">Location ID:</span>
              <span className="font-mono text-xs text-charcoal">{locationId}</span>
            </div>
          )}
        </div>
      </div>

      {error && <ErrorDisplay error={error} />}

      <div className={`flex gap-6 transition-all duration-300 ${selectedDate ? 'items-start' : 'items-center justify-center'}`}>
        {/* Calendar - Smaller and Centered */}
        <div className={`bg-white border border-sand rounded-lg p-4 transition-all duration-300 ${selectedDate ? 'w-[420px] flex-shrink-0' : 'w-[420px]'}`}>
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={handlePreviousMonth}
              className="p-1.5 hover:bg-sand/20 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h3 className="text-base font-semibold text-charcoal">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h3>
            <button
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-sand/20 rounded-lg transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Calendar Grid - Smaller tiles */}
          <div className="grid grid-cols-7 gap-1">
            {/* Day Headers */}
            {dayNames.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-semibold text-charcoal py-1"
              >
                {day}
              </div>
            ))}

            {/* Calendar Days */}
            {getDaysInMonth().map((date, index) => {
              if (!date) {
                return <div key={`empty-${index}`} className="aspect-square" />;
              }

              const dateBlocks = getBlocksForDate(date);
              const isPast = isPastDate(date);
              const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();

              let blockType: 'closed' | 'open' | null = null;
              if (dateBlocks.length > 0) {
                blockType = getBlockType(dateBlocks[0]);
              }

              return (
                <button
                  key={date.toISOString()}
                  onClick={() => handleDateClick(date)}
                  disabled={isPast}
                  className={`aspect-square border rounded-lg text-xs transition-colors ${
                    isPast
                      ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                      : isSelected
                      ? 'ring-2 ring-dark-sage ring-offset-1'
                      : 'hover:bg-sand/20 cursor-pointer'
                  } ${
                    blockType === 'closed'
                      ? 'bg-red-100 border-red-300 text-red-900'
                      : blockType === 'open'
                      ? 'bg-yellow-100 border-yellow-300 text-yellow-900'
                      : 'bg-white border-sand text-charcoal'
                  }`}
                >
                  <div className="text-center font-medium">{date.getDate()}</div>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-3 flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-red-100 border border-red-300 rounded" />
              <span className="text-warm-gray">Closed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded" />
              <span className="text-warm-gray">Special hours</span>
            </div>
          </div>
        </div>

        {/* Right Side Panel - Shows blocks for selected day */}
        {selectedDate && (
          <div className="flex-1 bg-white border border-sand rounded-lg p-4 min-w-[380px] max-w-[450px] max-h-[600px] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-charcoal">
                {selectedDate.toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </h3>
              <button
                onClick={() => {
                  setSelectedDate(null);
                  setEditingBlock(null);
                  setIsAddingNew(false);
                }}
                className="p-1 hover:bg-sand/20 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {selectedDateBlocks.map((block) => {
                const start = new Date(block.starts_at);
                const end = new Date(block.ends_at);
                const startTime = start.toTimeString().slice(0, 5);
                const endTime = end.toTimeString().slice(0, 5);
                const isAllDay = startTime === '00:00' && endTime === '23:59';
                const serviceIds = (block.metadata?.service_ids as string[]) || [];
                const isEditing = editingBlock?.id === block.id;

                return (
                  <div
                    key={block.id}
                    className={`border rounded-lg p-2.5 ${
                      isAllDay
                        ? 'bg-red-50 border-red-200'
                        : 'bg-yellow-50 border-yellow-200'
                    }`}
                  >
                    {!isEditing ? (
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-charcoal">
                            {isAllDay ? 'Closed (all day)' : `${startTime} - ${endTime}`}
                          </div>
                          {serviceIds.length > 0 && (
                            <div className="text-xs text-warm-gray mt-0.5">
                              {serviceIds.length} service{serviceIds.length !== 1 ? 's' : ''} blocked
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            onClick={() => {
                              setEditingBlock(block);
                              setIsAddingNew(false);
                              setFormData({
                                startTime,
                                endTime,
                                blockType: isAllDay ? 'closed' : 'open',
                                serviceIds,
                              });
                            }}
                            className="p-1 hover:bg-white/50 rounded transition-colors"
                            disabled={loading}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(block.id)}
                            className="p-1 hover:bg-white/50 rounded transition-colors text-red-600"
                            disabled={loading}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2.5">

                        <div>
                          <label className="block text-xs font-medium text-charcoal mb-1">
                            Block Type <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={formData.blockType}
                            onChange={(e) =>
                              setFormData({ ...formData, blockType: e.target.value as 'closed' | 'open' })
                            }
                            className="w-full px-2 py-1.5 border border-sand rounded text-xs focus:outline-none focus:ring-1 focus:ring-dark-sage"
                          >
                            <option value="closed">Block entire day</option>
                            <option value="open">Block specific hours</option>
                          </select>
                        </div>

                        {formData.blockType === 'open' && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-medium text-charcoal mb-1">
                                Start <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="time"
                                value={formData.startTime}
                                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                className="w-full px-2 py-1.5 border border-sand rounded text-xs focus:outline-none focus:ring-1 focus:ring-dark-sage"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-charcoal mb-1">
                                End <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="time"
                                value={formData.endTime}
                                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                className="w-full px-2 py-1.5 border border-sand rounded text-xs focus:outline-none focus:ring-1 focus:ring-dark-sage"
                              />
                            </div>
                          </div>
                        )}

                        {formData.blockType === 'open' && (
                          <div>
                            <label className="block text-xs font-medium text-charcoal mb-1">
                              Block Services
                            </label>
                            <button
                              type="button"
                              onClick={() => setShowServiceModal(true)}
                              className="w-full px-2 py-1.5 border border-sand rounded text-xs text-left hover:bg-sand/20 transition-colors"
                            >
                              {formData.serviceIds.length > 0
                                ? `${formData.serviceIds.length} service${formData.serviceIds.length !== 1 ? 's' : ''} blocked`
                                : 'All services blocked (click to block specific services only)'}
                            </button>
                            <p className="text-xs text-warm-gray mt-0.5">
                              Leave unselected to block all services during these hours.
                            </p>
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={handleSave}
                            disabled={loading}
                            className="flex-1 px-3 py-1.5 bg-dark-sage text-charcoal rounded text-xs hover:bg-dark-sage/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                          >
                            {loading ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={() => {
                              setEditingBlock(null);
                              setIsAddingNew(false);
                            }}
                            className="px-3 py-1.5 text-xs border border-sand text-charcoal rounded hover:bg-sand/20 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add New Block Button */}
              {!isAddingNew && (
                <button
                  onClick={() => {
                    setIsAddingNew(true);
                    setEditingBlock(null);
                    setFormData({
                      startTime: '00:00',
                      endTime: '23:59',
                      blockType: 'closed',
                      serviceIds: [],
                    });
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-sand rounded-lg text-sm text-warm-gray hover:border-dark-sage hover:text-charcoal transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Block
                </button>
              )}

              {/* New Block Form */}
              {isAddingNew && (
                <div className="border-2 border-dashed border-dark-sage rounded-lg p-2.5 bg-sage-light/20">
                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-xs font-medium text-charcoal mb-1">
                        Block Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.blockType}
                        onChange={(e) =>
                          setFormData({ ...formData, blockType: e.target.value as 'closed' | 'open' })
                        }
                        className="w-full px-2 py-1.5 border border-sand rounded text-xs focus:outline-none focus:ring-1 focus:ring-dark-sage"
                      >
                        <option value="closed">Block entire day</option>
                        <option value="open">Block specific hours</option>
                      </select>
                    </div>

                    {formData.blockType === 'open' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-charcoal mb-1">
                            Start <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="time"
                            value={formData.startTime}
                            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                            className="w-full px-2 py-1.5 border border-sand rounded text-xs focus:outline-none focus:ring-1 focus:ring-dark-sage"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-charcoal mb-1">
                            End <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="time"
                            value={formData.endTime}
                            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                            className="w-full px-2 py-1.5 border border-sand rounded text-xs focus:outline-none focus:ring-1 focus:ring-dark-sage"
                          />
                        </div>
                      </div>
                    )}

                    {formData.blockType === 'open' && (
                      <div>
                        <label className="block text-xs font-medium text-charcoal mb-1">
                          Block Services
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowServiceModal(true)}
                          className="w-full px-2 py-1.5 border border-sand rounded text-xs text-left hover:bg-sand/20 transition-colors"
                        >
                          {formData.serviceIds.length > 0
                            ? `${formData.serviceIds.length} service${formData.serviceIds.length !== 1 ? 's' : ''} blocked`
                            : 'All services blocked (click to block specific services only)'}
                        </button>
                        <p className="text-xs text-warm-gray mt-0.5">
                          Leave unselected to block all services during these hours.
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={handleSave}
                        disabled={loading || !locationId}
                        className="flex-1 px-3 py-1.5 bg-dark-sage text-charcoal rounded text-xs hover:bg-dark-sage/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        {loading ? 'Creating...' : 'Create Block'}
                      </button>
                      <button
                        onClick={() => {
                          setIsAddingNew(false);
                          setFormData({
                            startTime: '00:00',
                            endTime: '23:59',
                            blockType: 'closed',
                            serviceIds: [],
                          });
                        }}
                        className="px-3 py-1.5 text-xs border border-sand text-charcoal rounded hover:bg-sand/20 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
          </div>
        )}
      </div>

      {/* Service Selection Modal */}
      {showServiceModal && (
        <ServiceSelectionModal
          selectedServiceIds={formData.serviceIds}
          onClose={() => setShowServiceModal(false)}
          onSave={(serviceIds) => {
            setFormData({ ...formData, serviceIds });
            setShowServiceModal(false);
          }}
        />
      )}
    </div>
  );
}
