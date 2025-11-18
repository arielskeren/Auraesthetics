'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import BookingsCalendar from './BookingsCalendar';
import CancelledRefundedBookings from './CancelledRefundedBookings';

type ViewMode = 'calendar' | 'cancelled-refunded';

export default function BookingsManager() {
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="space-y-4">
      {/* Header with Refresh Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-charcoal">Bookings</h2>
        </div>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-sand/30 text-charcoal rounded-lg hover:bg-sand/50 transition-colors flex items-center gap-2"
          title="Refresh bookings"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

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
      {viewMode === 'calendar' && <BookingsCalendar key={refreshKey} />}
      {viewMode === 'cancelled-refunded' && <CancelledRefundedBookings key={refreshKey} />}
    </div>
  );
}
