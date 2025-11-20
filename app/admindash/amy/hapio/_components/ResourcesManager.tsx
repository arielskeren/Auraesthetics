'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Calendar, Eye, X } from 'lucide-react';
import LoadingState from './LoadingState';
import ErrorDisplay from './ErrorDisplay';
import PaginationControls from './PaginationControls';
import ResourceEditModal from './ResourceEditModal';
import ResourceScheduleModal from './ResourceScheduleModal';
import IdDisplay from './IdDisplay';
import { useHapioData } from '../_contexts/HapioDataContext';

export default function ResourcesManager() {
  const { resources: contextResources, locations } = useHapioData();
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [pagination, setPagination] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedResource, setSelectedResource] = useState<any>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedResourceForSchedule, setSelectedResourceForSchedule] = useState<any>(null);
  const [viewingResource, setViewingResource] = useState<any>(null);

  useEffect(() => {
    // Don't call loadLocations - it's auto-loaded by context
    // Only load resources for pagination
    loadResources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const loadResources = async () => {
    try {
      setLoading(true);
      setError(null);

      // For page 1, use context data if available (no API call needed)
      if (page === 1 && Object.keys(contextResources).length > 0) {
        const resourcesArray = Object.values(contextResources);
        const paginatedResources = resourcesArray.slice(0, perPage);
        setResources(paginatedResources);
        // Create mock pagination for first page
        setPagination({
          current_page: 1,
          per_page: perPage,
          total: resourcesArray.length,
          last_page: Math.ceil(resourcesArray.length / perPage),
        });
        setLoading(false);
        return;
      }

      // For page > 1, fetch from API
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('per_page', String(perPage));

      const response = await fetch(`/api/admin/hapio/resources?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load resources');
      }

      const data = await response.json();
      console.log('[Resources Manager] Loaded resources:', {
        count: data.data?.length || 0,
        firstResource: data.data?.[0],
      });
      setResources(data.data || []);
      setPagination(data.meta ? { ...data.meta, links: data.links } : null);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleEdit = (resource: any) => {
    setSelectedResource(resource);
    setShowEditModal(true);
  };

  const handleAdd = () => {
    setSelectedResource(null);
    setShowEditModal(true);
  };

  const handleDelete = async (resourceId: string) => {
    if (!confirm('Are you sure you want to delete this resource? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/hapio/resources/${resourceId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete resource');
      }

      loadResources();
    } catch (err: any) {
      setError(err);
    }
  };

  const handleSave = async () => {
    // Force refresh by resetting to page 1 if we're not already there
    if (page !== 1) {
      setPage(1);
    }
    await loadResources();
  };

  const handleViewSchedule = (resource: any) => {
    setSelectedResourceForSchedule(resource);
    setShowScheduleModal(true);
  };

  if (loading && resources.length === 0) {
    return <LoadingState message="Loading employees..." />;
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0">
        <h2 className="text-lg md:text-xl font-semibold text-charcoal">Employees</h2>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-3 md:px-4 py-2 bg-dark-sage text-charcoal rounded-lg hover:bg-dark-sage/80 transition-colors text-xs md:text-sm font-medium min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          Add Employee
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
              {resources.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-warm-gray">No employees found</td>
                </tr>
              ) : (
                resources.map((resource) => (
                  <tr 
                    key={resource.id} 
                    onClick={() => setViewingResource(resource)}
                    className="hover:bg-sand/10 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-sm text-charcoal">{resource.name}</div>
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
        {resources.length === 0 ? (
          <div className="bg-white border border-sand rounded-lg p-8 text-center text-warm-gray text-sm">
            No employees found
          </div>
        ) : (
          resources.map((resource) => (
            <div
              key={resource.id}
              onClick={() => setViewingResource(resource)}
              className="bg-white border border-sand rounded-lg p-3 cursor-pointer transition-colors active:bg-sand/10"
            >
              <div className="font-semibold text-base text-charcoal">{resource.name}</div>
            </div>
          ))
        )}
        {pagination && (
          <div className="pt-2">
            <PaginationControls meta={pagination} onPageChange={handlePageChange} />
          </div>
        )}
      </div>

      {/* Resource Detail Modal */}
      {viewingResource && (
        <div className="fixed inset-0 z-50 bg-charcoal/80 backdrop-blur-sm md:flex md:items-center md:justify-center md:p-4">
          <div className="bg-white h-full md:h-auto md:rounded-lg md:max-w-2xl md:w-full md:shadow-xl flex flex-col">
            <div className="p-4 md:p-6 flex-1 overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg md:text-xl font-semibold text-charcoal">Employee Details</h3>
                <button
                  onClick={() => setViewingResource(null)}
                  className="p-1 hover:bg-sand/30 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <X className="w-5 h-5 text-charcoal" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Name - Emphasized */}
                <div>
                  <h4 className="text-2xl md:text-3xl font-bold text-charcoal mb-2">{viewingResource.name}</h4>
                </div>

                {/* Details */}
                <div className="bg-sage-light/20 rounded-lg p-4 space-y-3">
                  <div>
                    <label className="text-xs text-warm-gray uppercase tracking-wide">Resource ID</label>
                    <div className="text-sm font-medium text-charcoal mt-1 font-mono">{viewingResource.id}</div>
                  </div>
                  <div>
                    <label className="text-xs text-warm-gray uppercase tracking-wide">Location ID</label>
                    <div className="text-sm font-medium text-charcoal mt-1 font-mono">{viewingResource.location_id || 'N/A'}</div>
                  </div>
                  <div>
                    <label className="text-xs text-warm-gray uppercase tracking-wide">Max Simultaneous Bookings</label>
                    <div className="text-sm font-medium text-charcoal mt-1">{viewingResource.max_simultaneous_bookings || 'N/A'}</div>
                  </div>
                  <div>
                    <label className="text-xs text-warm-gray uppercase tracking-wide">Status</label>
                    <div className="mt-1">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          viewingResource.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {viewingResource.enabled ? 'Enabled' : 'Disabled'}
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
                        setViewingResource(null);
                        handleViewSchedule(viewingResource);
                      }}
                      className="w-full px-4 py-3 bg-dark-sage text-white rounded-lg hover:bg-dark-sage/80 flex items-center justify-center gap-2 text-sm min-h-[44px]"
                    >
                      <Calendar className="w-4 h-4" />
                      View Schedule
                    </button>
                    <button
                      onClick={() => {
                        setViewingResource(null);
                        handleEdit(viewingResource);
                      }}
                      className="w-full px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center justify-center gap-2 text-sm min-h-[44px]"
                    >
                      <Edit className="w-4 h-4" />
                      Edit Employee
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm(`Are you sure you want to delete ${viewingResource.name}? This action cannot be undone.`)) {
                          await handleDelete(viewingResource.id);
                          setViewingResource(null);
                          await loadResources();
                        }
                      }}
                      className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2 text-sm min-h-[44px]"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Employee
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 md:p-6 border-t border-sand md:border-t-0">
              <button
                onClick={() => setViewingResource(null)}
                className="w-full px-4 py-3 md:py-2 bg-sand/30 text-charcoal rounded-lg hover:bg-sand/50 transition-colors font-medium text-sm min-h-[44px]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <ResourceEditModal
          resource={selectedResource}
          locations={locations}
          onClose={() => {
            setShowEditModal(false);
            setSelectedResource(null);
          }}
          onSave={handleSave}
        />
      )}

      {showScheduleModal && selectedResourceForSchedule && (
        <ResourceScheduleModal
          resourceId={selectedResourceForSchedule.id}
          resourceName={selectedResourceForSchedule.name}
          onClose={() => {
            setShowScheduleModal(false);
            setSelectedResourceForSchedule(null);
          }}
        />
      )}
    </div>
  );
}

