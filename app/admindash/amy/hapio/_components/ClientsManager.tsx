'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Search, Check, X, Plus, Edit } from 'lucide-react';
import LoadingState from './LoadingState';

interface Customer {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  marketing_opt_in: boolean;
  brevo_contact_id: string | null;
  used_welcome_offer?: boolean;
  created_at: string;
  updated_at: string;
}

export default function ClientsManager() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    marketing_opt_in: false,
    brevo_contact_id: '',
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/admin/customers?limit=1000`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to load customers');
      }

      const data = await response.json();
      setCustomers(data.customers || []);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      email: customer.email,
      first_name: customer.first_name || '',
      last_name: customer.last_name || '',
      phone: customer.phone || '',
      marketing_opt_in: customer.marketing_opt_in,
      brevo_contact_id: customer.brevo_contact_id || '',
    });
    setShowModal(true);
  };

  const openAddModal = () => {
    setEditingCustomer(null);
    setFormData({
      email: '',
      first_name: '',
      last_name: '',
      phone: '',
      marketing_opt_in: false,
      brevo_contact_id: '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCustomer(null);
    setFormData({
      email: '',
      first_name: '',
      last_name: '',
      phone: '',
      marketing_opt_in: false,
      brevo_contact_id: '',
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      if (editingCustomer) {
        // Update existing customer
        const response = await fetch(`/api/admin/customers/${editingCustomer.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: formData.email,
            first_name: formData.first_name || null,
            last_name: formData.last_name || null,
            phone: formData.phone || null,
            marketing_opt_in: formData.marketing_opt_in,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update customer');
        }

        await loadCustomers();
        closeModal();
      } else {
        // Create new customer
        const response = await fetch('/api/admin/customers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: formData.email,
            first_name: formData.first_name || null,
            last_name: formData.last_name || null,
            phone: formData.phone || null,
            marketing_opt_in: formData.marketing_opt_in,
            brevo_contact_id: formData.brevo_contact_id || null,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create customer');
        }

        await loadCustomers();
        closeModal();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  // Filter customers by search query
  const filteredCustomers = customers.filter((customer) => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    const email = (customer.email || '').toLowerCase();
    const firstName = (customer.first_name || '').toLowerCase();
    const lastName = (customer.last_name || '').toLowerCase();
    const phone = (customer.phone || '').toLowerCase();
    const fullName = `${firstName} ${lastName}`.trim().toLowerCase();
    
    return email.includes(query) || 
           firstName.includes(query) || 
           lastName.includes(query) ||
           fullName.includes(query) ||
           phone.includes(query);
  });

  if (loading) {
    return <LoadingState message="Loading clients..." />;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h4 className="font-semibold text-red-800 mb-1">Error</h4>
            <p className="text-sm text-red-700">
              {error?.message || error?.error || 'An error occurred'}
            </p>
          </div>
          <button
            onClick={loadCustomers}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0">
        <div>
          <h2 className="text-lg md:text-xl font-semibold text-charcoal">Clients</h2>
          <p className="text-xs md:text-sm text-warm-gray mt-1">
            {customers.length === 0 
              ? 'No clients found' 
              : `Showing ${filteredCustomers.length} of ${customers.length} clients`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={openAddModal}
            className="px-3 md:px-4 py-2 bg-dark-sage text-white rounded-lg hover:bg-dark-sage/90 transition-colors flex items-center gap-2 text-xs md:text-sm min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Client</span>
            <span className="sm:hidden">Add</span>
          </button>
          <button
            onClick={loadCustomers}
            className="px-3 md:px-4 py-2 bg-sand/30 text-charcoal rounded-lg hover:bg-sand/50 transition-colors flex items-center gap-2 text-xs md:text-sm min-h-[44px]"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
            <span className="sm:hidden">Refresh</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-warm-gray" />
        <input
          type="text"
          placeholder="Search by email, name, or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage focus:border-transparent"
        />
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-lg border border-sand overflow-hidden">
        {filteredCustomers.length === 0 ? (
          <div className="p-8 text-center text-warm-gray">
            {searchQuery ? 'No clients found matching your search' : 'No clients found'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-sand/30 border-b border-sand">
                <tr>
                  <th className="px-4 py-3 text-left text-xs md:text-sm font-semibold text-charcoal">Name</th>
                  <th className="px-4 py-3 text-left text-xs md:text-sm font-semibold text-charcoal">Email</th>
                  <th className="px-4 py-3 text-left text-xs md:text-sm font-semibold text-charcoal">Phone Number</th>
                  <th className="px-4 py-3 text-left text-xs md:text-sm font-semibold text-charcoal">Brevo ID</th>
                  <th className="px-4 py-3 text-left text-xs md:text-sm font-semibold text-charcoal">Email Opt In</th>
                  <th className="px-4 py-3 text-left text-xs md:text-sm font-semibold text-charcoal">Welcome Code Used</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand">
                {filteredCustomers.map((customer) => {
                  const fullName = [customer.first_name, customer.last_name]
                    .filter(Boolean)
                    .join(' ') || 'N/A';
                  
                  return (
                    <tr 
                      key={customer.id} 
                      className="hover:bg-sand/10 transition-colors cursor-pointer"
                      onClick={() => openEditModal(customer)}
                    >
                      <td className="px-4 py-3 text-xs md:text-sm text-charcoal">{fullName}</td>
                      <td className="px-4 py-3 text-xs md:text-sm text-charcoal">{customer.email}</td>
                      <td className="px-4 py-3 text-xs md:text-sm text-charcoal">{customer.phone || 'N/A'}</td>
                      <td className="px-4 py-3 text-xs md:text-sm text-warm-gray font-mono">
                        {customer.brevo_contact_id || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-xs md:text-sm">
                        {customer.marketing_opt_in ? (
                          <Check className="w-5 h-5 text-green-600" />
                        ) : (
                          <X className="w-5 h-5 text-red-500" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs md:text-sm">
                        {customer.used_welcome_offer ? (
                          <Check className="w-5 h-5 text-green-600" />
                        ) : (
                          <X className="w-5 h-5 text-red-500" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="text-xs text-warm-gray text-center">
        Showing {filteredCustomers.length} of {customers.length} clients
      </p>

      {/* Edit/Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-charcoal">
                  {editingCustomer ? 'Edit Client' : 'Add New Client'}
                </h3>
                <button
                  onClick={closeModal}
                  className="text-warm-gray hover:text-charcoal transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-charcoal mb-1">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      className="w-full px-3 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-charcoal mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      className="w-full px-3 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage"
                  />
                </div>

                {!editingCustomer && (
                  <div>
                    <label className="block text-sm font-medium text-charcoal mb-1">
                      Brevo Contact ID (optional)
                    </label>
                    <input
                      type="text"
                      value={formData.brevo_contact_id}
                      onChange={(e) => setFormData({ ...formData, brevo_contact_id: e.target.value })}
                      className="w-full px-3 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage"
                      placeholder="Leave empty if not synced yet"
                    />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="marketing_opt_in"
                    checked={formData.marketing_opt_in}
                    onChange={(e) => setFormData({ ...formData, marketing_opt_in: e.target.checked })}
                    className="w-4 h-4 text-dark-sage border-sand rounded focus:ring-dark-sage"
                  />
                  <label htmlFor="marketing_opt_in" className="text-sm text-charcoal">
                    Email Marketing Opt-In
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-charcoal border border-sand rounded-lg hover:bg-sand/30 transition-colors"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !formData.email}
                  className="px-4 py-2 bg-dark-sage text-white rounded-lg hover:bg-dark-sage/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      {editingCustomer ? <Edit className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      {editingCustomer ? 'Save Changes' : 'Create Client'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
