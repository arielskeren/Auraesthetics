'use client';

import { useState, useEffect } from 'react';
import { Plus, RefreshCw, Lock, Unlock, Calendar, User, DollarSign, Tag, X } from 'lucide-react';

interface DiscountCode {
  id: string;
  code: string;
  customer_id: string | null;
  customer_email?: string | null;
  customer_name?: string | null;
  discount_type: 'percent' | 'dollar';
  discount_value: number;
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

export default function DiscountCodesManager() {
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [selectedCode, setSelectedCode] = useState<DiscountCode | null>(null);
  const [usageDetails, setUsageDetails] = useState<Record<string, UsageDetails>>({});
  
  // Create form state
  const [createForm, setCreateForm] = useState({
    customerEmail: '',
    discountType: 'percent' as 'percent' | 'dollar',
    discountValue: '',
    expiresInDays: '',
  });

  // Extend form state
  const [extendDays, setExtendDays] = useState('');

  useEffect(() => {
    loadCodes();
  }, []);

  const loadCodes = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/discount-codes');
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
        return;
      }
      
      setCodes(data.codes || []);
      
      // Load usage details for used codes
      const usedCodes = (data.codes || []).filter((c: DiscountCode) => c.used);
      for (const code of usedCodes) {
        await loadUsageDetails(code.id);
      }
    } catch (err: any) {
      console.error('[DiscountCodesManager] Error loading codes:', err);
      setError(err);
      // Still set codes to empty array so UI doesn't break
      setCodes([]);
    } finally {
      setLoading(false);
    }
  };

  const loadUsageDetails = async (codeId: string) => {
    try {
      const response = await fetch(`/api/admin/discount-codes/${codeId}/usage`);
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
      setCreateForm({ customerEmail: '', discountType: 'percent', discountValue: '', expiresInDays: '' });
      loadCodes();
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
      loadCodes();
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

      loadCodes();
    } catch (err: any) {
      alert(err.message || 'Failed to update code status');
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
      return <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Used</span>;
    }
    if (isExpired(code)) {
      return <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">Expired</span>;
    }
    return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">Active</span>;
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
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-charcoal">Discount Codes</h3>
          <p className="text-sm text-warm-gray mt-1">
            Manage one-time discount codes for customers
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadCodes}
            className="px-4 py-2 bg-sand/30 text-charcoal rounded-lg hover:bg-sand/50 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-dark-sage text-white rounded-lg hover:bg-dark-sage/80 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Code
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-sand rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-sage-light/30">
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
              {codes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-warm-gray">
                    No discount codes found
                  </td>
                </tr>
              ) : (
                codes.map((code) => {
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
                          ? `${code.discount_value}%` 
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
                        ) : code.used ? (
                          <span className="text-warm-gray">Used</span>
                        ) : (
                          <span className="text-warm-gray">Not used</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {!code.used && code.expires_at && (
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
                          {!code.used && (
                            <button
                              onClick={() => handleLock(code.id, isExpired(code))}
                              className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${
                                isExpired(code)
                                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                  : 'bg-red-100 text-red-800 hover:bg-red-200'
                              }`}
                              title={isExpired(code) ? 'Unlock code' : 'Lock code'}
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
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-charcoal/80 backdrop-blur-sm">
          <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-charcoal">Create Discount Code</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 hover:bg-sand/30 rounded-full transition-colors"
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
                    className="w-full px-3 py-2 border border-sage-dark/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage"
                    placeholder="customer@example.com"
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

                <div>
                  <label className="block text-sm font-medium text-charcoal mb-2">
                    Expires In (Days) <span className="text-warm-gray text-xs">(optional)</span>
                  </label>
                  <input
                    type="number"
                    value={createForm.expiresInDays}
                    onChange={(e) => setCreateForm({ ...createForm, expiresInDays: e.target.value })}
                    className="w-full px-3 py-2 border border-sage-dark/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage"
                    placeholder="30 (leave empty for no expiry)"
                    min="1"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 bg-sand/30 text-charcoal rounded-lg hover:bg-sand/50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={!createForm.customerEmail || !createForm.discountValue}
                    className="flex-1 px-4 py-2 bg-dark-sage text-white rounded-lg hover:bg-dark-sage/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    Create & Email
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Extend Modal */}
      {showExtendModal && selectedCode && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-charcoal/80 backdrop-blur-sm">
          <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-charcoal">Extend Expiry</h3>
                <button
                  onClick={() => {
                    setShowExtendModal(false);
                    setSelectedCode(null);
                    setExtendDays('');
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
                    className="w-full px-3 py-2 border border-sage-dark/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage"
                    placeholder="30"
                    min="1"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setShowExtendModal(false);
                      setSelectedCode(null);
                      setExtendDays('');
                    }}
                    className="flex-1 px-4 py-2 bg-sand/30 text-charcoal rounded-lg hover:bg-sand/50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExtend}
                    disabled={!extendDays}
                    className="flex-1 px-4 py-2 bg-dark-sage text-white rounded-lg hover:bg-dark-sage/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    Extend
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

