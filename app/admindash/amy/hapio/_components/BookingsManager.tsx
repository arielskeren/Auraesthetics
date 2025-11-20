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
    <div className="space-y-3 md:space-y-4">
      {/* Header with Refresh Button */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0">
        <div>
          <h2 className="text-lg md:text-xl font-semibold text-charcoal">Bookings</h2>
        </div>
        <button
          onClick={handleRefresh}
          className="px-3 md:px-4 py-2 bg-sand/30 text-charcoal rounded-lg hover:bg-sand/50 transition-colors flex items-center gap-2 text-xs md:text-sm min-h-[44px]"
          title="Refresh bookings"
        >
          <RefreshCw className="w-4 h-4" />
          <span className="hidden sm:inline">Refresh</span>
          <span className="sm:hidden">Refresh</span>
        </button>
      </div>

      {/* View Mode Tabs */}
      <div className="flex items-center gap-2 border-b border-sand overflow-x-auto">
        <button
          onClick={() => setViewMode('calendar')}
          className={`px-3 md:px-4 py-2 text-xs md:text-sm font-medium transition-colors border-b-2 whitespace-nowrap min-h-[44px] ${
            viewMode === 'calendar'
              ? 'border-dark-sage text-dark-sage'
              : 'border-transparent text-warm-gray hover:text-charcoal'
          }`}
        >
          Calendar View
        </button>
        <button
          onClick={() => setViewMode('cancelled-refunded')}
          className={`px-3 md:px-4 py-2 text-xs md:text-sm font-medium transition-colors border-b-2 whitespace-nowrap min-h-[44px] ${
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
