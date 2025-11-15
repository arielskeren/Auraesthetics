'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import ErrorDisplay from './ErrorDisplay';

interface ServiceEditModalProps {
  service?: any;
  onClose: () => void;
  onSave: () => void;
}

export default function ServiceEditModal({ service, onClose, onSave }: ServiceEditModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    duration_minutes: 60,
    buffer_before_minutes: 0,
    buffer_after_minutes: 0,
    enabled: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (service) {
      setFormData({
        name: service.name || '',
        duration_minutes: service.duration_minutes || 60,
        buffer_before_minutes: service.buffer_before_minutes || 0,
        buffer_after_minutes: service.buffer_after_minutes || 0,
        enabled: service.enabled !== false,
      });
    }
  }, [service]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const url = service
        ? `/api/admin/hapio/services/${service.id}`
        : '/api/admin/hapio/services';
      const method = service ? 'PATCH' : 'POST';

      console.log('[Service Edit] Sending request:', { url, method, formData });

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      console.log('[Service Edit] Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[Service Edit] API error:', errorData);
        throw new Error(errorData.error || `Failed to save service (${response.status})`);
      }

      const responseData = await response.json();
      console.log('[Service Edit] Save successful:', responseData);

      setSuccess(true);
      
      // Wait a moment to show success message
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Refresh the list before closing
      await onSave();
      
      // Small delay to ensure state updates
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
            {service ? 'Edit Service' : 'Create Service'}
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
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
              Service saved successfully!
            </div>
          )}

          {service?.id && (
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Service ID</label>
              <input
                type="text"
                value={service.id}
                readOnly
                className="w-full px-3 py-2 border border-sand rounded-lg text-sm bg-sand/20 font-mono text-xs cursor-not-allowed"
              />
            </div>
          )}

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
              Duration (minutes) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              required
              min="1"
              value={formData.duration_minutes}
              onChange={(e) => setFormData({ ...formData, duration_minutes: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">
                Buffer Before (minutes)
              </label>
              <input
                type="number"
                min="0"
                value={formData.buffer_before_minutes}
                onChange={(e) => setFormData({ ...formData, buffer_before_minutes: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">
                Buffer After (minutes)
              </label>
              <input
                type="number"
                min="0"
                value={formData.buffer_after_minutes}
                onChange={(e) => setFormData({ ...formData, buffer_after_minutes: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
              />
            </div>
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
              {loading ? 'Saving...' : service ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

