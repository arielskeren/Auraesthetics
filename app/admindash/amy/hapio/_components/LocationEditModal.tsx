'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import ErrorDisplay from './ErrorDisplay';

interface LocationEditModalProps {
  location?: any;
  onClose: () => void;
  onSave: () => void;
}

export default function LocationEditModal({ location, onClose, onSave }: LocationEditModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    timezone: 'UTC',
    enabled: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [success, setSuccess] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    // Don't update form if we're closing or loading - prevents clearing fields during save
    if (isClosing || loading) {
      return;
    }
    
    if (location) {
      console.log('[Location Edit Modal] Location prop updated:', location);
      setFormData({
        name: location.name || '',
        address: location.address || '',
        timezone: location.timezone || 'UTC',
        enabled: location.enabled !== false,
      });
    } else if (!success) {
      // Only reset form for new location if we're not showing success
      setFormData({
        name: '',
        address: '',
        timezone: 'UTC',
        enabled: true,
      });
    }
  }, [location, loading, success, isClosing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Preserve the current form data before starting the save
    const dataToSave = { ...formData };
    
    setLoading(true);
    setError(null);
    setSuccess(false);
    
    // Keep the form data visible - don't let useEffect clear it
    setIsClosing(false);

    try {
      const url = location
        ? `/api/admin/hapio/locations/${location.id}`
        : '/api/admin/hapio/locations';
      const method = location ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[Location Edit] API error:', errorData);
        throw new Error(errorData.error || 'Failed to save location');
      }

      // Verify the response contains the updated location
      const responseData = await response.json();
      console.log('[Location Edit] Save response:', responseData);
      
      // Update form data with the response to show the saved values
      if (responseData.location) {
        const savedLocation = responseData.location;
        console.log('[Location Edit] Updating form with saved location:', savedLocation);
        setFormData({
          name: savedLocation.name || '',
          address: savedLocation.address || '',
          timezone: savedLocation.timezone || 'UTC',
          enabled: savedLocation.enabled !== false,
        });
      }

      // Show success message
      setSuccess(true);
      
      // Wait a moment to show success message
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Refresh the list - this will update the parent's state
      await onSave();
      
      // Small delay to ensure state updates propagate before closing
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Mark as closing to prevent form reset
      setIsClosing(true);
      
      // Close the modal - this will set location to null, but we've already updated the form
      // and isClosing prevents the useEffect from clearing it
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
            {location ? 'Edit Location' : 'Create Location'}
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
              Location saved successfully!
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
            <label className="block text-sm font-medium text-charcoal mb-1">Address</label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Timezone</label>
            <input
              type="text"
              value={formData.timezone}
              onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
              placeholder="UTC"
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
            />
            <p className="text-xs text-warm-gray mt-1">e.g., UTC, America/New_York, Europe/London</p>
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
              {loading ? 'Saving...' : location ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

