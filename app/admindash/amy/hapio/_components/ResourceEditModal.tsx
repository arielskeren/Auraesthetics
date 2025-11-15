'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import ErrorDisplay from './ErrorDisplay';

interface ResourceEditModalProps {
  resource?: any;
  locations?: any[];
  onClose: () => void;
  onSave: () => void;
}

export default function ResourceEditModal({ resource, locations = [], onClose, onSave }: ResourceEditModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    location_id: '',
    max_simultaneous_bookings: 1,
    enabled: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    if (resource) {
      setFormData({
        name: resource.name || '',
        location_id: resource.location_id || '',
        max_simultaneous_bookings: resource.max_simultaneous_bookings || 1,
        enabled: resource.enabled !== false,
      });
    }
  }, [resource]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const url = resource
        ? `/api/admin/hapio/resources/${resource.id}`
        : '/api/admin/hapio/resources';
      const method = resource ? 'PATCH' : 'POST';

      // Build payload - always include location_id if provided
      const payload: any = {
        name: formData.name,
        max_simultaneous_bookings: formData.max_simultaneous_bookings,
        enabled: formData.enabled,
      };
      
      // Location is required - validate it's selected
      if (!formData.location_id || formData.location_id.trim() === '') {
        throw new Error('Please select a location');
      }
      
      // Always include location_id when it's provided
      payload.location_id = formData.location_id;

      console.log('[Employee Edit] Sending request:', { url, method, payload });

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      console.log('[Employee Edit] Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[Employee Edit] API error:', errorData);
        throw new Error(errorData.error || `Failed to save employee (${response.status})`);
      }

      const responseData = await response.json();
      console.log('[Employee Edit] Save successful:', responseData);

      // Refresh the list before closing
      await onSave();
      
      // Small delay to ensure state updates propagate
      await new Promise(resolve => setTimeout(resolve, 100));
      
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
            {resource ? 'Edit Employee' : 'Create Employee'}
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
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">
              Location <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.location_id}
              onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
            >
              <option value="">Select a location</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name || loc.id}
                </option>
              ))}
            </select>
            {locations.length === 0 && (
              <p className="text-xs text-warm-gray mt-1">No locations available. Please create a location first.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">
              Max Simultaneous Bookings
            </label>
            <input
              type="number"
              min="1"
              value={formData.max_simultaneous_bookings}
              onChange={(e) => setFormData({ ...formData, max_simultaneous_bookings: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
            />
            <p className="text-xs text-warm-gray mt-1">Maximum number of bookings that can occur simultaneously</p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              className="w-4 h-4 text-dark-sage border-sand rounded focus:ring-dark-sage"
            />
            <label htmlFor="enabled" className="text-sm text-charcoal">
              Enabled
            </label>
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
              {loading ? 'Saving...' : resource ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

