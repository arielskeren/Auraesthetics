'use client';

import { useState } from 'react';
import { X, Star } from 'lucide-react';

interface UnstarServiceModalProps {
  services: any[];
  onClose: () => void;
  onUnstar: (serviceId: string) => Promise<void>;
}

export default function UnstarServiceModal({ services, onClose, onUnstar }: UnstarServiceModalProps) {
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [unstarring, setUnstarring] = useState(false);

  const handleUnstar = async () => {
    if (!selectedServiceId) return;

    try {
      setUnstarring(true);
      await onUnstar(selectedServiceId);
      onClose();
    } catch (error) {
      console.error('Error unstarring service:', error);
    } finally {
      setUnstarring(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
        <div className="px-6 py-4 border-b border-sand flex items-center justify-between">
          <h2 className="text-xl font-bold text-charcoal">Select Service to Unstar</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-sand/30 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-warm-gray mb-4">
            You can only have 6 starred services. Please select one to unstar:
          </p>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {services.map((service) => (
              <label
                key={service.id}
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedServiceId === service.id
                    ? 'border-dark-sage bg-sage-light/30'
                    : 'border-sand hover:bg-sand/10'
                }`}
              >
                <input
                  type="radio"
                  name="service"
                  value={service.id}
                  checked={selectedServiceId === service.id}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  className="w-4 h-4 text-dark-sage"
                />
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
                      {service.category || 'Uncategorized'}
                    </div>
                  </div>
                  <Star className="w-4 h-4 text-yellow-500 fill-current" />
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-sand flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-sand text-charcoal rounded-lg hover:bg-sand/20 transition-colors"
            disabled={unstarring}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUnstar}
            disabled={!selectedServiceId || unstarring}
            className="px-4 py-2 bg-dark-sage text-charcoal rounded-lg hover:bg-dark-sage/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {unstarring ? 'Unstarring...' : 'Unstar Selected'}
          </button>
        </div>
      </div>
    </div>
  );
}

