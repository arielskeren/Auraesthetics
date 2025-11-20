'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import LoadingState from './LoadingState';
import ErrorDisplay from './ErrorDisplay';
import PaginationControls from './PaginationControls';
import LocationEditModal from './LocationEditModal';
import { useHapioData } from '../_contexts/HapioDataContext';

export default function LocationsManager() {
  const { locations: contextLocations } = useHapioData();
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [pagination, setPagination] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);

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

  const handleSave = async () => {
    // Force refresh - always reload to get fresh data
    // This will update the locations state, which will cause the modal to re-render with fresh data
    await loadLocations();
    
    // Note: We don't need to manually update selectedLocation here because:
    // 1. The modal's useEffect depends on the location prop
    // 2. When we reload, if the location is still selected, it will get fresh data from the updated locations array
    // 3. However, we should clear the selection after save so the modal closes properly
  };

  if (loading && locations.length === 0) {
    return <LoadingState message="Loading locations..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-charcoal">Locations</h2>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-dark-sage text-charcoal rounded-lg hover:bg-dark-sage/80 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Location
        </button>
      </div>

      {error && <ErrorDisplay error={error} />}

      <div className="bg-white border border-sand rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-sage-light/30 border-b border-sand">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Timezone</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand">
              {locations.map((location) => {
                return (
                  <tr key={location.id} className="hover:bg-sand/20">
                    <td className="px-4 py-3 text-sm font-medium text-charcoal">{location.name}</td>
                    <td className="px-4 py-3 text-sm text-warm-gray">{location.timezone || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        location.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {location.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(location)}
                        className="p-1.5 text-dark-sage hover:bg-sage-light rounded transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(location.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {pagination && (
          <div className="px-4 py-4 border-t border-sand">
            <PaginationControls meta={pagination} onPageChange={handlePageChange} />
          </div>
        )}
      </div>

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

