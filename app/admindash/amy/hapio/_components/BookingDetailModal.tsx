'use client';

import { X } from 'lucide-react';

interface BookingDetailModalProps {
  booking: any;
  onClose: () => void;
}

export default function BookingDetailModal({ booking, onClose }: BookingDetailModalProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-white border-b border-sand px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-charcoal">Booking Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-sand/30 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-warm-gray mb-1">Booking ID</p>
              <p className="font-mono text-sm text-charcoal">{booking.id}</p>
            </div>
            <div>
              <p className="text-sm text-warm-gray mb-1">Status</p>
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  booking.isCanceled
                    ? 'bg-red-100 text-red-700'
                    : booking.isTemporary
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-green-100 text-green-700'
                }`}
              >
                {booking.isCanceled ? 'Canceled' : booking.isTemporary ? 'Temporary' : 'Confirmed'}
              </span>
            </div>
            <div>
              <p className="text-sm text-warm-gray mb-1">Start Time</p>
              <p className="text-sm text-charcoal">{formatDate(booking.startsAt)}</p>
            </div>
            <div>
              <p className="text-sm text-warm-gray mb-1">End Time</p>
              <p className="text-sm text-charcoal">{formatDate(booking.endsAt)}</p>
            </div>
            {booking.resourceId && (
              <div>
                <p className="text-sm text-warm-gray mb-1">Resource ID</p>
                <p className="font-mono text-sm text-charcoal">{booking.resourceId}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-warm-gray mb-1">Service ID</p>
              <p className="font-mono text-sm text-charcoal">{booking.serviceId}</p>
            </div>
            <div>
              <p className="text-sm text-warm-gray mb-1">Location ID</p>
              <p className="font-mono text-sm text-charcoal">{booking.locationId}</p>
            </div>
            {booking.createdAt && (
              <div>
                <p className="text-sm text-warm-gray mb-1">Created At</p>
                <p className="text-sm text-charcoal">{formatDate(booking.createdAt)}</p>
              </div>
            )}
          </div>

          {booking.metadata && Object.keys(booking.metadata).length > 0 && (
            <div>
              <p className="text-sm text-warm-gray mb-2">Metadata</p>
              <pre className="bg-sand/20 p-3 rounded text-xs overflow-x-auto">
                {JSON.stringify(booking.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

