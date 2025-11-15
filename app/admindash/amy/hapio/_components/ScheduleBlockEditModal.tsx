'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import ErrorDisplay from './ErrorDisplay';

interface ScheduleBlockEditModalProps {
  onClose: () => void;
  onSave: () => void;
}

export default function ScheduleBlockEditModal({ onClose, onSave }: ScheduleBlockEditModalProps) {
  const [formData, setFormData] = useState({
    parent_type: 'resource',
    parent_id: '',
    starts_at: '',
    ends_at: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Format dates for Hapio
      const startsAt = new Date(formData.starts_at);
      const endsAt = new Date(formData.ends_at);
      
      const startsAtFormatted = formatDateForHapio(startsAt);
      const endsAtFormatted = formatDateForHapio(endsAt);

      const payload: any = {
        starts_at: startsAtFormatted,
        ends_at: endsAtFormatted,
      };

      // Validate parent_id for non-project types
      if (formData.parent_type !== 'project' && !formData.parent_id) {
        throw new Error('Parent ID is required for location and resource types');
      }

      const requestBody = {
        parent_type: formData.parent_type,
        parent_id: formData.parent_type === 'project' ? undefined : formData.parent_id,
        ...payload,
      };

      const response = await fetch('/api/admin/hapio/schedule-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create schedule block');
      }

      await onSave();
      onClose();
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDateForHapio = (date: Date): string => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hour = String(date.getUTCHours()).padStart(2, '0');
    const minute = String(date.getUTCMinutes()).padStart(2, '0');
    const second = String(date.getUTCSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hour}:${minute}:${second}+00:00`;
  };

  return (
    <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-white border-b border-sand px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-charcoal">Create Schedule Block</h2>
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
              Parent Type <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.parent_type}
              onChange={(e) => setFormData({ ...formData, parent_type: e.target.value as any })}
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
            >
              <option value="project">Project</option>
              <option value="location">Location</option>
              <option value="resource">Resource</option>
            </select>
          </div>

          {formData.parent_type !== 'project' && (
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">
                Parent ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.parent_id}
                onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                placeholder="Enter parent ID (UUID)"
                className="w-full px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">
              Start Time <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              required
              value={formData.starts_at}
              onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">
              End Time <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              required
              value={formData.ends_at}
              onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
            />
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-sand">
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
              {loading ? 'Creating...' : 'Create Schedule Block'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

