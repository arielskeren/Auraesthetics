'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, RefreshCw, ExternalLink, Link as LinkIcon, CheckSquare, Square } from 'lucide-react';
import LoadingState from './LoadingState';
import ErrorDisplay from './ErrorDisplay';
import PaginationControls from './PaginationControls';
import ServiceEditModal from './ServiceEditModal';
import IdDisplay from './IdDisplay';

export default function ServicesManager() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [pagination, setPagination] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [viewingHapioServices, setViewingHapioServices] = useState(false);
  const [hapioServices, setHapioServices] = useState<any[]>([]);
  const [loadingHapio, setLoadingHapio] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [selectedHapioServices, setSelectedHapioServices] = useState<Set<string>>(new Set());
  const [linkedHapioIds, setLinkedHapioIds] = useState<Set<string>>(new Set());
  const [deletingHapio, setDeletingHapio] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    loadServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const loadServices = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('per_page', String(perPage));

      const response = await fetch(`/api/admin/services?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load services');
      }

      const data = await response.json();
      console.log('[Services Manager] Loaded services:', {
        count: data.data?.length || 0,
        firstService: data.data?.[0],
        allServices: data.data,
      });
      setServices(data.data || []);
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

  const handleEdit = (service: any) => {
    setSelectedService(service);
    setShowEditModal(true);
  };

  const handleAdd = () => {
    setSelectedService(null);
    setShowEditModal(true);
  };

  const handleDelete = async (serviceId: string) => {
    if (!confirm('Are you sure you want to delete this service? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/services/${serviceId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete service');
      }

      loadServices();
    } catch (err: any) {
      setError(err);
    }
  };

  const handleSync = async (serviceId: string) => {
    try {
      const response = await fetch(`/api/admin/services/${serviceId}/sync`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync service to Hapio');
      }

      const data = await response.json();
      alert(data.message || 'Service synced to Hapio successfully');
      loadServices(); // Refresh to show updated hapio_service_id
    } catch (err: any) {
      setError(err);
    }
  };

  const handleSave = async () => {
    // Force refresh - reload from page 1 to ensure we get fresh data
    if (page !== 1) {
      setPage(1);
    } else {
      // If already on page 1, still reload to get fresh data
      await loadServices();
    }
  };

  const loadHapioServices = async () => {
    try {
      setLoadingHapio(true);
      setError(null);
      
      // Load both Hapio services and Neon DB services to check links
      const [hapioResponse, neonResponse] = await Promise.all([
        fetch('/api/admin/hapio/services'),
        fetch('/api/admin/services?per_page=1000'), // Get all Neon services to check links
      ]);

      if (!hapioResponse.ok) {
        throw new Error('Failed to load Hapio services');
      }
      if (!neonResponse.ok) {
        throw new Error('Failed to load Neon DB services');
      }

      const hapioData = await hapioResponse.json();
      const neonData = await neonResponse.json();

      // Build set of linked Hapio service IDs
      const linkedIds = new Set<string>();
      (neonData.data || []).forEach((service: any) => {
        if (service.hapio_service_id) {
          linkedIds.add(service.hapio_service_id);
        }
      });

      setHapioServices(hapioData.data || []);
      setLinkedHapioIds(linkedIds);
      setSelectedHapioServices(new Set()); // Reset selection
      setViewingHapioServices(true);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoadingHapio(false);
    }
  };

  const handleDeleteHapioService = async (serviceId: string) => {
    const isLinked = linkedHapioIds.has(serviceId);
    const warning = isLinked
      ? 'WARNING: This service is linked to a Neon DB service. Deleting it will break the link. Are you sure?'
      : 'Are you sure you want to delete this Hapio service? This action cannot be undone.';

    if (!confirm(warning)) {
      return;
    }

    try {
      setDeletingHapio(serviceId);
      setError(null);

      const response = await fetch(`/api/admin/hapio/services/${serviceId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete Hapio service');
      }

      // Remove from local state
      setHapioServices(hapioServices.filter((s) => s.id !== serviceId));
      setSelectedHapioServices((prev) => {
        const next = new Set(prev);
        next.delete(serviceId);
        return next;
      });
    } catch (err: any) {
      setError(err);
      alert(`Failed to delete service: ${err.message}`);
    } finally {
      setDeletingHapio(null);
    }
  };

  const handleBulkDeleteHapioServices = async () => {
    if (selectedHapioServices.size === 0) {
      alert('Please select at least one service to delete.');
      return;
    }

    const selectedArray = Array.from(selectedHapioServices);
    const linkedCount = selectedArray.filter((id) => linkedHapioIds.has(id)).length;
    const warning =
      linkedCount > 0
        ? `WARNING: ${linkedCount} of ${selectedArray.length} selected service(s) are linked to Neon DB. Deleting them will break the links. Are you sure you want to delete ${selectedArray.length} service(s)?`
        : `Are you sure you want to delete ${selectedArray.length} Hapio service(s)? This action cannot be undone.`;

    if (!confirm(warning)) {
      return;
    }

    try {
      setBulkDeleting(true);
      setError(null);

      const response = await fetch('/api/admin/hapio/services/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ serviceIds: selectedArray }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete services');
      }

      const data = await response.json();
      
      // Show results
      const message = `${data.message}\n\nDetails:\n- Deleted: ${data.results.deleted}\n- Failed: ${data.results.failed}`;
      
      if (data.results.errors.length > 0) {
        const errorDetails = data.results.errors.map((e: any) => `  • ${e.serviceId}: ${e.error}`).join('\n');
        alert(`${message}\n\nErrors:\n${errorDetails}`);
      } else {
        alert(message);
      }

      // Remove deleted services from local state
      const deletedIds = new Set(selectedArray);
      setHapioServices(hapioServices.filter((s) => !deletedIds.has(s.id)));
      setSelectedHapioServices(new Set());
    } catch (err: any) {
      setError(err);
      alert(`Failed to delete services: ${err.message}`);
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleToggleSelectHapioService = (serviceId: string) => {
    setSelectedHapioServices((prev) => {
      const next = new Set(prev);
      if (next.has(serviceId)) {
        next.delete(serviceId);
      } else {
        next.add(serviceId);
      }
      return next;
    });
  };

  const handleSelectAllHapioServices = () => {
    if (selectedHapioServices.size === hapioServices.length) {
      setSelectedHapioServices(new Set());
    } else {
      setSelectedHapioServices(new Set(hapioServices.map((s) => s.id)));
    }
  };

  const handleSyncAll = async () => {
    if (!confirm('This will sync all services from Neon DB to Hapio. Services that already have a Hapio ID will be updated, others will be created. Continue?')) {
      return;
    }

    try {
      setSyncingAll(true);
      setError(null);

      const response = await fetch('/api/admin/services/sync-all', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync all services to Hapio');
      }

      const data = await response.json();
      
      // Show detailed results
      const message = `${data.message}\n\nDetails:\n- Created: ${data.results.created}\n- Updated: ${data.results.updated}\n- Failed: ${data.results.failed}`;
      
      if (data.results.errors.length > 0) {
        const errorDetails = data.results.errors.map((e: any) => `  • ${e.serviceName}: ${e.error}`).join('\n');
        alert(`${message}\n\nErrors:\n${errorDetails}`);
      } else {
        alert(message);
      }

      // Refresh services to show updated hapio_service_id values
      await loadServices();
    } catch (err: any) {
      setError(err);
      alert(`Failed to sync all services: ${err.message}`);
    } finally {
      setSyncingAll(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-charcoal">Services</h2>
        <div className="flex items-center gap-2">
          {!viewingHapioServices && (
            <button
              onClick={handleSyncAll}
              disabled={syncingAll}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${syncingAll ? 'animate-spin' : ''}`} />
              {syncingAll ? 'Syncing All...' : 'Sync All to Hapio'}
            </button>
          )}
          <button
            onClick={viewingHapioServices ? () => setViewingHapioServices(false) : loadHapioServices}
            className="flex items-center gap-2 px-4 py-2 border border-sand text-charcoal rounded-lg hover:bg-sand/20 transition-colors text-sm font-medium"
            disabled={loadingHapio}
          >
            <ExternalLink className="w-4 h-4" />
            {viewingHapioServices ? 'View Neon DB Services' : 'View Hapio Services'}
          </button>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 bg-dark-sage text-charcoal rounded-lg hover:bg-dark-sage/80 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Service
          </button>
        </div>
      </div>

      {error && <ErrorDisplay error={error} />}

      {viewingHapioServices ? (
        <div className="bg-white border border-sand rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-blue-50 border-b border-sand flex items-center justify-between">
            <p className="text-sm text-blue-700">
              <strong>Viewing Hapio Services:</strong> These are services synced to Hapio. Compare with Neon DB services above.
            </p>
            {selectedHapioServices.size > 0 && (
              <button
                onClick={handleBulkDeleteHapioServices}
                disabled={bulkDeleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className={`w-4 h-4 ${bulkDeleting ? 'animate-pulse' : ''}`} />
                {bulkDeleting ? 'Deleting...' : `Delete Selected (${selectedHapioServices.size})`}
              </button>
            )}
          </div>
          {loadingHapio ? (
            <div className="p-8 text-center">
              <LoadingState message="Loading Hapio services..." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-sage-light/30 border-b border-sand">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">
                      <button
                        onClick={handleSelectAllHapioServices}
                        className="flex items-center gap-1 hover:opacity-70 transition-opacity"
                        title="Select/Deselect All"
                      >
                        {selectedHapioServices.size === hapioServices.length && hapioServices.length > 0 ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Linked</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Hapio Service ID</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Duration</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Price</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Buffer Before</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Buffer After</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Bookable Interval</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Booking Window Start</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Booking Window End</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Cancelation Threshold</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand">
                  {hapioServices.length === 0 ? (
                    <tr>
                      <td colSpan={15} className="px-4 py-8 text-center text-sm text-warm-gray">
                        No services found in Hapio. Sync services from Neon DB to create them.
                      </td>
                    </tr>
                  ) : (
                    hapioServices.map((service: any) => {
                      const isLinked = linkedHapioIds.has(service.id);
                      const isSelected = selectedHapioServices.has(service.id);
                      const isDeleting = deletingHapio === service.id;
                      
                      return (
                        <tr key={service.id} className={`hover:bg-sand/20 ${isSelected ? 'bg-blue-50' : ''}`}>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleToggleSelectHapioService(service.id)}
                              className="flex items-center gap-1 hover:opacity-70 transition-opacity"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-blue-600" />
                              ) : (
                                <Square className="w-4 h-4 text-warm-gray" />
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            {isLinked ? (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium"
                                title="Linked to Neon DB service"
                              >
                                <LinkIcon className="w-3 h-3" />
                                Linked
                              </span>
                            ) : (
                              <span className="text-xs text-warm-gray">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <IdDisplay id={service.id} label="Hapio Service ID" />
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-charcoal">{service.name || '—'}</td>
                          <td className="px-4 py-3 text-sm text-warm-gray">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                              {service.type || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-warm-gray font-mono">{service.duration || '—'}</td>
                          <td className="px-4 py-3 text-sm text-warm-gray">
                            {service.price ? `$${Number(service.price).toFixed(3)}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-warm-gray font-mono">{service.buffer_time_before || '—'}</td>
                          <td className="px-4 py-3 text-sm text-warm-gray font-mono">{service.buffer_time_after || '—'}</td>
                          <td className="px-4 py-3 text-sm text-warm-gray font-mono">{service.bookable_interval || '—'}</td>
                          <td className="px-4 py-3 text-sm text-warm-gray font-mono">{service.booking_window_start || '—'}</td>
                          <td className="px-4 py-3 text-sm text-warm-gray font-mono">{service.booking_window_end || '—'}</td>
                          <td className="px-4 py-3 text-sm text-warm-gray font-mono">{service.cancelation_threshold || '—'}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                service.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {service.enabled ? 'Enabled' : 'Disabled'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleDeleteHapioService(service.id)}
                              disabled={isDeleting}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title={isLinked ? 'Delete (Linked to Neon DB - will break link)' : 'Delete'}
                            >
                              <Trash2 className={`w-4 h-4 ${isDeleting ? 'animate-pulse' : ''}`} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-sand rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-sage-light/30 border-b border-sand">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Image</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Service ID</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Category</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Duration</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Price</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand">
              {services.map((service) => (
                <tr key={service.id} className="hover:bg-sand/20">
                  <td className="px-4 py-3">
                    {service.image_url ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={service.image_url}
                          alt={service.name || 'Service image'}
                          className="w-16 h-16 object-cover rounded-lg border border-sand"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      </>
                    ) : (
                      <div className="w-16 h-16 bg-sand/20 rounded-lg border border-sand flex items-center justify-center text-xs text-warm-gray">
                        No image
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <IdDisplay id={service.id} label="Service ID" />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-charcoal">{service.name || '—'}</td>
                  <td className="px-4 py-3 text-sm text-warm-gray">{service.category || '—'}</td>
                  <td className="px-4 py-3 text-sm text-warm-gray">
                    {service.duration_display || (service.duration_minutes != null ? `${service.duration_minutes} min` : '—')}
                  </td>
                  <td className="px-4 py-3 text-sm text-warm-gray">
                    {service.price != null ? `$${Number(service.price).toFixed(2).replace(/\.00$/, '')}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        service.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {service.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSync(service.id)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Sync to Hapio"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(service)}
                        className="p-1.5 text-dark-sage hover:bg-sage-light rounded transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(service.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pagination && (
          <div className="px-4 py-4 border-t border-sand">
            <PaginationControls meta={pagination} onPageChange={handlePageChange} />
          </div>
        )}
        </div>
      )}

      {showEditModal && (
        <ServiceEditModal
          service={selectedService}
          onClose={() => {
            setShowEditModal(false);
            setSelectedService(null);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

