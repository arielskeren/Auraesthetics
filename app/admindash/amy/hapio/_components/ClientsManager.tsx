'use client';

import { useState, useEffect, useRef } from 'react';
import { RefreshCw, Search, Check, X, Plus, Edit, AlertCircle } from 'lucide-react';
import LoadingState from './LoadingState';
import Toast from './Toast';

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

interface BrevoContact {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  phone: string | null;
  createdAt: string;
  displayText: string;
}

interface ConflictData {
  neon: string;
  brevo: string;
  neonDate: string;
  brevoDate: string;
}

interface Conflicts {
  email?: ConflictData;
  first_name?: ConflictData;
  last_name?: ConflictData;
  phone?: ConflictData;
}

export default function ClientsManager() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [toast, setToast] = useState<string | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [initialFormData, setInitialFormData] = useState<any>(null);
  
  // Brevo linking state
  const [availableBrevoContacts, setAvailableBrevoContacts] = useState<BrevoContact[]>([]);
  const [loadingBrevoContacts, setLoadingBrevoContacts] = useState(false);
  const [selectedBrevoId, setSelectedBrevoId] = useState<string | null>(null);
  const [pendingBrevoId, setPendingBrevoId] = useState<string | null>(null); // Selected but not yet saved
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflicts, setConflicts] = useState<Conflicts>({});
  const [conflictResolutions, setConflictResolutions] = useState<Record<string, 'neon' | 'brevo'>>({});
  const [creatingBrevo, setCreatingBrevo] = useState(false);
  
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

  // Track unsaved changes
  useEffect(() => {
    if (showModal && initialFormData) {
      const hasChanges = 
        formData.email !== initialFormData.email ||
        formData.first_name !== initialFormData.first_name ||
        formData.last_name !== initialFormData.last_name ||
        formData.phone !== initialFormData.phone ||
        formData.marketing_opt_in !== initialFormData.marketing_opt_in ||
        pendingBrevoId !== null;
      setHasUnsavedChanges(hasChanges);
    }
  }, [formData, pendingBrevoId, showModal, initialFormData]);

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

  const loadAvailableBrevoContacts = async () => {
    try {
      setLoadingBrevoContacts(true);
      const response = await fetch('/api/admin/brevo/available-contacts', {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to load available Brevo contacts');
      }

      const data = await response.json();
      setAvailableBrevoContacts(data.contacts || []);
    } catch (err: any) {
      console.error('Error loading Brevo contacts:', err);
      setAvailableBrevoContacts([]);
    } finally {
      setLoadingBrevoContacts(false);
    }
  };

  const openEditModal = async (customer: Customer) => {
    setEditingCustomer(customer);
    const initial = {
      email: customer.email,
      first_name: customer.first_name || '',
      last_name: customer.last_name || '',
      phone: customer.phone || '',
      marketing_opt_in: customer.marketing_opt_in,
      brevo_contact_id: customer.brevo_contact_id || '',
    };
    setFormData(initial);
    setInitialFormData(initial);
    setPendingBrevoId(null);
    setSelectedBrevoId(null);
    setShowModal(true);
    
    // Load available Brevo contacts if no brevo_contact_id
    if (!customer.brevo_contact_id) {
      await loadAvailableBrevoContacts();
    }
  };

  const openAddModal = async () => {
    setEditingCustomer(null);
    const initial = {
      email: '',
      first_name: '',
      last_name: '',
      phone: '',
      marketing_opt_in: false,
      brevo_contact_id: '',
    };
    setFormData(initial);
    setInitialFormData(initial);
    setPendingBrevoId(null);
    setSelectedBrevoId(null);
    setShowModal(true);
    await loadAvailableBrevoContacts();
  };

  const handleCloseModal = () => {
    if (hasUnsavedChanges) {
      setShowCloseConfirm(true);
    } else {
      closeModal();
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setShowCloseConfirm(false);
    setEditingCustomer(null);
    setHasUnsavedChanges(false);
    setPendingBrevoId(null);
    setSelectedBrevoId(null);
    setFormData({
      email: '',
      first_name: '',
      last_name: '',
      phone: '',
      marketing_opt_in: false,
      brevo_contact_id: '',
    });
    setInitialFormData(null);
    setConflictResolutions({});
    setConflicts({});
  };

  const handleCreateBrevoRecord = async () => {
    // Validate required fields
    if (!formData.email) {
      alert('Please enter an email address first');
      return;
    }

    try {
      setCreatingBrevo(true);

      if (editingCustomer) {
        // For existing customer, use link-brevo endpoint
        const response = await fetch(`/api/admin/customers/${editingCustomer.id}/link-brevo`, {
          method: 'POST',
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create Brevo record');
        }

        const data = await response.json();
        
        // Update form data with new Brevo ID
        setFormData(prev => ({ ...prev, brevo_contact_id: String(data.brevoId) }));
        setPendingBrevoId(null);
        setSelectedBrevoId(String(data.brevoId));
        
        // Reload available contacts
        await loadAvailableBrevoContacts();
        await loadCustomers();
        
        setToast('Brevo contact created and linked successfully!');
      } else {
        // For new customer, create Brevo contact first (without linking)
        const response = await fetch('/api/admin/brevo/create-contact', {
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
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          const errorMessage = errorData.details 
            ? `${errorData.error || 'Failed to create Brevo record'}: ${errorData.details}`
            : errorData.error || 'Failed to create Brevo record';
          throw new Error(errorMessage);
        }

        const data = await response.json();
        
        // Store Brevo ID in form data (will be linked when customer is created)
        setFormData(prev => ({ ...prev, brevo_contact_id: String(data.brevoId) }));
        setPendingBrevoId(null);
        setSelectedBrevoId(String(data.brevoId));
        
        // Reload available contacts
        await loadAvailableBrevoContacts();
        
        setToast('Brevo contact created successfully! It will be linked when you save the client.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to create Brevo record');
    } finally {
      setCreatingBrevo(false);
    }
  };

  const handleSelectBrevoContact = async (brevoId: string) => {
    setSelectedBrevoId(brevoId);
    setPendingBrevoId(brevoId);

    // For new customers, no conflict check needed (no existing Neon data)
    if (!editingCustomer) {
      // Just store the Brevo ID to be linked when customer is created
      setFormData(prev => ({ ...prev, brevo_contact_id: brevoId }));
      return;
    }

    // For existing customers, check for conflicts
    try {
      const response = await fetch(`/api/admin/customers/${editingCustomer.id}/resolve-conflicts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brevoId }),
      });

      if (!response.ok) {
        throw new Error('Failed to check conflicts');
      }

      const data = await response.json();
      
      if (data.hasConflicts) {
        setConflicts(data.conflicts);
        setShowConflictModal(true);
        // Initialize resolutions with Neon as default
        const resolutions: Record<string, 'neon' | 'brevo'> = {};
        Object.keys(data.conflicts).forEach(field => {
          resolutions[field] = 'neon';
        });
        setConflictResolutions(resolutions);
      } else {
        // No conflicts, just set pending
        setPendingBrevoId(brevoId);
      }
    } catch (err: any) {
      alert('Failed to check for conflicts: ' + err.message);
    }
  };

  const handleResolveConflicts = () => {
    // Apply resolutions to form data
    const updatedFormData = { ...formData };
    
    Object.keys(conflictResolutions).forEach(field => {
      const resolution = conflictResolutions[field];
      if (resolution === 'brevo') {
        // We'll need to fetch the Brevo data - for now, just mark that we need to use Brevo values
        // The actual update will happen when we save
      }
    });

    setShowConflictModal(false);
    // Keep pendingBrevoId set so it links on save
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveStatus('saving');
      
      if (editingCustomer) {
        // Handle conflict resolutions first if pending
        let finalFormData = { ...formData };
        
        if (pendingBrevoId && Object.keys(conflictResolutions).length > 0) {
          // Apply conflict resolutions
          Object.keys(conflictResolutions).forEach(field => {
            const resolution = conflictResolutions[field];
            if (resolution === 'brevo' && conflicts[field as keyof Conflicts]) {
              const conflict = conflicts[field as keyof Conflicts]!;
              if (field === 'email') {
                finalFormData.email = conflict.brevo;
              } else if (field === 'first_name') {
                finalFormData.first_name = conflict.brevo;
              } else if (field === 'last_name') {
                finalFormData.last_name = conflict.brevo;
              } else if (field === 'phone') {
                finalFormData.phone = conflict.brevo;
              }
            }
          });
        }

        // Update existing customer
        const response = await fetch(`/api/admin/customers/${editingCustomer.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: finalFormData.email,
            first_name: finalFormData.first_name || null,
            last_name: finalFormData.last_name || null,
            phone: finalFormData.phone || null,
            marketing_opt_in: finalFormData.marketing_opt_in,
            brevo_contact_id: pendingBrevoId || finalFormData.brevo_contact_id || null,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update customer');
        }

        await loadCustomers();
        
        // Update initial form data to reflect saved state
        setInitialFormData({
          ...finalFormData,
          brevo_contact_id: pendingBrevoId || finalFormData.brevo_contact_id || '',
        });
        setFormData({
          ...finalFormData,
          brevo_contact_id: pendingBrevoId || finalFormData.brevo_contact_id || '',
        });
        setPendingBrevoId(null);
        setSelectedBrevoId(pendingBrevoId || finalFormData.brevo_contact_id || null);
        setHasUnsavedChanges(false);
        setSaveStatus('saved');
        setToast('Client saved successfully!');
        
        // Reset to idle after 2 seconds
        setTimeout(() => {
          setSaveStatus('idle');
        }, 2000);
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
        setSaveStatus('saved');
        setToast('Client created successfully!');
        
        // Reset to idle after 2 seconds
        setTimeout(() => {
          setSaveStatus('idle');
        }, 2000);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save customer');
      setSaveStatus('idle');
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

  const currentBrevoId = editingCustomer?.brevo_contact_id || formData.brevo_contact_id || pendingBrevoId;
  const displayBrevoId = currentBrevoId || 'N/A';

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast}
          onClose={() => setToast(null)}
        />
      )}

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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && handleCloseModal()}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-charcoal">
                  {editingCustomer ? 'Edit Client' : 'Add New Client'}
                </h3>
                <button
                  onClick={handleCloseModal}
                  className="text-warm-gray hover:text-charcoal transition-colors"
                  disabled={saving}
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

                {/* Brevo ID Field */}
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1">
                    Brevo Contact ID
                  </label>
                  {editingCustomer && editingCustomer.brevo_contact_id ? (
                    // Read-only if already linked
                    <input
                      type="text"
                      value={displayBrevoId}
                      readOnly
                      className="w-full px-3 py-2 border border-sand rounded-lg bg-sand/20 text-warm-gray font-mono cursor-not-allowed"
                    />
                  ) : (
                    // Dropdown if not linked
                    <div className="space-y-2">
                      <select
                        value={pendingBrevoId || ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            handleSelectBrevoContact(e.target.value);
                          } else {
                            setPendingBrevoId(null);
                            setSelectedBrevoId(null);
                          }
                        }}
                        disabled={loadingBrevoContacts || creatingBrevo}
                        className="w-full px-3 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">Select a Brevo contact to link...</option>
                        {availableBrevoContacts.map((contact) => (
                          <option key={contact.id} value={String(contact.id)}>
                            {contact.displayText}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleCreateBrevoRecord}
                        disabled={creatingBrevo || !formData.email}
                        className="w-full px-4 py-2 bg-sand/30 text-charcoal rounded-lg hover:bg-sand/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                      >
                        {creatingBrevo ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4" />
                            Create new Brevo Record
                          </>
                        )}
                      </button>
                      {loadingBrevoContacts && (
                        <p className="text-xs text-warm-gray">Loading available contacts...</p>
                      )}
                    </div>
                  )}
                </div>

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
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-charcoal border border-sand rounded-lg hover:bg-sand/30 transition-colors"
                  disabled={saving}
                >
                  Close
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !formData.email}
                  className="px-4 py-2 bg-dark-sage text-white rounded-lg hover:bg-dark-sage/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saveStatus === 'saving' ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : saveStatus === 'saved' ? (
                    <>
                      <Check className="w-4 h-4" />
                      Saved!
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

      {/* Close Confirmation Dialog */}
      {showCloseConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-charcoal mb-1">Unsaved Changes</h4>
                <p className="text-sm text-warm-gray">
                  Are you sure you want to close? Any unsaved changes will be lost.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowCloseConfirm(false)}
                className="px-4 py-2 text-charcoal border border-sand rounded-lg hover:bg-sand/30 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Close Without Saving
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conflict Resolution Modal */}
      {showConflictModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-charcoal">Resolve Data Conflicts</h3>
              <button
                onClick={() => setShowConflictModal(false)}
                className="text-warm-gray hover:text-charcoal transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <p className="text-sm text-warm-gray mb-6">
              The following fields differ between Neon and Brevo. Please choose which value to keep for each field.
            </p>

            <div className="space-y-6">
              {Object.entries(conflicts).map(([field, conflict]) => (
                <div key={field} className="border border-sand rounded-lg p-4">
                  <label className="block text-sm font-medium text-charcoal mb-3 capitalize">
                    {field.replace('_', ' ')}
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 p-3 border border-sand rounded-lg cursor-pointer hover:bg-sand/10 transition-colors">
                      <input
                        type="radio"
                        name={field}
                        value="neon"
                        checked={conflictResolutions[field] === 'neon'}
                        onChange={() => setConflictResolutions(prev => ({ ...prev, [field]: 'neon' }))}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-charcoal">Neon: {conflict.neon || '(empty)'}</div>
                        <div className="text-xs text-warm-gray mt-1">
                          Created: {new Date(conflict.neonDate).toLocaleDateString()}
                        </div>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 p-3 border border-sand rounded-lg cursor-pointer hover:bg-sand/10 transition-colors">
                      <input
                        type="radio"
                        name={field}
                        value="brevo"
                        checked={conflictResolutions[field] === 'brevo'}
                        onChange={() => setConflictResolutions(prev => ({ ...prev, [field]: 'brevo' }))}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-charcoal">Brevo: {conflict.brevo || '(empty)'}</div>
                        <div className="text-xs text-warm-gray mt-1">
                          Created: {new Date(conflict.brevoDate).toLocaleDateString()}
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowConflictModal(false)}
                className="px-4 py-2 text-charcoal border border-sand rounded-lg hover:bg-sand/30 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResolveConflicts}
                className="px-4 py-2 bg-dark-sage text-white rounded-lg hover:bg-dark-sage/90 transition-colors"
              >
                Resolve & Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
