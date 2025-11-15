'use client';

import { useState, useEffect } from 'react';
import { X, GripVertical } from 'lucide-react';
import LoadingState from './LoadingState';
import ErrorDisplay from './ErrorDisplay';

interface ServiceReorderModalProps {
  services: any[];
  onClose: () => void;
  onSave: () => void;
}

export default function ServiceReorderModal({ services, onClose, onSave }: ServiceReorderModalProps) {
  const [orderedServices, setOrderedServices] = useState<any[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    // Sort services by display_order and create a copy for reordering
    const sorted = [...services].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    setOrderedServices(sorted);
  }, [services]);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null) return;

    const newServices = [...orderedServices];
    const draggedService = newServices[draggedIndex];
    newServices.splice(draggedIndex, 1);
    newServices.splice(index, 0, draggedService);
    setOrderedServices(newServices);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);

      // Update display_order for each service based on new order
      const updates = orderedServices.map((service, index) => ({
        id: service.id,
        display_order: index + 1,
      }));

      const response = await fetch('/api/admin/services/reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ services: updates }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reorder services');
      }

      onSave();
      onClose();
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-xl flex flex-col">
        <div className="sticky top-0 bg-white border-b border-sand px-6 py-4 flex items-center justify-between z-10 flex-shrink-0">
          <h2 className="text-xl font-bold text-charcoal">Reorder Services</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-sand/30 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && <ErrorDisplay error={error} />}

          <p className="text-sm text-warm-gray mb-4">
            Drag and drop services to reorder them. This order will be used on the Book and Services pages.
          </p>

          <div className="space-y-2">
            {orderedServices.map((service, index) => (
              <div
                key={service.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 p-3 border border-sand rounded-lg cursor-move hover:bg-sand/10 transition-colors ${
                  draggedIndex === index ? 'opacity-50' : ''
                }`}
              >
                <GripVertical className="w-5 h-5 text-warm-gray flex-shrink-0" />
                <div className="flex-1 flex items-center gap-3">
                  {service.image_url ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={service.image_url}
                        alt={service.name || 'Service'}
                        className="w-12 h-12 object-cover rounded border border-sand"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    </>
                  ) : (
                    <div className="w-12 h-12 bg-sand/20 rounded border border-sand flex items-center justify-center text-xs text-warm-gray">
                      No image
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="font-medium text-charcoal">{service.name || '—'}</div>
                    <div className="text-sm text-warm-gray">
                      {service.category || 'Uncategorized'} • {service.duration_display || `${service.duration_minutes} min`}
                    </div>
                  </div>
                  <div className="text-sm font-mono text-warm-gray">
                    #{index + 1}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-sand px-6 py-4 flex items-center justify-end gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-sand text-charcoal rounded-lg hover:bg-sand/20 transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-dark-sage text-charcoal rounded-lg hover:bg-dark-sage/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save Order'}
          </button>
        </div>
      </div>
    </div>
  );
}

