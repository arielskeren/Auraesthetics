'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import ErrorDisplay from './ErrorDisplay';

interface ScheduleBlockEditModalProps {
  onClose: () => void;
  onSave: () => void;
}

export default function ScheduleBlockEditModal({ onClose, onSave }: ScheduleBlockEditModalProps) {
  const [formData, setFormData] = useState({
    schedule_for: 'employee', // 'employee' | 'location' | 'project'
    employee_id: '',
    location_id: '',
    starts_at: '',
    ends_at: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);

  useEffect(() => {
    loadEmployees();
    loadLocations();
  }, []);

  const loadEmployees = async () => {
    try {
      const response = await fetch('/api/admin/hapio/resources?per_page=100');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.data || []);
      }
    } catch (err) {
      // Silently fail
    }
  };

  const loadLocations = async () => {
    try {
      const response = await fetch('/api/admin/hapio/locations?per_page=100');
      if (response.ok) {
        const data = await response.json();
        setLocations(data.data || []);
      }
    } catch (err) {
      // Silently fail
    }
  };

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

      // Map schedule_for to parent_type and parent_id
      let parentType: 'project' | 'location' | 'resource';
      let parentId: string | undefined;

      if (formData.schedule_for === 'employee') {
        if (!formData.employee_id) {
          throw new Error('Please select an employee');
        }
        parentType = 'resource';
        parentId = formData.employee_id;
      } else if (formData.schedule_for === 'location') {
        if (!formData.location_id) {
          throw new Error('Please select a location');
        }
        parentType = 'location';
        parentId = formData.location_id;
      } else {
        parentType = 'project';
        parentId = undefined;
      }

      const requestBody = {
        parent_type: parentType,
        parent_id: parentId,
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
              Schedule For <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.schedule_for}
              onChange={(e) => setFormData({ ...formData, schedule_for: e.target.value as any, employee_id: '', location_id: '' })}
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
            >
              <option value="employee">Employee</option>
              <option value="location">Location</option>
              <option value="project">Entire Business</option>
            </select>
            <p className="text-xs text-warm-gray mt-1">Who or what this schedule applies to</p>
          </div>

          {formData.schedule_for === 'employee' && (
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">
                Select Employee <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.employee_id}
                onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                className="w-full px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
              >
                <option value="">Choose an employee...</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {formData.schedule_for === 'location' && (
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">
                Select Location <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.location_id}
                onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                className="w-full px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
              >
                <option value="">Choose a location...</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name || loc.id}
                  </option>
                ))}
              </select>
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

