'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import ErrorDisplay from './ErrorDisplay';
import ServiceSelectionModal from './ServiceSelectionModal';
import { formatDateForHapioUTC } from '@/lib/hapioDateUtils';

interface ScheduleBlockEditModalProps {
  resourceId: string;
  locationId: string | null;
  selectedDate?: Date | null;
  selectedBlock?: any | null;
  onClose: () => void;
  onSave: () => void;
}

export default function ScheduleBlockEditModal({
  resourceId,
  locationId,
  selectedDate,
  selectedBlock,
  onClose,
  onSave,
}: ScheduleBlockEditModalProps) {
  const [formData, setFormData] = useState({
    date: '',
    startTime: '00:00',
    endTime: '23:59',
    blockType: 'closed' as 'closed' | 'open',
    serviceIds: [] as string[],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [showServiceModal, setShowServiceModal] = useState(false);

  useEffect(() => {
    if (selectedDate) {
      const dateStr = selectedDate.toISOString().split('T')[0];
      setFormData((prev) => ({ ...prev, date: dateStr }));
    } else if (selectedBlock) {
      const blockDate = new Date(selectedBlock.starts_at);
      const dateStr = blockDate.toISOString().split('T')[0];
      const startTime = blockDate.toTimeString().slice(0, 5);
      const endTime = new Date(selectedBlock.ends_at).toTimeString().slice(0, 5);
      
      // Determine block type based on is_available field
      // If is_available is false or undefined (defaults to true), it's a "closed" block
      // If is_available is true, it's an "open" block (makes time available)
      const isAvailable = selectedBlock.is_available !== false; // Default to true if not specified
      const isAllDay = startTime === '00:00' && endTime === '23:59';
      // If it's all day and not available, it's "closed"
      // If it's available (regardless of time), it's "open" (makes time available)
      const blockType = isAvailable ? 'open' : 'closed';
      
      // Extract service IDs from metadata if available
      const serviceIds = (selectedBlock.metadata?.service_ids as string[]) || [];

      setFormData({
        date: dateStr,
        startTime,
        endTime,
        blockType,
        serviceIds,
      });
    } else {
      // Default to today
      const today = new Date().toISOString().split('T')[0];
      setFormData((prev) => ({ ...prev, date: today }));
    }
  }, [selectedDate, selectedBlock]);

  // Use the shared utility function
  const formatDateForHapio = formatDateForHapioUTC;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!formData.date) {
        throw new Error('Date is required');
      }

      // Combine date and time
      const startDateTime = new Date(`${formData.date}T${formData.startTime}:00`);
      const endDateTime = new Date(`${formData.date}T${formData.endTime}:00`);

      // If end time is before start time, assume it's the next day
      if (endDateTime <= startDateTime) {
        endDateTime.setDate(endDateTime.getDate() + 1);
      }

      const startsAtFormatted = formatDateForHapio(startDateTime);
      const endsAtFormatted = formatDateForHapio(endDateTime);

      if (!locationId) {
        throw new Error('Location ID is required. Please ensure a location exists.');
      }

      const payload: any = {
        location_id: locationId,
        starts_at: startsAtFormatted,
        ends_at: endsAtFormatted,
        metadata: {},
      };

      // Convert blockType to is_available:
      // "closed" = block time (make unavailable) → is_available: false
      // "open" = make time available (override recurring schedule) → is_available: true
      payload.is_available = formData.blockType === 'open';

      // Add service IDs if block type is open (for service-specific availability)
      if (formData.blockType === 'open' && formData.serviceIds.length > 0) {
        payload.metadata.service_ids = formData.serviceIds;
      }

      const url = selectedBlock
        ? `/api/admin/hapio/resources/${resourceId}/schedule-blocks/${selectedBlock.id}`
        : `/api/admin/hapio/resources/${resourceId}/schedule-blocks`;
      const method = selectedBlock ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${selectedBlock ? 'update' : 'create'} schedule block`);
      }

      await onSave();
      onClose();
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedBlock) return;
    if (!confirm('Are you sure you want to delete this schedule block?')) return;

    try {
      setLoading(true);
      const response = await fetch(
        `/api/admin/hapio/resources/${resourceId}/schedule-blocks/${selectedBlock.id}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete schedule block');
      }

      await onSave();
      onClose();
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-white border-b border-sand px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-charcoal">
            {selectedBlock ? 'Edit Schedule Block' : 'Create Schedule Block'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-sand/30 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <ErrorDisplay error={error} />}

          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">
              Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">
              Block Type <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.blockType}
              onChange={(e) =>
                setFormData({ ...formData, blockType: e.target.value as 'closed' | 'open' })
              }
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
            >
              <option value="closed">Block time (make unavailable)</option>
              <option value="open">Make time available (override recurring schedule)</option>
            </select>
            <div className="mt-2 space-y-1">
              {formData.blockType === 'closed' ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                  <p className="font-medium text-red-800 mb-1">⚠️ Blocks this time</p>
                  <p className="text-red-700">
                    This will make the selected time unavailable for booking, even if it&apos;s normally available in your recurring schedule.
                  </p>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                  <p className="font-medium text-amber-800 mb-1">⚠️ Overrides recurring schedule</p>
                  <p className="text-amber-700">
                    This will make the selected time available for booking, even if it&apos;s not in your recurring schedule. 
                    <strong> Use this to open time on days that are normally closed.</strong>
                  </p>
                </div>
              )}
            </div>
          </div>

          {formData.blockType === 'open' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1">
                    Start Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1">
                    End Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">
                  Available Services
                </label>
                <button
                  type="button"
                  onClick={() => setShowServiceModal(true)}
                  className="w-full px-3 py-2 border border-sand text-charcoal rounded-lg hover:bg-sand/20 transition-colors text-left"
                >
                  {formData.serviceIds.length > 0
                    ? `${formData.serviceIds.length} service${formData.serviceIds.length !== 1 ? 's' : ''} selected`
                    : 'Select services (default: all)'}
                </button>
                <p className="text-xs text-warm-gray mt-1">
                  Select which services are available during these hours. Leave unselected for all services.
                </p>
              </div>
            </>
          )}


          <div className="flex items-center gap-3 pt-4 border-t border-sand">
            {selectedBlock && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-sand text-charcoal rounded-lg hover:bg-sand/20 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-dark-sage text-charcoal rounded-lg hover:bg-dark-sage/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? selectedBlock
                  ? 'Updating...'
                  : 'Creating...'
                : selectedBlock
                ? 'Update'
                : 'Create'}
            </button>
          </div>
        </form>
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
