'use client';

import { useState, useEffect } from 'react';
import { Plus, RefreshCw, Lock, Unlock, Calendar, User, DollarSign, Tag, X, Edit, Trash2, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import BookingDetailModal from '../../BookingDetailModal';
import GlobalCodesManager from './GlobalCodesManager';

interface DiscountCode {
  id: string;
  code: string;
  customer_id: string | null;
  customer_email?: string | null;
  customer_name?: string | null;
  discount_type: 'percent' | 'dollar';
  discount_value: number;
  discount_cap?: number | null;
  stripe_coupon_id: string | null;
  used: boolean;
  used_at: string | null;
  expires_at: string | null;
  created_at: string;
  created_by: string | null;
  booking_id?: string | null;
  booking_service?: string | null;
  booking_date?: string | null;
}

interface UsageDetails {
  booking_id: string;
  service_name: string;
  booking_date: string;
  customer_email: string;
  customer_name: string;
  used_at: string;
}

type TabType = 'one-time' | 'global';

export default function DiscountCodesManager() {
  const [activeTab, setActiveTab] = useState<TabType>('one-time');
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCode, setSelectedCode] = useState<DiscountCode | null>(null);
  const [usageDetails, setUsageDetails] = useState<Record<string, UsageDetails>>({});
  const [activeSectionOpen, setActiveSectionOpen] = useState(true);
  const [usedSectionOpen, setUsedSectionOpen] = useState(true);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [loadingBooking, setLoadingBooking] = useState(false);
  
  // Create form state
  const [createForm, setCreateForm] = useState({
    customerEmail: '',
    discountType: 'percent' as 'percent' | 'dollar',
    discountValue: '',
    discountCap: '',
    expiresInDays: '',
  });

  // Edit form state
  const [editForm, setEditForm] = useState({
    discountType: 'percent' as 'percent' | 'dollar',
    discountValue: '',
    discountCap: '',
    expiresInDays: '',
  });

  // Extend form state
  const [extendDays, setExtendDays] = useState('');

  useEffect(() => {
    loadCodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCodes = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Clear state aggressively before loading to prevent stale data
      setCodes([]);
      setUsageDetails({});

      // Add timestamp to prevent caching
      const timestamp = Date.now();
      const response = await fetch(`/api/admin/discount-codes?t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || 'Failed to load discount codes');
      }

      const data = await response.json();
      
      // Check for warning about missing table
      if (data.warning) {
        console.warn('[DiscountCodesManager]', data.warning);
        setError({ message: data.warning });
        setCodes([]);
        setUsageDetails({});
        return;
      }
      
      // Log what we received for debugging
      console.log('[DiscountCodesManager] Loaded codes:', data.codes?.length || 0, 'codes');
      if (data.codes && data.codes.length > 0) {
        console.log('[DiscountCodesManager] Code IDs:', data.codes.map((c: DiscountCode) => c.id));
      }
      
      // Ensure we're setting a fresh array (not appending)
      const freshCodes = Array.isArray(data.codes) ? data.codes : [];
      setCodes(freshCodes);
      
      // Load usage details for used codes
      const usedCodes = freshCodes.filter((c: DiscountCode) => c.used);
      for (const code of usedCodes) {
        await loadUsageDetails(code.id);
      }
    } catch (err: any) {
      console.error('[DiscountCodesManager] Error loading codes:', err);
      setError(err);
      // Still set codes to empty array so UI doesn't break
      setCodes([]);
      setUsageDetails({});
    } finally {
      setLoading(false);
    }
  };

  const loadUsageDetails = async (codeId: string) => {
    try {
      const response = await fetch(`/api/admin/discount-codes/${codeId}/usage`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.usage) {
          setUsageDetails(prev => ({ ...prev, [codeId]: data.usage }));
        }
      }
    } catch (err) {
      // Non-critical - continue
    }
  };

  const handleCreate = async () => {
    if (!createForm.customerEmail || !createForm.discountValue) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const response = await fetch('/api/admin/discount-codes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerEmail: createForm.customerEmail,
          discountType: createForm.discountType,
          discountValue: parseFloat(createForm.discountValue),
          discountCap: createForm.discountType === 'percent' && createForm.discountCap ? parseFloat(createForm.discountCap) : null,
          expiresInDays: createForm.expiresInDays ? parseInt(createForm.expiresInDays) : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Failed to create discount code');
        return;
      }

      alert('Discount code created and emailed to customer!');
      setShowCreateModal(false);
      setCreateForm({ customerEmail: '', discountType: 'percent', discountValue: '', discountCap: '', expiresInDays: '' });
      await loadCodes();
    } catch (err: any) {
      alert(err.message || 'Failed to create discount code');
    }
  };

  const handleExtend = async () => {
    if (!selectedCode || !extendDays) {
      alert('Please enter number of days to extend');
      return;
    }

    try {
      const response = await fetch(`/api/admin/discount-codes/${selectedCode.id}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: parseInt(extendDays) }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Failed to extend expiry');
        return;
      }

      alert('Expiry extended successfully!');
      setShowExtendModal(false);
      setSelectedCode(null);
      setExtendDays('');
      await loadCodes();
    } catch (err: any) {
      alert(err.message || 'Failed to extend expiry');
    }
  };

  const handleLock = async (codeId: string, lock: boolean) => {
    try {
      const response = await fetch(`/api/admin/discount-codes/${codeId}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lock }),
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || 'Failed to update code status');
        return;
      }

      await loadCodes();
    } catch (err: any) {
      alert(err.message || 'Failed to update code status');
    }
  };

  const handleEdit = (code: DiscountCode) => {
    setSelectedCode(code);
    setEditForm({
      discountType: code.discount_type,
      discountValue: String(code.discount_value),
      discountCap: code.discount_cap ? String(code.discount_cap) : '',
      expiresInDays: code.expires_at ? String(Math.ceil((new Date(code.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : '',
    });
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    if (!selectedCode || !editForm.discountValue) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const response = await fetch(`/api/admin/discount-codes/${selectedCode.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discountType: editForm.discountType,
          discountValue: parseFloat(editForm.discountValue),
          discountCap: editForm.discountType === 'percent' && editForm.discountCap ? parseFloat(editForm.discountCap) : null,
          expiresInDays: editForm.expiresInDays ? parseInt(editForm.expiresInDays) : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Failed to update discount code');
        return;
      }

      alert('Discount code updated successfully!');
      setShowEditModal(false);
      setSelectedCode(null);
      await loadCodes();
    } catch (err: any) {
      alert(err.message || 'Failed to update discount code');
    }
  };

  const handleDelete = async () => {
    if (!selectedCode) return;

    // Prevent deletion of used codes
    if (selectedCode.used) {
      alert('Used discount codes cannot be deleted from the website. Please delete them directly in Neon if needed.');
      setShowDeleteModal(false);
      setSelectedCode(null);
      return;
    }

    try {
      const response = await fetch(`/api/admin/discount-codes/${selectedCode.id}`, {
        method: 'DELETE',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        console.error('[Delete Discount Code] Failed:', data);
        
        // If code not found (404), it's already deleted - remove from UI
        if (response.status === 404 || data.error?.includes('not found')) {
          console.log('[Delete Discount Code] Code not found, removing from UI state');
          setCodes(prevCodes => prevCodes.filter(c => c.id !== selectedCode.id));
          setUsageDetails(prev => {
            const updated = { ...prev };
            delete updated[selectedCode.id];
            return updated;
          });
          setShowDeleteModal(false);
          setSelectedCode(null);
          alert('This code no longer exists and has been removed from the list.');
          return;
        }
        
        alert(data.error || 'Failed to delete discount code');
        return;
      }

      const data = await response.json();
      if (!data.success) {
        alert('Delete operation did not complete successfully');
        return;
      }

      console.log('[Delete Discount Code] Success, refreshing list...');
      setShowDeleteModal(false);
      const deletedCodeId = selectedCode.id;
      setSelectedCode(null);
      
      // Aggressively clear all state
      setUsageDetails({});
      setCodes([]);
      
      // Small delay to ensure database transaction is committed, then reload
      await new Promise<void>((resolve, reject) => {
        setTimeout(async () => {
          try {
            await loadCodes();
            resolve();
          } catch (error) {
            reject(error);
          }
        }, 200);
      });
      
      // Double-check: if the code still appears, filter it out
      setCodes(prevCodes => {
        const filtered = prevCodes.filter(c => c.id !== deletedCodeId);
        if (filtered.length !== prevCodes.length) {
          console.warn('[Delete Discount Code] Filtered out deleted code from state:', deletedCodeId);
        }
        return filtered;
      });
      
      alert('Discount code deleted successfully!');
    } catch (err: any) {
      console.error('[Delete Discount Code] Error:', err);
      alert(err.message || 'Failed to delete discount code');
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

  const isExpired = (code: DiscountCode) => {
    if (!code.expires_at) return false;
    return new Date(code.expires_at) < new Date();
  };

  const getStatusBadge = (code: DiscountCode) => {
    if (code.used) {
      return <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">Used</span>;
    }
    if (isExpired(code)) {
      return <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">Expired</span>;
    }
    return <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Active</span>;
  };

  // Separate codes into active and used
  const activeCodes = codes.filter(code => !code.used);
  const usedCodes = codes.filter(code => code.used);

  const handleViewBooking = async (code: DiscountCode) => {
    const usage = usageDetails[code.id];
    const bookingId = usage?.booking_id || code.booking_id;
    
    if (!bookingId) {
      alert('No booking ID found for this discount code');
      return;
    }

    try {
      setLoadingBooking(true);
      const response = await fetch(`/api/admin/bookings/${encodeURIComponent(bookingId)}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        alert(errorData.error || 'Failed to load booking details');
        return;
      }
      
      const data = await response.json();
      
      if (data.success && data.booking) {
        setSelectedBooking(data.booking);
        setShowBookingModal(true);
      } else {
        alert('Booking not found');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to load booking details');
    } finally {
      setLoadingBooking(false);
    }
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
        <p className="text-red-800">Error loading discount codes: {error.message}</p>
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
          <h3 className="text-base md:text-lg font-semibold text-charcoal">Discount Codes</h3>
          <p className="text-xs md:text-sm text-warm-gray mt-1">
            Manage discount codes for customers
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-sand rounded-lg overflow-hidden">
        <div className="flex border-b border-sand">
          <button
            onClick={() => setActiveTab('one-time')}
            className={`flex-1 px-6 py-3 font-medium text-sm transition-colors ${
              activeTab === 'one-time'
                ? 'text-dark-sage border-b-2 border-dark-sage bg-sage-light/30'
                : 'text-warm-gray hover:text-charcoal hover:bg-sand/20'
            }`}
          >
            One-Time Codes
          </button>
          <button
            onClick={() => setActiveTab('global')}
            className={`flex-1 px-6 py-3 font-medium text-sm transition-colors ${
              activeTab === 'global'
                ? 'text-dark-sage border-b-2 border-dark-sage bg-sage-light/30'
                : 'text-warm-gray hover:text-charcoal hover:bg-sand/20'
            }`}
          >
            Global Codes
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'one-time' ? (
        <div className="space-y-4">
          {/* One-Time Codes Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0">
            <div>
              <h4 className="text-base md:text-md font-semibold text-charcoal">One-Time Discount Codes</h4>
              <p className="text-xs md:text-sm text-warm-gray mt-1">
                Manage one-time discount codes for individual customers
              </p>
            </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              // Hard refresh: clear everything first
              setCodes([]);
              setUsageDetails({});
              setError(null);
              await loadCodes();
            }}
            className="px-3 md:px-4 py-2 bg-sand/30 text-charcoal rounded-lg hover:bg-sand/50 transition-colors flex items-center gap-2 text-xs md:text-sm min-h-[44px]"
            title="Hard refresh - clears cache and reloads"
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
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-sage-light/20">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Code</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Customer</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Discount</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Expires</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Usage</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand">
                  {activeCodes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-warm-gray">
                        No active discount codes found
                      </td>
                    </tr>
                  ) : (
                    activeCodes.map((code) => {
                      const usage = usageDetails[code.id];
                      return (
                        <tr key={code.id} className="hover:bg-sand/10">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Tag className="w-4 h-4 text-dark-sage" />
                              <span className="font-mono font-semibold text-charcoal">{code.code}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-charcoal">
                            {code.customer_name || code.customer_email || 'General'}
                          </td>
                          <td className="px-4 py-3 text-sm text-charcoal">
                            {code.discount_type === 'percent' 
                              ? `${code.discount_value}%${code.discount_cap ? ` (up to $${code.discount_cap})` : ''}` 
                              : `$${code.discount_value}`}
                          </td>
                          <td className="px-4 py-3">
                            {getStatusBadge(code)}
                          </td>
                          <td className="px-4 py-3 text-sm text-charcoal">
                            {formatDate(code.expires_at)}
                          </td>
                          <td className="px-4 py-3 text-sm text-charcoal">
                            <span className="text-warm-gray">Not used</span>
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
                              {code.expires_at && (
                                <button
                                  onClick={() => {
                                    setSelectedCode(code);
                                    setShowExtendModal(true);
                                  }}
                                  className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 flex items-center gap-1"
                                  title="Extend expiry"
                                >
                                  <Calendar className="w-3 h-3" />
                                  Extend
                                </button>
                              )}
                              <button
                                onClick={() => handleLock(code.id, !isExpired(code))}
                                className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${
                                  isExpired(code)
                                    ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                    : 'bg-red-100 text-red-800 hover:bg-red-200'
                                }`}
                                title={isExpired(code) ? 'Unlock code (extend by 30 days)' : 'Lock code (set to expired)'}
                              >
                                {isExpired(code) ? (
                                  <>
                                    <Unlock className="w-3 h-3" />
                                    Unlock
                                  </>
                                ) : (
                                  <>
                                    <Lock className="w-3 h-3" />
                                    Lock
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedCode(code);
                                  setShowDeleteModal(true);
                                }}
                                className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 flex items-center gap-1"
                                title="Delete code"
                              >
                                <Trash2 className="w-3 h-3" />
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-2 p-2">
              {activeCodes.length === 0 ? (
                <div className="text-center py-8 text-warm-gray text-sm">
                  No active discount codes found
                </div>
              ) : (
                activeCodes.map((code) => (
                  <div key={code.id} className="bg-white border border-sand rounded-lg p-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-dark-sage" />
                        <span className="font-mono font-semibold text-sm text-charcoal">{code.code}</span>
                        {getStatusBadge(code)}
                      </div>
                      <div className="text-xs text-charcoal">
                        <div><strong>Customer:</strong> {code.customer_name || code.customer_email || 'General'}</div>
                        <div><strong>Discount:</strong> {code.discount_type === 'percent' 
                          ? `${code.discount_value}%${code.discount_cap ? ` (up to $${code.discount_cap})` : ''}` 
                          : `$${code.discount_value}`}</div>
                        <div><strong>Expires:</strong> {formatDate(code.expires_at)}</div>
                        <div className="text-warm-gray">Not used</div>
                      </div>
                      <div className="pt-2 border-t border-sand/50 flex flex-wrap gap-2">
                        <button
                          onClick={() => handleEdit(code)}
                          className="px-2 py-1.5 text-xs bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 flex items-center gap-1 min-h-[44px]"
                          title="Edit code"
                        >
                          <Edit className="w-3 h-3" />
                          Edit
                        </button>
                        {code.expires_at && (
                          <button
                            onClick={() => {
                              setSelectedCode(code);
                              setShowExtendModal(true);
                            }}
                            className="px-2 py-1.5 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 flex items-center gap-1 min-h-[44px]"
                            title="Extend expiry"
                          >
                            <Calendar className="w-3 h-3" />
                            Extend
                          </button>
                        )}
                        <button
                          onClick={() => handleLock(code.id, !isExpired(code))}
                          className={`px-2 py-1.5 text-xs rounded flex items-center gap-1 min-h-[44px] ${
                            isExpired(code)
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-red-100 text-red-800 hover:bg-red-200'
                          }`}
                          title={isExpired(code) ? 'Unlock code (extend by 30 days)' : 'Lock code (set to expired)'}
                        >
                          {isExpired(code) ? (
                            <>
                              <Unlock className="w-3 h-3" />
                              Unlock
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3" />
                              Lock
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedCode(code);
                            setShowDeleteModal(true);
                          }}
                          className="px-2 py-1.5 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 flex items-center gap-1 min-h-[44px]"
                          title="Delete code"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Used Codes Section */}
      <div className="bg-white border border-sand rounded-lg overflow-hidden">
        <button
          onClick={() => setUsedSectionOpen(!usedSectionOpen)}
          className="w-full px-4 py-3 bg-sage-light/30 hover:bg-sage-light/40 transition-colors flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-semibold">Used</span>
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
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-sage-light/20">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Code</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Customer</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Discount</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Expires</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Usage</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand">
                  {usedCodes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-warm-gray">
                        No used discount codes found
                      </td>
                    </tr>
                  ) : (
                    usedCodes.map((code) => {
                      const usage = usageDetails[code.id];
                      return (
                        <tr key={code.id} className="hover:bg-sand/10">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Tag className="w-4 h-4 text-dark-sage" />
                              <span className="font-mono font-semibold text-charcoal">{code.code}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-charcoal">
                            {code.customer_name || code.customer_email || 'General'}
                          </td>
                          <td className="px-4 py-3 text-sm text-charcoal">
                            {code.discount_type === 'percent' 
                              ? `${code.discount_value}%${code.discount_cap ? ` (up to $${code.discount_cap})` : ''}` 
                              : `$${code.discount_value}`}
                          </td>
                          <td className="px-4 py-3">
                            {getStatusBadge(code)}
                          </td>
                          <td className="px-4 py-3 text-sm text-charcoal">
                            {formatDate(code.expires_at)}
                          </td>
                          <td className="px-4 py-3 text-sm text-charcoal">
                            {usage ? (
                              <div className="space-y-1">
                                <div className="font-medium">{usage.customer_name}</div>
                                <div className="text-xs text-warm-gray">
                                  {usage.service_name} • {formatDate(usage.booking_date)}
                                </div>
                                <div className="text-xs text-warm-gray">
                                  Used: {formatDate(usage.used_at)}
                                </div>
                              </div>
                            ) : (
                              <span className="text-warm-gray">Used</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {usage?.booking_id || code.booking_id ? (
                              <button
                                onClick={() => handleViewBooking(code)}
                                disabled={loadingBooking}
                                className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                title="View booking details"
                              >
                                <Eye className="w-3 h-3" />
                                {loadingBooking ? 'Loading...' : 'View Booking'}
                              </button>
                            ) : (
                              <span className="text-xs text-warm-gray">No booking</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-2 p-2">
              {usedCodes.length === 0 ? (
                <div className="text-center py-8 text-warm-gray text-sm">
                  No used discount codes found
                </div>
              ) : (
                usedCodes.map((code) => {
                  const usage = usageDetails[code.id];
                  return (
                    <div key={code.id} className="bg-white border border-sand rounded-lg p-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-dark-sage" />
                          <span className="font-mono font-semibold text-sm text-charcoal">{code.code}</span>
                          {getStatusBadge(code)}
                        </div>
                        <div className="text-xs text-charcoal">
                          <div><strong>Customer:</strong> {code.customer_name || code.customer_email || 'General'}</div>
                          <div><strong>Discount:</strong> {code.discount_type === 'percent' 
                            ? `${code.discount_value}%${code.discount_cap ? ` (up to $${code.discount_cap})` : ''}` 
                            : `$${code.discount_value}`}</div>
                          <div><strong>Expires:</strong> {formatDate(code.expires_at)}</div>
                          {usage ? (
                            <div className="mt-1 space-y-0.5">
                              <div><strong>Used by:</strong> {usage.customer_name}</div>
                              <div className="text-warm-gray">{usage.service_name} • {formatDate(usage.booking_date)}</div>
                              <div className="text-warm-gray">Used: {formatDate(usage.used_at)}</div>
                            </div>
                          ) : (
                            <div className="text-warm-gray">Used</div>
                          )}
                        </div>
                        {usage?.booking_id || code.booking_id ? (
                          <div className="pt-2 border-t border-sand/50">
                            <button
                              onClick={() => handleViewBooking(code)}
                              disabled={loadingBooking}
                              className="w-full px-2 py-1.5 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 min-h-[44px]"
                              title="View booking details"
                            >
                              <Eye className="w-3 h-3" />
                              {loadingBooking ? 'Loading...' : 'View Booking'}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>

      {/* Booking Detail Modal */}
      {showBookingModal && selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          isOpen={showBookingModal}
          onClose={() => {
            setShowBookingModal(false);
            setSelectedBooking(null);
          }}
          onRefresh={() => {
            // Refresh discount codes when booking is updated
            loadCodes();
          }}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[60] bg-charcoal/80 backdrop-blur-sm md:flex md:items-center md:justify-center md:p-4">
          <div className="bg-white h-full md:h-auto md:rounded-lg md:max-w-md md:w-full md:shadow-xl flex flex-col">
            <div className="p-4 md:p-6 flex-1 overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg md:text-xl font-semibold text-charcoal">Create Discount Code</h3>
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
                    Customer Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={createForm.customerEmail}
                    onChange={(e) => setCreateForm({ ...createForm, customerEmail: e.target.value })}
                    className="w-full px-3 py-3 md:py-2 border border-sage-dark/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage text-sm"
                    placeholder="customer@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-charcoal mb-2">
                    Discount Type <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-col md:flex-row gap-2">
                    <button
                      onClick={() => setCreateForm({ ...createForm, discountType: 'percent' })}
                      className={`flex-1 px-4 py-3 md:py-2 rounded-lg transition-colors text-sm min-h-[44px] ${
                        createForm.discountType === 'percent'
                          ? 'bg-dark-sage text-white'
                          : 'bg-sand/30 text-charcoal hover:bg-sand/50'
                      }`}
                    >
                      Percentage
                    </button>
                    <button
                      onClick={() => setCreateForm({ ...createForm, discountType: 'dollar' })}
                      className={`flex-1 px-4 py-3 md:py-2 rounded-lg transition-colors text-sm min-h-[44px] ${
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
                      className="flex-1 px-3 py-3 md:py-2 border border-sage-dark/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage text-sm"
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
                        className="flex-1 px-3 py-3 md:py-2 border border-sage-dark/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage text-sm"
                        placeholder="40 (e.g., 15% off up to $40)"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <p className="text-xs text-warm-gray mt-1">
                      Optional: Cap the discount at a maximum dollar amount. Example: 15% off up to $40.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-charcoal mb-2">
                    Expires In (Days) <span className="text-warm-gray text-xs">(optional)</span>
                  </label>
                  <input
                    type="number"
                    value={createForm.expiresInDays}
                    onChange={(e) => setCreateForm({ ...createForm, expiresInDays: e.target.value })}
                    className="w-full px-3 py-3 md:py-2 border border-sage-dark/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage text-sm"
                    placeholder="30 (leave empty for no expiry)"
                    min="1"
                  />
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
                  disabled={!createForm.customerEmail || !createForm.discountValue}
                  className="flex-1 px-4 py-3 md:py-2 bg-dark-sage text-white rounded-lg hover:bg-dark-sage/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm min-h-[44px]"
                >
                  Create & Email
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Extend Modal */}
      {showExtendModal && selectedCode && (
        <div className="fixed inset-0 z-[60] bg-charcoal/80 backdrop-blur-sm md:flex md:items-center md:justify-center md:p-4">
          <div className="bg-white h-full md:h-auto md:rounded-lg md:max-w-md md:w-full md:shadow-xl flex flex-col">
            <div className="p-4 md:p-6 flex-1 overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg md:text-xl font-semibold text-charcoal">Extend Expiry</h3>
                <button
                  onClick={() => {
                    setShowExtendModal(false);
                    setSelectedCode(null);
                    setExtendDays('');
                  }}
                  className="p-1 hover:bg-sand/30 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <X className="w-5 h-5 text-charcoal" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-warm-gray mb-2">
                    Code: <span className="font-mono font-semibold text-charcoal">{selectedCode.code}</span>
                  </p>
                  <p className="text-sm text-warm-gray">
                    Current expiry: {formatDate(selectedCode.expires_at)}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-charcoal mb-2">
                    Extend by (Days) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={extendDays}
                    onChange={(e) => setExtendDays(e.target.value)}
                    className="w-full px-3 py-3 md:py-2 border border-sage-dark/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage text-sm"
                    placeholder="30"
                    min="1"
                  />
                </div>
              </div>
            </div>
            <div className="p-4 md:p-6 border-t border-sand md:border-t-0">
              <div className="flex flex-col md:flex-row gap-3">
                <button
                  onClick={() => {
                    setShowExtendModal(false);
                    setSelectedCode(null);
                    setExtendDays('');
                  }}
                  className="flex-1 px-4 py-3 md:py-2 bg-sand/30 text-charcoal rounded-lg hover:bg-sand/50 transition-colors font-medium text-sm min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExtend}
                  disabled={!extendDays}
                  className="flex-1 px-4 py-3 md:py-2 bg-dark-sage text-white rounded-lg hover:bg-dark-sage/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm min-h-[44px]"
                >
                  Extend
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedCode && (
        <div className="fixed inset-0 z-[60] bg-charcoal/80 backdrop-blur-sm md:flex md:items-center md:justify-center md:p-4">
          <div className="bg-white h-full md:h-auto md:rounded-lg md:max-w-md md:w-full md:shadow-xl flex flex-col">
            <div className="p-4 md:p-6 flex-1 overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg md:text-xl font-semibold text-charcoal">Edit Discount Code</h3>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedCode(null);
                  }}
                  className="p-1 hover:bg-sand/30 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
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

                <div>
                  <label className="block text-sm font-medium text-charcoal mb-2">
                    Discount Type <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-col md:flex-row gap-2">
                    <button
                      onClick={() => setEditForm({ ...editForm, discountType: 'percent' })}
                      className={`flex-1 px-4 py-3 md:py-2 rounded-lg transition-colors text-sm min-h-[44px] ${
                        editForm.discountType === 'percent'
                          ? 'bg-dark-sage text-white'
                          : 'bg-sand/30 text-charcoal hover:bg-sand/50'
                      }`}
                    >
                      Percentage
                    </button>
                    <button
                      onClick={() => setEditForm({ ...editForm, discountType: 'dollar' })}
                      className={`flex-1 px-4 py-3 md:py-2 rounded-lg transition-colors text-sm min-h-[44px] ${
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
                        placeholder="40 (e.g., 15% off up to $40)"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-charcoal mb-2">
                    Expires In (Days) <span className="text-warm-gray text-xs">(optional)</span>
                  </label>
                  <input
                    type="number"
                    value={editForm.expiresInDays}
                    onChange={(e) => setEditForm({ ...editForm, expiresInDays: e.target.value })}
                    className="w-full px-3 py-2 border border-sage-dark/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage"
                    placeholder="30 (leave empty for no expiry)"
                    min="1"
                  />
                </div>

              </div>
            </div>
            <div className="p-4 md:p-6 border-t border-sand md:border-t-0">
              <div className="flex flex-col md:flex-row gap-3">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedCode(null);
                  }}
                  className="flex-1 px-4 py-3 md:py-2 bg-sand/30 text-charcoal rounded-lg hover:bg-sand/50 transition-colors font-medium text-sm min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdate}
                  disabled={!editForm.discountValue}
                  className="flex-1 px-4 py-3 md:py-2 bg-dark-sage text-white rounded-lg hover:bg-dark-sage/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm min-h-[44px]"
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedCode && (
        <div className="fixed inset-0 z-[60] bg-charcoal/80 backdrop-blur-sm md:flex md:items-center md:justify-center md:p-4">
          <div className="bg-white h-full md:h-auto md:rounded-lg md:max-w-md md:w-full md:shadow-xl flex flex-col">
            <div className="p-4 md:p-6 flex-1 overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg md:text-xl font-semibold text-charcoal">Delete Discount Code</h3>
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedCode(null);
                  }}
                  className="p-1 hover:bg-sand/30 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <X className="w-5 h-5 text-charcoal" />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-warm-gray">
                  Are you sure you want to delete discount code <span className="font-mono font-semibold text-charcoal">{selectedCode.code}</span>?
                </p>
                {selectedCode.used && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-800">
                      ⚠️ This code has already been used and cannot be deleted from the website. Used codes can only be deleted directly in Neon.
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 md:p-6 border-t border-sand md:border-t-0">
              <div className="flex flex-col md:flex-row gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedCode(null);
                  }}
                  className="flex-1 px-4 py-3 md:py-2 bg-sand/30 text-charcoal rounded-lg hover:bg-sand/50 transition-colors font-medium text-sm min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={selectedCode.used}
                  className="flex-1 px-4 py-3 md:py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm min-h-[44px]"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
        </div>
      ) : (
        <GlobalCodesManager />
      )}
    </div>
  );
}


