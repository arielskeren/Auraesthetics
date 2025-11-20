'use client';

import { useState, useEffect } from 'react';
import { X, Calendar as CalendarIcon } from 'lucide-react';
import LoadingState from './LoadingState';
import ErrorDisplay from './ErrorDisplay';
import PaginationControls from './PaginationControls';

interface ResourceScheduleModalProps {
  resourceId: string;
  resourceName?: string;
  onClose: () => void;
}

export default function ResourceScheduleModal({
  resourceId,
  resourceName,
  onClose,
}: ResourceScheduleModalProps) {
  const [scheduleBlocks, setScheduleBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [pagination, setPagination] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [filters, setFilters] = useState({
    from: new Date().toISOString().split('T')[0],
    to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });

  // Format date for Hapio API: Y-m-d\TH:i:sP format
  const formatDateForHapio = (date: Date): string => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hour = String(date.getUTCHours()).padStart(2, '0');
    const minute = String(date.getUTCMinutes()).padStart(2, '0');
    const second = String(date.getUTCSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hour}:${minute}:${second}+00:00`;
  };

  const loadSchedule = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters.from) {
        // Convert to Hapio format
        const fromDate = new Date(filters.from + 'T00:00:00Z');
        params.append('from', formatDateForHapio(fromDate));
      }
      if (filters.to) {
        // Convert to Hapio format
        const toDate = new Date(filters.to + 'T23:59:59Z');
        params.append('to', formatDateForHapio(toDate));
      }
      // location_id will be handled by API route using HAPIO_DEFAULT_LOCATION_ID env var
      // Can be optionally passed here if needed for multi-location support
      params.append('page', String(page));
      params.append('per_page', String(perPage));

      const response = await fetch(`/api/admin/hapio/resources/${resourceId}/schedule?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load schedule');
      }

      const data = await response.json();
      setScheduleBlocks(data.data || []);
      setPagination(data.meta ? { ...data.meta, links: data.links } : null);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, resourceId]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  return (
    <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-white border-b border-sand px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-dark-sage" />
            <h2 className="text-xl font-bold text-charcoal">
              Schedule: {resourceName || resourceId.slice(0, 8)}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-sand/30 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Filters */}
          <div className="bg-sage-light/30 rounded-lg p-4 border border-sage-light">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">From Date</label>
                <input
                  type="date"
                  value={filters.from}
                  onChange={(e) => {
                    setFilters((prev) => ({ ...prev, from: e.target.value, page: 1 }));
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 border border-sand rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">To Date</label>
                <input
                  type="date"
                  value={filters.to}
                  onChange={(e) => {
                    setFilters((prev) => ({ ...prev, to: e.target.value, page: 1 }));
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 border border-sand rounded-lg text-sm"
                />
              </div>
            </div>
            <button
              onClick={loadSchedule}
              className="mt-4 px-4 py-2 bg-dark-sage text-charcoal rounded-lg hover:bg-dark-sage/80 transition-colors text-sm font-medium"
            >
              Apply Filters
            </button>
          </div>

          {error && <ErrorDisplay error={error} />}

          {loading && scheduleBlocks.length === 0 ? (
            <LoadingState message="Loading schedule..." />
          ) : (
            <>
              <div className="bg-white border border-sand rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-sage-light/30 border-b border-sand">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Start Time</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">End Time</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sand">
                      {scheduleBlocks.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-warm-gray">
                            No schedule blocks found for this date range
                          </td>
                        </tr>
                      ) : (
                        scheduleBlocks.map((block) => (
                          <tr key={block.id} className="hover:bg-sand/20">
                            <td className="px-4 py-3 text-sm text-charcoal">
                              {formatDate(block.starts_at)}
                            </td>
                            <td className="px-4 py-3 text-sm text-charcoal">
                              {formatDate(block.ends_at)}
                            </td>
                            <td className="px-4 py-3 text-sm text-warm-gray">
                              {block.type || '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {pagination && (
                  <div className="px-4 py-4 border-t border-sand">
                    <PaginationControls meta={pagination} onPageChange={handlePageChange} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

