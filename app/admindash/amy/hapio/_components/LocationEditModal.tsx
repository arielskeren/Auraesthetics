'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import ErrorDisplay from './ErrorDisplay';
import { EST_TIMEZONE } from '@/lib/timezone';

interface LocationEditModalProps {
  location?: any;
  onClose: () => void;
  onSave: (updatedLocation?: any) => void;
}

// Common timezone options for dropdown
const COMMON_TIMEZONES = [
  { value: 'America/New_York', label: 'America/New_York (EST/EDT)' },
  { value: 'America/Chicago', label: 'America/Chicago (CST/CDT)' },
  { value: 'America/Denver', label: 'America/Denver (MST/MDT)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST/PDT)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
];

export default function LocationEditModal({ location, onClose, onSave }: LocationEditModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    timezone: EST_TIMEZONE, // Default to EST for Florida business
    enabled: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [success, setSuccess] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [useCustomTimezone, setUseCustomTimezone] = useState(false);

  useEffect(() => {
    // Don't update form if we're closing or loading - prevents clearing fields during save
    if (isClosing || loading) {
      return;
    }
    
    if (location) {
      console.log('[Location Edit Modal] Location prop updated:', location);
      const locationTimezone = location.timezone || location.time_zone || EST_TIMEZONE;
      const isCommonTimezone = COMMON_TIMEZONES.some(tz => tz.value === locationTimezone);
      
      setFormData({
        name: location.name || '',
        timezone: locationTimezone,
        enabled: location.enabled !== false,
      });
      setUseCustomTimezone(!isCommonTimezone);
    } else if (!success) {
      // Only reset form for new location if we're not showing success
      setFormData({
        name: '',
        timezone: EST_TIMEZONE, // Default to EST for Florida
        enabled: true,
      });
      setUseCustomTimezone(false);
    }
  }, [location, loading, success, isClosing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate timezone format (must be IANA timezone or empty/null)
    const timezoneValue = formData.timezone.trim();
    if (timezoneValue && !timezoneValue.match(/^[A-Za-z_]+\/[A-Za-z_]+$/)) {
      // Check if it's a common abbreviation that needs conversion
      const abbreviationMap: Record<string, string> = {
        'EST': 'America/New_York',
        'EDT': 'America/New_York',
        'CST': 'America/Chicago',
        'CDT': 'America/Chicago',
        'MST': 'America/Denver',
        'MDT': 'America/Denver',
        'PST': 'America/Los_Angeles',
        'PDT': 'America/Los_Angeles',
      };
      
      const upperTimezone = timezoneValue.toUpperCase();
      if (abbreviationMap[upperTimezone]) {
        setError(new Error(`"${timezoneValue}" is not a valid IANA timezone. Did you mean "${abbreviationMap[upperTimezone]}"? Please use IANA format (e.g., America/New_York).`));
        return;
      } else {
        setError(new Error(`"${timezoneValue}" is not a valid IANA timezone format. Please use IANA format (e.g., America/New_York, UTC, Europe/London).`));
        return;
      }
    }
    
    // Normalize form data: convert empty strings to null for optional fields
    const dataToSave = {
      name: formData.name,
      timezone: timezoneValue === '' ? null : timezoneValue,
      enabled: formData.enabled,
    };
    
    console.log('[Location Edit Modal] Form submission:', {
      originalFormData: formData,
      normalizedData: dataToSave,
    });
    
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

      console.log('[Location Edit Modal] Sending request:', {
        url,
        method,
        payload: dataToSave,
      });

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
        // Handle both timezone (camelCase) and time_zone (snake_case) from API
        const savedTimezone = savedLocation.timezone || savedLocation.time_zone || EST_TIMEZONE;
        const isCommonTimezone = COMMON_TIMEZONES.some(tz => tz.value === savedTimezone);
        
        setFormData({
          name: savedLocation.name || '',
          timezone: savedTimezone,
          enabled: savedLocation.enabled !== false,
        });
        setUseCustomTimezone(!isCommonTimezone);
      }

      // Show success message
      setSuccess(true);
      
      // Wait a moment to show success message
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Pass the updated location to the parent so it can update its state
      const updatedLocation = responseData.location || location;
      await onSave(updatedLocation);
      
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

          {location?.id && (
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Location ID</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={location.id}
                  readOnly
                  onClick={() => {
                    navigator.clipboard.writeText(location.id);
                  }}
                  className="flex-1 px-3 py-2 border border-sand rounded-lg text-sm bg-sand/20 font-mono text-xs cursor-pointer hover:bg-sand/30 transition-colors"
                  title="Click to copy"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(location.id);
                  }}
                  className="px-3 py-2 text-sm border border-sand text-charcoal rounded-lg hover:bg-sand/20 transition-colors"
                  title="Copy Location ID"
                >
                  Copy
                </button>
              </div>
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
            <label className="block text-sm font-medium text-charcoal mb-1">Timezone</label>
            {!useCustomTimezone ? (
              <select
                value={formData.timezone}
                onChange={(e) => {
                  if (e.target.value === 'custom') {
                    setUseCustomTimezone(true);
                  } else {
                    setFormData({ ...formData, timezone: e.target.value });
                  }
                }}
                className="w-full px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
              >
                {COMMON_TIMEZONES.map(tz => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
                <option value="custom">Custom (enter IANA timezone)</option>
              </select>
            ) : (
              <div>
                <input
                  type="text"
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  placeholder="America/New_York"
                  className="w-full px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
                />
                <button
                  type="button"
                  onClick={() => {
                    setUseCustomTimezone(false);
                    setFormData({ ...formData, timezone: EST_TIMEZONE });
                  }}
                  className="mt-1 text-xs text-dark-sage hover:underline"
                >
                  Use common timezone instead
                </button>
              </div>
            )}
            <p className="text-xs text-warm-gray mt-1">
              Must use IANA timezone format (e.g., America/New_York). Abbreviations like "EST" are not supported.
            </p>
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

