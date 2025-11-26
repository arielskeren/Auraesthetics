'use client';

import { useState, useEffect } from 'react';
import { Plus, RefreshCw, Tag, X, Edit, Trash2, Users, Eye, ChevronDown, ChevronUp } from 'lucide-react';

interface GlobalDiscountCode {
  id: string;
  code: string;
  discount_type: 'percent' | 'dollar';
  discount_value: number;
  discount_cap?: number | null;
  stripe_coupon_id: string | null;
  stripe_promotion_code_id?: string | null;
  is_active: boolean;
  max_uses?: number | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  usage_count?: number;
  times_redeemed?: number;
}

interface UsageCustomer {
  customer_email: string;
  customer_name: string;
  used_at: string;
  amount: number;
  payment_intent_id: string;
}

export default function GlobalCodesManager() {
  const [activeCodes, setActiveCodes] = useState<GlobalDiscountCode[]>([]);
  const [usedCodes, setUsedCodes] = useState<GlobalDiscountCode[]>([]);
  const [inactiveCodes, setInactiveCodes] = useState<GlobalDiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [selectedCode, setSelectedCode] = useState<GlobalDiscountCode | null>(null);
  const [usageCustomers, setUsageCustomers] = useState<UsageCustomer[]>([]);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [activeSectionOpen, setActiveSectionOpen] = useState(true);
  const [usedSectionOpen, setUsedSectionOpen] = useState(true);
  const [inactiveSectionOpen, setInactiveSectionOpen] = useState(false);
  
  // Create form state
  const [createForm, setCreateForm] = useState({
    code: '',
    discountType: 'percent' as 'percent' | 'dollar',
    discountValue: '',
    discountCap: '',
    maxUses: '',
    expiresOn: '', // Date string in YYYY-MM-DD format
    isActive: true,
  });

  // Edit form state
  const [editForm, setEditForm] = useState({
    discountType: 'percent' as 'percent' | 'dollar',
    discountValue: '',
    discountCap: '',
    maxUses: '',
    expiresOn: '', // Date string in YYYY-MM-DD format
    isActive: true,
  });

  useEffect(() => {
    loadCodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCodes = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Clear state aggressively before loading to prevent stale data
      setActiveCodes([]);
      setUsedCodes([]);
      setInactiveCodes([]);

      const timestamp = Date.now();
      const response = await fetch(`/api/admin/global-discount-codes?t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || 'Failed to load global discount codes');
      }

      const data = await response.json();
      // Handle new grouped response structure
      const active = Array.isArray(data.active) ? data.active : [];
      const used = Array.isArray(data.used) ? data.used : [];
      const inactive = Array.isArray(data.inactive) ? data.inactive : [];
      
      setActiveCodes(active);
      setUsedCodes(used);
      setInactiveCodes(inactive);
    } catch (err: any) {
      console.error('[GlobalCodesManager] Error loading codes:', err);
      setError(err);
      setActiveCodes([]);
      setUsedCodes([]);
      setInactiveCodes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!createForm.code || !createForm.discountValue) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const response = await fetch('/api/admin/global-discount-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: createForm.code,
          discountType: createForm.discountType,
          discountValue: parseFloat(createForm.discountValue),
          discountCap: createForm.discountType === 'percent' && createForm.discountCap ? parseFloat(createForm.discountCap) : null,
          maxUses: createForm.maxUses ? parseInt(createForm.maxUses) : null,
          expiresOn: createForm.expiresOn || null,
          isActive: createForm.isActive,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.details 
          ? `${data.error || 'Failed to create global discount code'}: ${data.details}`
          : data.error || 'Failed to create global discount code';
        console.error('[GlobalCodesManager] Create error:', data);
        alert(errorMsg);
        return;
      }

      alert('Global discount code created successfully!');
      setShowCreateModal(false);
      setCreateForm({ code: '', discountType: 'percent', discountValue: '', discountCap: '', maxUses: '', expiresOn: '', isActive: true });
      await loadCodes();
    } catch (err: any) {
      console.error('[GlobalCodesManager] Create exception:', err);
      alert(err.message || 'Failed to create global discount code');
    }
  };

  const handleEdit = (code: GlobalDiscountCode) => {
    // Prevent editing inactive codes
    if (code.is_active === false) {
      alert('Inactive codes cannot be edited. They are read-only for historical records.');
      return;
    }
    setSelectedCode(code);
    // Convert expires_at timestamp to YYYY-MM-DD format for date input
    const expiresOnDate = code.expires_at 
      ? new Date(code.expires_at).toISOString().split('T')[0]
      : '';
    
    setEditForm({
      discountType: code.discount_type,
      discountValue: String(code.discount_value),
      discountCap: code.discount_cap ? String(code.discount_cap) : '',
      maxUses: code.max_uses ? String(code.max_uses) : '',
      expiresOn: expiresOnDate,
      isActive: code.is_active,
    });
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    if (!selectedCode || !editForm.discountValue) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const response = await fetch(`/api/admin/global-discount-codes/${selectedCode.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discountType: editForm.discountType,
          discountValue: parseFloat(editForm.discountValue),
          discountCap: editForm.discountType === 'percent' && editForm.discountCap ? parseFloat(editForm.discountCap) : null,
          maxUses: editForm.maxUses ? parseInt(editForm.maxUses) : null,
          expiresOn: editForm.expiresOn || null,
          isActive: editForm.isActive,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Failed to update global discount code');
        return;
      }

      alert('Global discount code updated successfully!');
      setShowEditModal(false);
      setSelectedCode(null);
      await loadCodes();
    } catch (err: any) {
      alert(err.message || 'Failed to update global discount code');
    }
  };

  const handleDelete = async () => {
    if (!selectedCode) return;

    // Prevent deletion of inactive codes (they're already inactive)
    if (selectedCode.is_active === false) {
      alert('This code is already inactive and cannot be deleted. Inactive codes are kept for historical records.');
      setShowDeleteModal(false);
      setSelectedCode(null);
      return;
    }

    try {
      const response = await fetch(`/api/admin/global-discount-codes/${selectedCode.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || 'Failed to delete global discount code');
        return;
      }

      alert('Global discount code marked as inactive successfully!');
      setShowDeleteModal(false);
      setSelectedCode(null);
      await loadCodes();
    } catch (err: any) {
      alert(err.message || 'Failed to delete global discount code');
    }
  };

  const handleViewUsage = async (code: GlobalDiscountCode) => {
    try {
      setLoadingUsage(true);
      const response = await fetch(`/api/admin/global-discount-codes/${code.id}/usage`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        alert(errorData.error || 'Failed to load usage details');
        return;
      }
      
      const data = await response.json();
      setUsageCustomers(data.usage?.customers || []);
      setSelectedCode(code);
      setShowUsageModal(true);
    } catch (err: any) {
      alert(err.message || 'Failed to load usage details');
    } finally {
      setLoadingUsage(false);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const isExpired = (code: GlobalDiscountCode) => {
    if (!code.expires_at) return false;
    return new Date(code.expires_at) < new Date();
  };

  const getStatusBadge = (code: GlobalDiscountCode) => {
    if (!code.is_active) {
      return <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">Inactive</span>;
    }
    if (isExpired(code)) {
      return <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">Expired</span>;
    }
    if (code.max_uses && code.usage_count && code.usage_count >= code.max_uses) {
      return <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs">Max Uses Reached</span>;
    }
    return <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Active</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dark-sage"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error loading global discount codes: {error.message}</p>
        <button
          onClick={loadCodes}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0">
        <div>
          <h3 className="text-base md:text-lg font-semibold text-charcoal">Global Discount Codes</h3>
          <p className="text-xs md:text-sm text-warm-gray mt-1">
            Manage reusable discount codes available to all customers
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadCodes}
            className="px-3 md:px-4 py-2 bg-sand/30 text-charcoal rounded-lg hover:bg-sand/50 transition-colors flex items-center gap-2 text-xs md:text-sm min-h-[44px]"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
            <span className="sm:hidden">Refresh</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 md:px-4 py-2 bg-dark-sage text-white rounded-lg hover:bg-dark-sage/80 transition-colors flex items-center gap-2 text-xs md:text-sm min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Create Code</span>
            <span className="sm:hidden">Create</span>
          </button>
        </div>
      </div>

      {/* Active Codes Section */}
      <div className="bg-white border border-sand rounded-lg overflow-hidden">
        <button
          onClick={() => setActiveSectionOpen(!activeSectionOpen)}
          className="w-full px-4 py-3 bg-sage-light/30 hover:bg-sage-light/40 transition-colors flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">Active</span>
            <span className="text-sm font-semibold text-charcoal">
              Active Codes ({activeCodes.length})
            </span>
          </div>
          {activeSectionOpen ? (
            <ChevronUp className="w-4 h-4 text-charcoal" />
          ) : (
            <ChevronDown className="w-4 h-4 text-charcoal" />
          )}
        </button>
        {activeSectionOpen && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-sage-light/20">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Code</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Discount</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Usage</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Max Uses</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Expires</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand">
                {activeCodes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-warm-gray">
                      No active codes found
                    </td>
                  </tr>
                ) : (
                  activeCodes.map((code) => (
                    <tr key={code.id} className="hover:bg-sand/10">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-dark-sage" />
                          <span className="font-mono font-semibold text-charcoal">{code.code}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-charcoal">
                        {code.discount_type === 'percent' 
                          ? `${code.discount_value}%${code.discount_cap ? ` (up to $${code.discount_cap})` : ''}` 
                          : `$${code.discount_value}`}
                      </td>
                      <td className="px-4 py-3 text-sm text-charcoal">
                        <div className="flex items-center gap-2">
                          <span>{code.usage_count || 0}</span>
                          {code.usage_count && code.usage_count > 0 && (
                            <button
                              onClick={() => handleViewUsage(code)}
                              className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1"
                              title="View customers who used this code"
                            >
                              <Eye className="w-3 h-3" />
                              View
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-charcoal">
                        {code.max_uses ? code.max_uses : 'Unlimited'}
                      </td>
                      <td className="px-4 py-3 text-sm text-charcoal">
                        {formatDate(code.expires_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(code)}
                            className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 flex items-center gap-1"
                            title="Edit code"
                          >
                            <Edit className="w-3 h-3" />
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              setSelectedCode(code);
                              setShowDeleteModal(true);
                            }}
                            className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 flex items-center gap-1"
                            title="Delete code (marks as inactive)"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Used Codes Section */}
      <div className="bg-white border border-sand rounded-lg overflow-hidden">
        <button
          onClick={() => setUsedSectionOpen(!usedSectionOpen)}
          className="w-full px-4 py-3 bg-blue-50 hover:bg-blue-100 transition-colors flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">Used</span>
            <span className="text-sm font-semibold text-charcoal">
              Used Codes ({usedCodes.length})
            </span>
          </div>
          {usedSectionOpen ? (
            <ChevronUp className="w-4 h-4 text-charcoal" />
          ) : (
            <ChevronDown className="w-4 h-4 text-charcoal" />
          )}
        </button>
        {usedSectionOpen && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-blue-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Code</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Discount</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Usage</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Max Uses</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Expires</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand">
                {usedCodes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-warm-gray">
                      No used codes found
                    </td>
                  </tr>
                ) : (
                  usedCodes.map((code) => (
                    <tr key={code.id} className="hover:bg-blue-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-blue-600" />
                          <span className="font-mono font-semibold text-charcoal">{code.code}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-charcoal">
                        {code.discount_type === 'percent' 
                          ? `${code.discount_value}%${code.discount_cap ? ` (up to $${code.discount_cap})` : ''}` 
                          : `$${code.discount_value}`}
                      </td>
                      <td className="px-4 py-3 text-sm text-charcoal">
                        <div className="flex items-center gap-2">
                          <span>{code.usage_count || 0}</span>
                          {code.usage_count && code.usage_count > 0 && (
                            <button
                              onClick={() => handleViewUsage(code)}
                              className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1"
                              title="View customers who used this code"
                            >
                              <Eye className="w-3 h-3" />
                              View
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-charcoal">
                        {code.max_uses ? code.max_uses : 'Unlimited'}
                      </td>
                      <td className="px-4 py-3 text-sm text-charcoal">
                        {formatDate(code.expires_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inactive/Expired Codes Section */}
      <div className="bg-white border border-sand rounded-lg overflow-hidden">
        <button
          onClick={() => setInactiveSectionOpen(!inactiveSectionOpen)}
          className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 transition-colors flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs font-semibold">Inactive</span>
            <span className="text-sm font-semibold text-charcoal">
              Inactive/Expired Codes ({inactiveCodes.length})
            </span>
          </div>
          {inactiveSectionOpen ? (
            <ChevronUp className="w-4 h-4 text-charcoal" />
          ) : (
            <ChevronDown className="w-4 h-4 text-charcoal" />
          )}
        </button>
        {inactiveSectionOpen && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Code</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Discount</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Usage</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Expires</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand">
                {inactiveCodes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-warm-gray">
                      No inactive/expired codes found
                    </td>
                  </tr>
                ) : (
                  inactiveCodes.map((code) => (
                    <tr key={code.id} className="hover:bg-gray-50 opacity-75">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-gray-400" />
                          <span className="font-mono font-semibold text-charcoal">{code.code}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-charcoal">
                        {code.discount_type === 'percent' 
                          ? `${code.discount_value}%${code.discount_cap ? ` (up to $${code.discount_cap})` : ''}` 
                          : `$${code.discount_value}`}
                      </td>
                      <td className="px-4 py-3">
                        {code.is_active === false ? (
                          <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">Inactive</span>
                        ) : (
                          <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs">Expired</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-charcoal">
                        {code.usage_count || 0}
                      </td>
                      <td className="px-4 py-3 text-sm text-charcoal">
                        {formatDate(code.expires_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-warm-gray">
                        {formatDate(code.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[60] bg-charcoal/80 backdrop-blur-sm md:flex md:items-center md:justify-center md:p-4">
          <div className="bg-white h-full md:h-auto md:rounded-lg md:max-w-md md:w-full md:shadow-xl flex flex-col">
            <div className="p-4 md:p-6 flex-1 overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg md:text-xl font-semibold text-charcoal">Create Global Discount Code</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 hover:bg-sand/30 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <X className="w-5 h-5 text-charcoal" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-2">
                    Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={createForm.code}
                    onChange={(e) => setCreateForm({ ...createForm, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-sage-dark/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage font-mono"
                    placeholder="SUMMER2024"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-charcoal mb-2">
                    Discount Type <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCreateForm({ ...createForm, discountType: 'percent' })}
                      className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                        createForm.discountType === 'percent'
                          ? 'bg-dark-sage text-white'
                          : 'bg-sand/30 text-charcoal hover:bg-sand/50'
                      }`}
                    >
                      Percentage
                    </button>
                    <button
                      onClick={() => setCreateForm({ ...createForm, discountType: 'dollar' })}
                      className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                        createForm.discountType === 'dollar'
                          ? 'bg-dark-sage text-white'
                          : 'bg-sand/30 text-charcoal hover:bg-sand/50'
                      }`}
                    >
                      Dollar Amount
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-charcoal mb-2">
                    Discount Value <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {createForm.discountType === 'dollar' && (
                      <span className="text-charcoal">$</span>
                    )}
                    <input
                      type="number"
                      value={createForm.discountValue}
                      onChange={(e) => setCreateForm({ ...createForm, discountValue: e.target.value })}
                      className="flex-1 px-3 py-2 border border-sage-dark/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage"
                      placeholder={createForm.discountType === 'percent' ? '15' : '30'}
                      min="0"
                      max={createForm.discountType === 'percent' ? '100' : undefined}
                    />
                    {createForm.discountType === 'percent' && (
                      <span className="text-charcoal">%</span>
                    )}
                  </div>
                </div>

                {createForm.discountType === 'percent' && (
                  <div>
                    <label className="block text-sm font-medium text-charcoal mb-2">
                      Maximum Discount Amount (Cap) <span className="text-warm-gray text-xs">(optional)</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-charcoal">$</span>
                      <input
                        type="number"
                        value={createForm.discountCap}
                        onChange={(e) => setCreateForm({ ...createForm, discountCap: e.target.value })}
                        className="flex-1 px-3 py-2 border border-sage-dark/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage"
                        placeholder="40 (e.g., 15% off up to $40)"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-charcoal mb-2">
                    Maximum Uses <span className="text-warm-gray text-xs">(optional, leave empty for unlimited)</span>
                  </label>
                  <input
                    type="number"
                    value={createForm.maxUses}
                    onChange={(e) => setCreateForm({ ...createForm, maxUses: e.target.value })}
                    className="w-full px-3 py-2 border border-sage-dark/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage"
                    placeholder="100 (leave empty for unlimited)"
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-charcoal mb-2">
                    Expires On <span className="text-warm-gray text-xs">(optional)</span>
                  </label>
                  <input
                    type="date"
                    value={createForm.expiresOn}
                    onChange={(e) => setCreateForm({ ...createForm, expiresOn: e.target.value })}
                    className="w-full px-3 py-2 border border-sage-dark/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage"
                    min={new Date().toISOString().split('T')[0]}
                  />
                  <p className="text-xs text-warm-gray mt-1">
                    Leave empty for no expiry. Selected date will be set to end of day (11:59 PM).
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={createForm.isActive}
                    onChange={(e) => setCreateForm({ ...createForm, isActive: e.target.checked })}
                    className="w-4 h-4 text-dark-sage border-sage-dark/20 rounded focus:ring-dark-sage"
                  />
                  <label htmlFor="isActive" className="text-sm text-charcoal">
                    Active (code can be used)
                  </label>
                </div>

              </div>
            </div>
            <div className="p-4 md:p-6 border-t border-sand md:border-t-0">
              <div className="flex flex-col md:flex-row gap-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-3 md:py-2 bg-sand/30 text-charcoal rounded-lg hover:bg-sand/50 transition-colors font-medium text-sm min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!createForm.code || !createForm.discountValue}
                  className="flex-1 px-4 py-3 md:py-2 bg-dark-sage text-white rounded-lg hover:bg-dark-sage/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm min-h-[44px]"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal - Similar structure to Create Modal */}
      {showEditModal && selectedCode && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-charcoal/80 backdrop-blur-sm">
          <div className="bg-white rounded-lg max-w-md w-full shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-charcoal">Edit Global Discount Code</h3>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedCode(null);
                  }}
                  className="p-1 hover:bg-sand/30 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-charcoal" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-warm-gray mb-2">
                    Code: <span className="font-mono font-semibold text-charcoal">{selectedCode.code}</span>
                  </p>
                </div>

                {/* Similar form fields as create modal */}
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-2">
                    Discount Type <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditForm({ ...editForm, discountType: 'percent' })}
                      className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                        editForm.discountType === 'percent'
                          ? 'bg-dark-sage text-white'
                          : 'bg-sand/30 text-charcoal hover:bg-sand/50'
                      }`}
                    >
                      Percentage
                    </button>
                    <button
                      onClick={() => setEditForm({ ...editForm, discountType: 'dollar' })}
                      className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                        editForm.discountType === 'dollar'
                          ? 'bg-dark-sage text-white'
                          : 'bg-sand/30 text-charcoal hover:bg-sand/50'
                      }`}
                    >
                      Dollar Amount
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-charcoal mb-2">
                    Discount Value <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {editForm.discountType === 'dollar' && (
                      <span className="text-charcoal">$</span>
                    )}
                    <input
                      type="number"
                      value={editForm.discountValue}
                      onChange={(e) => setEditForm({ ...editForm, discountValue: e.target.value })}
                      className="flex-1 px-3 py-2 border border-sage-dark/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage"
                      placeholder={editForm.discountType === 'percent' ? '15' : '30'}
                      min="0"
                      max={editForm.discountType === 'percent' ? '100' : undefined}
                    />
                    {editForm.discountType === 'percent' && (
                      <span className="text-charcoal">%</span>
                    )}
                  </div>
                </div>

                {editForm.discountType === 'percent' && (
                  <div>
                    <label className="block text-sm font-medium text-charcoal mb-2">
                      Maximum Discount Amount (Cap) <span className="text-warm-gray text-xs">(optional)</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-charcoal">$</span>
                      <input
                        type="number"
                        value={editForm.discountCap}
                        onChange={(e) => setEditForm({ ...editForm, discountCap: e.target.value })}
                        className="flex-1 px-3 py-2 border border-sage-dark/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage"
                        placeholder="40"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-charcoal mb-2">
                    Maximum Uses <span className="text-warm-gray text-xs">(optional)</span>
                  </label>
                  <input
                    type="number"
                    value={editForm.maxUses}
                    onChange={(e) => setEditForm({ ...editForm, maxUses: e.target.value })}
                    className="w-full px-3 py-2 border border-sage-dark/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage"
                    placeholder="Leave empty for unlimited"
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-charcoal mb-2">
                    Expires On <span className="text-warm-gray text-xs">(optional)</span>
                  </label>
                  <input
                    type="date"
                    value={editForm.expiresOn}
                    onChange={(e) => setEditForm({ ...editForm, expiresOn: e.target.value })}
                    className="w-full px-3 py-2 border border-sage-dark/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage"
                    min={new Date().toISOString().split('T')[0]}
                  />
                  <p className="text-xs text-warm-gray mt-1">
                    Leave empty for no expiry. Selected date will be set to end of day (11:59 PM).
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="editIsActive"
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                    className="w-4 h-4 text-dark-sage border-sage-dark/20 rounded focus:ring-dark-sage"
                  />
                  <label htmlFor="editIsActive" className="text-sm text-charcoal">
                    Active (code can be used)
                  </label>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedCode(null);
                    }}
                    className="flex-1 px-4 py-2 bg-sand/30 text-charcoal rounded-lg hover:bg-sand/50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdate}
                    disabled={!editForm.discountValue}
                    className="flex-1 px-4 py-2 bg-dark-sage text-white rounded-lg hover:bg-dark-sage/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    Update
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && selectedCode && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-charcoal/80 backdrop-blur-sm">
          <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-charcoal">Delete Global Discount Code</h3>
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedCode(null);
                  }}
                  className="p-1 hover:bg-sand/30 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-charcoal" />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-warm-gray">
                  Are you sure you want to delete global discount code <span className="font-mono font-semibold text-charcoal">{selectedCode.code}</span>?
                </p>
                {selectedCode.usage_count && selectedCode.usage_count > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-800">
                      ⚠️ This code has been used {selectedCode.usage_count} time(s). Deleting it will remove the code but won&apos;t affect past bookings.
                    </p>
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setSelectedCode(null);
                    }}
                    className="flex-1 px-4 py-2 bg-sand/30 text-charcoal rounded-lg hover:bg-sand/50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Usage Modal */}
      {showUsageModal && selectedCode && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-charcoal/80 backdrop-blur-sm">
          <div className="bg-white rounded-lg max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-charcoal">Usage Details</h3>
                  <p className="text-sm text-warm-gray mt-1">
                    Code: <span className="font-mono font-semibold">{selectedCode.code}</span>
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowUsageModal(false);
                    setSelectedCode(null);
                    setUsageCustomers([]);
                  }}
                  className="p-1 hover:bg-sand/30 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-charcoal" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-sage-light/30 rounded-lg p-4">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-xs text-warm-gray">Total Uses</p>
                      <p className="text-2xl font-bold text-charcoal">{selectedCode.usage_count || 0}</p>
                    </div>
                    {selectedCode.max_uses && (
                      <div>
                        <p className="text-xs text-warm-gray">Max Uses</p>
                        <p className="text-2xl font-bold text-charcoal">{selectedCode.max_uses}</p>
                      </div>
                    )}
                  </div>
                </div>

                {usageCustomers.length === 0 ? (
                  <p className="text-center text-warm-gray py-8">No usage data found</p>
                ) : (
                  <div className="border border-sand rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-sage-light/20">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Customer</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Email</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Used At</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-sand">
                        {usageCustomers.map((customer, idx) => (
                          <tr key={idx} className="hover:bg-sand/10">
                            <td className="px-4 py-3 text-sm text-charcoal">
                              {customer.customer_name || 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-sm text-charcoal">
                              {customer.customer_email || 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-sm text-charcoal">
                              {formatDate(customer.used_at)}
                            </td>
                            <td className="px-4 py-3 text-sm text-charcoal">
                              ${(customer.amount / 100).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

