'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X } from 'lucide-react';
import LoadingState from './LoadingState';
import ErrorDisplay from './ErrorDisplay';
import PaginationControls from './PaginationControls';
import LocationEditModal from './LocationEditModal';
import { useHapioData } from '../_contexts/HapioDataContext';

export default function LocationsManager() {
  const { locations: contextLocations, clearCache } = useHapioData();
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [pagination, setPagination] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [viewingLocation, setViewingLocation] = useState<any>(null);

  useEffect(() => {
    loadLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const loadLocations = async () => {
    try {
      setLoading(true);
      setError(null);

      // For page 1, use context data if available (no API call needed)
      if (page === 1 && contextLocations.length > 0) {
        const paginatedLocations = contextLocations.slice(0, perPage);
        setLocations(paginatedLocations);
        // Create mock pagination for first page
        setPagination({
          current_page: 1,
          per_page: perPage,
          total: contextLocations.length,
          last_page: Math.ceil(contextLocations.length / perPage),
        });
        setLoading(false);
        return;
      }

      // For page > 1, fetch from API
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('per_page', String(perPage));

      console.log('[Locations Manager] Fetching locations...', { page, perPage });
      const response = await fetch(`/api/admin/hapio/locations?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load locations');
      }

      const data = await response.json();
      console.log('[Locations Manager] Loaded locations:', {
        count: data.data?.length || 0,
        firstLocation: data.data?.[0],
        allLocations: data.data,
      });
      
      // Force a new array reference to ensure React detects the change
      const newLocations = [...(data.data || [])];
      setLocations(newLocations);
      setPagination(data.meta ? { ...data.meta, links: data.links } : null);
      
      console.log('[Locations Manager] State updated with', newLocations.length, 'locations');
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleEdit = (location: any) => {
    setSelectedLocation(location);
    setShowEditModal(true);
  };

  const handleAdd = () => {
    setSelectedLocation(null);
    setShowEditModal(true);
  };

  const handleDelete = async (locationId: string) => {
    if (!confirm('Are you sure you want to delete this location? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/hapio/locations/${locationId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete location');
      }

      loadLocations();
    } catch (err: any) {
      setError(err);
    }
  };

  const handleSave = async (updatedLocation?: any) => {
    // Clear the context cache first to ensure fresh data
    if (clearCache) {
      clearCache();
    }
    
    // Force refresh - always reload to get fresh data
    // This will update the locations state, which will cause the modal to re-render with fresh data
    await loadLocations();
    
    // Update selectedLocation with the fresh data from the API if provided
    if (updatedLocation && selectedLocation) {
      setSelectedLocation(updatedLocation);
    }
    
    // Note: The modal's useEffect depends on the location prop, so when we update
    // selectedLocation or reload locations, the modal will get fresh data
  };

  if (loading && locations.length === 0) {
    return <LoadingState message="Loading locations..." />;
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0">
        <h2 className="text-lg md:text-xl font-semibold text-charcoal">Locations</h2>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-3 md:px-4 py-2 bg-dark-sage text-charcoal rounded-lg hover:bg-dark-sage/80 transition-colors text-xs md:text-sm font-medium min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          Add Location
        </button>
      </div>

      {error && <ErrorDisplay error={error} />}

      {/* Desktop Table */}
      <div className="hidden md:block bg-white border border-sand rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-sage-light/30 border-b border-sand">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Name</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand">
              {locations.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-warm-gray">No locations found</td>
                </tr>
              ) : (
                locations.map((location) => (
                  <tr 
                    key={location.id} 
                    onClick={() => setViewingLocation(location)}
                    className="hover:bg-sand/10 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-sm text-charcoal">{location.name}</div>
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

      {/* Mobile Cards */}
      <div className="md:hidden space-y-2">
        {locations.length === 0 ? (
          <div className="bg-white border border-sand rounded-lg p-8 text-center text-warm-gray text-sm">
            No locations found
          </div>
        ) : (
          locations.map((location) => (
            <div
              key={location.id}
              onClick={() => setViewingLocation(location)}
              className="bg-white border border-sand rounded-lg p-3 cursor-pointer transition-colors active:bg-sand/10"
            >
              <div className="font-semibold text-base text-charcoal">{location.name}</div>
            </div>
          ))
        )}
        {pagination && (
          <div className="pt-2">
            <PaginationControls meta={pagination} onPageChange={handlePageChange} />
          </div>
        )}
      </div>

      {/* Location Detail Modal */}
      {viewingLocation && (() => {
        const timezone = viewingLocation.timezone || viewingLocation.time_zone || null;
        const isEnabled = viewingLocation.enabled !== false && viewingLocation.enabled !== undefined;
        return (
        <div className="fixed inset-0 z-50 bg-charcoal/80 backdrop-blur-sm md:flex md:items-center md:justify-center md:p-4">
          <div className="bg-white h-full md:h-auto md:rounded-lg md:max-w-2xl md:w-full md:shadow-xl flex flex-col">
            <div className="p-4 md:p-6 flex-1 overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg md:text-xl font-semibold text-charcoal">Location Details</h3>
                <button
                  onClick={() => setViewingLocation(null)}
                  className="p-1 hover:bg-sand/30 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <X className="w-5 h-5 text-charcoal" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Name - Emphasized */}
                <div>
                  <h4 className="text-2xl md:text-3xl font-bold text-charcoal mb-2">{viewingLocation.name}</h4>
                </div>

                {/* Details */}
                <div className="bg-sage-light/20 rounded-lg p-4 space-y-3">
                  <div>
                    <label className="text-xs text-warm-gray uppercase tracking-wide">Location ID</label>
                    <div className="text-sm font-medium text-charcoal mt-1 font-mono">{viewingLocation.id}</div>
                  </div>
                  <div>
                    <label className="text-xs text-warm-gray uppercase tracking-wide">Timezone</label>
                    <div className="text-sm font-medium text-charcoal mt-1">{timezone || 'N/A'}</div>
                  </div>
                  <div>
                    <label className="text-xs text-warm-gray uppercase tracking-wide">Status</label>
                    <div className="mt-1">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          isEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {isEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="bg-white border border-sand rounded-lg p-4">
                  <h5 className="font-semibold text-charcoal mb-3">Actions</h5>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => {
                        setViewingLocation(null);
                        handleEdit(viewingLocation);
                      }}
                      className="w-full px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center justify-center gap-2 text-sm min-h-[44px]"
                    >
                      <Edit className="w-4 h-4" />
                      Edit Location
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm(`Are you sure you want to delete ${viewingLocation.name}? This action cannot be undone.`)) {
                          await handleDelete(viewingLocation.id);
                          setViewingLocation(null);
                          await loadLocations();
                        }
                      }}
                      className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2 text-sm min-h-[44px]"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Location
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 md:p-6 border-t border-sand md:border-t-0">
              <button
                onClick={() => setViewingLocation(null)}
                className="w-full px-4 py-3 md:py-2 bg-sand/30 text-charcoal rounded-lg hover:bg-sand/50 transition-colors font-medium text-sm min-h-[44px]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {showEditModal && (
        <LocationEditModal
          location={selectedLocation ? locations.find(loc => loc.id === selectedLocation.id) || selectedLocation : null}
          onClose={() => {
            // Don't clear selectedLocation immediately - let the modal handle cleanup
            setShowEditModal(false);
            // Clear selection after a small delay to allow modal to close gracefully
            setTimeout(() => {
              setSelectedLocation(null);
            }, 100);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

