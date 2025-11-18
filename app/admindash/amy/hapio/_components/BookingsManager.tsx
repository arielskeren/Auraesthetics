'use client';

import { useState } from 'react';
import BookingsCalendar from './BookingsCalendar';
import CancelledRefundedBookings from './CancelledRefundedBookings';

type ViewMode = 'calendar' | 'cancelled-refunded';

export default function BookingsManager() {
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');

  return (
    <div className="space-y-4">
      {/* View Mode Tabs */}
      <div className="flex items-center gap-2 border-b border-sand">
        <button
          onClick={() => setViewMode('calendar')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            viewMode === 'calendar'
              ? 'border-dark-sage text-dark-sage'
              : 'border-transparent text-warm-gray hover:text-charcoal'
          }`}
        >
          Calendar View
        </button>
        <button
          onClick={() => setViewMode('cancelled-refunded')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            viewMode === 'cancelled-refunded'
              ? 'border-dark-sage text-dark-sage'
              : 'border-transparent text-warm-gray hover:text-charcoal'
          }`}
        >
          Cancelled / Refunded
        </button>
      </div>

      {/* Content */}
      {viewMode === 'calendar' && <BookingsCalendar />}
      {viewMode === 'cancelled-refunded' && <CancelledRefundedBookings />}
    </div>
  );
}
