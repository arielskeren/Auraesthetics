'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye } from 'lucide-react';
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

      const response = await fetch(`/api/admin/hapio/services?${params.toString()}`);
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
      const response = await fetch(`/api/admin/hapio/services/${serviceId}`, {
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

  const handleSave = async () => {
    // Force refresh - reload from page 1 to ensure we get fresh data
    if (page !== 1) {
      setPage(1);
    } else {
      // If already on page 1, still reload to get fresh data
      await loadServices();
    }
  };

  if (loading && services.length === 0) {
    return <LoadingState message="Loading services..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-charcoal">Services</h2>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-dark-sage text-charcoal rounded-lg hover:bg-dark-sage/80 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Service
        </button>
      </div>

      {error && <ErrorDisplay error={error} />}

      <div className="bg-white border border-sand rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-sage-light/30 border-b border-sand">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Service ID</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Duration</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Buffer</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand">
              {services.map((service) => (
                <tr key={service.id} className="hover:bg-sand/20">
                  <td className="px-4 py-3">
                    <IdDisplay id={service.id} label="Service ID" />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-charcoal">{service.name || '—'}</td>
                  <td className="px-4 py-3 text-sm text-warm-gray">
                    {service.duration_minutes != null ? `${service.duration_minutes} min` : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-warm-gray">
                    {service.buffer_before_minutes != null || service.buffer_after_minutes != null
                      ? `${service.buffer_before_minutes || 0} / ${service.buffer_after_minutes || 0} min`
                      : '—'}
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

