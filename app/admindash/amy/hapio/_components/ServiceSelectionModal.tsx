'use client';

import { useState, useEffect } from 'react';
import { X, CheckSquare, Square } from 'lucide-react';
import ErrorDisplay from './ErrorDisplay';

interface ServiceSelectionModalProps {
  selectedServiceIds: string[];
  onClose: () => void;
  onSave: (serviceIds: string[]) => void;
}

export default function ServiceSelectionModal({
  selectedServiceIds,
  onClose,
  onSave,
}: ServiceSelectionModalProps) {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(selectedServiceIds)
  );

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/hapio/services?per_page=100');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load services');
      }

      const data = await response.json();
      setServices(data.data || []);

      // If no services were previously selected, select all by default
      if (selectedIds.size === 0 && data.data?.length > 0) {
        setSelectedIds(new Set(data.data.map((s: any) => s.id)));
      }
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (serviceId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(serviceId)) {
      newSelected.delete(serviceId);
    } else {
      newSelected.add(serviceId);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(services.map((s) => s.id)));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleSave = () => {
    onSave(Array.from(selectedIds));
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-white border-b border-sand px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-charcoal">Select Services</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-sand/30 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && <ErrorDisplay error={error} />}

          {loading ? (
            <div className="text-center py-8 text-warm-gray">Loading services...</div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-warm-gray">
                  {selectedIds.size} of {services.length} services selected
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSelectAll}
                    className="px-3 py-1.5 text-sm border border-sand text-charcoal rounded-lg hover:bg-sand/20 transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    onClick={handleDeselectAll}
                    className="px-3 py-1.5 text-sm border border-sand text-charcoal rounded-lg hover:bg-sand/20 transition-colors"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {services.map((service) => {
                  const isSelected = selectedIds.has(service.id);
                  return (
                    <label
                      key={service.id}
                      className="flex items-center gap-3 p-3 border border-sand rounded-lg hover:bg-sand/10 cursor-pointer transition-colors"
                    >
                      <div className="flex-shrink-0">
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-dark-sage" />
                        ) : (
                          <Square className="w-5 h-5 text-warm-gray" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-charcoal">{service.name}</div>
                        {service.duration_minutes && (
                          <div className="text-xs text-warm-gray">
                            Duration: {service.duration_minutes} minutes
                          </div>
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggle(service.id)}
                        className="sr-only"
                      />
                    </label>
                  );
                })}
              </div>

              {services.length === 0 && (
                <div className="text-center py-8 text-warm-gray">
                  No services available
                </div>
              )}
            </>
          )}

          <div className="flex items-center gap-3 pt-4 border-t border-sand">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-sand text-charcoal rounded-lg hover:bg-sand/20 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading || selectedIds.size === 0}
              className="flex-1 px-4 py-2 bg-dark-sage text-charcoal rounded-lg hover:bg-dark-sage/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save ({selectedIds.size} selected)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

