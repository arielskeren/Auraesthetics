'use client';

import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Search, UserCircle, Mail, Phone, CheckCircle, XCircle, Upload, Users } from 'lucide-react';
import LoadingState from './LoadingState';
import ErrorDisplay from './ErrorDisplay';

type ViewMode = 'neon' | 'brevo' | 'matched' | 'unmatched';

export default function ClientsManager() {
  const [viewMode, setViewMode] = useState<ViewMode>('neon');
  const [neonCustomers, setNeonCustomers] = useState<any[]>([]);
  const [brevoContacts, setBrevoContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [syncingToBrevo, setSyncingToBrevo] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    total: number;
    synced: number;
    pending: number;
  } | null>(null);

  useEffect(() => {
    loadData();
    loadSyncStatus();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load both Neon and Brevo data simultaneously
      const [neonResponse, brevoResponse] = await Promise.all([
        fetch('/api/admin/customers?limit=1000'),
        fetch('/api/admin/brevo/clients?limit=1000'),
      ]);

      if (!neonResponse.ok) {
        throw new Error('Failed to load Neon customers');
      }
      if (!brevoResponse.ok) {
        throw new Error('Failed to load Brevo contacts');
      }

      const neonData = await neonResponse.json();
      const brevoData = await brevoResponse.json();

      setNeonCustomers(neonData.customers || []);
      setBrevoContacts(brevoData.contacts || []);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const loadSyncStatus = async () => {
    try {
      const response = await fetch('/api/admin/customers/sync-all');
      if (response.ok) {
        const data = await response.json();
        setSyncStatus(data);
      }
    } catch (err) {
      // Non-critical - just don't show status
      console.error('Failed to load sync status:', err);
    }
  };

  const handleSyncToBrevo = async (customerId: string) => {
    try {
      setSyncingToBrevo(customerId);
      setError(null);

      const response = await fetch(`/api/admin/customers/${customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncToBrevo: true }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync to Brevo');
      }

      // Reload data and status
      await Promise.all([loadData(), loadSyncStatus()]);
      alert('Customer synced to Brevo successfully');
    } catch (err: any) {
      setError(err);
      alert(`Sync failed: ${err.message}`);
    } finally {
      setSyncingToBrevo(null);
    }
  };

  const handleSyncAll = async () => {
    if (!confirm(`Sync all ${syncStatus?.pending || 0} pending customers to Brevo? This may take a few minutes.`)) {
      return;
    }

    try {
      setSyncingAll(true);
      setError(null);

      const response = await fetch('/api/admin/customers/sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync all customers');
      }

      const result = await response.json();
      
      // Reload data and status
      await Promise.all([loadData(), loadSyncStatus()]);
      
      alert(`Sync complete! ${result.synced} synced, ${result.failed} failed.`);
    } catch (err: any) {
      setError(err);
      alert(`Sync failed: ${err.message}`);
    } finally {
      setSyncingAll(false);
    }
  };

  // Create a map of Brevo contacts by email for quick lookup
  const brevoByEmail = useMemo(() => {
    const map = new Map<string, any>();
    brevoContacts.forEach((contact) => {
      if (contact.email) {
        map.set(contact.email.toLowerCase(), contact);
      }
    });
    return map;
  }, [brevoContacts]);

  // Calculate matched and unmatched records
  const { matchedRecords, unmatchedNeon, unmatchedBrevo } = useMemo(() => {
    const matched: Array<{ neon: any; brevo: any }> = [];
    const unmatchedN: any[] = [];
    const unmatchedB: any[] = [...brevoContacts];

    neonCustomers.forEach((neon) => {
      if (neon.email) {
        const brevo = brevoByEmail.get(neon.email.toLowerCase());
        if (brevo) {
          matched.push({ neon, brevo });
          // Remove from unmatchedBrevo
          const index = unmatchedB.findIndex((b) => b.email?.toLowerCase() === neon.email.toLowerCase());
          if (index >= 0) {
            unmatchedB.splice(index, 1);
          }
        } else {
          unmatchedN.push(neon);
        }
      }
    });

    return {
      matchedRecords: matched,
      unmatchedNeon: unmatchedN,
      unmatchedBrevo: unmatchedB,
    };
  }, [neonCustomers, brevoContacts, brevoByEmail]);

  const filteredData = useMemo(() => {
    let data: any[] = [];

    switch (viewMode) {
      case 'neon':
        data = neonCustomers;
        break;
      case 'brevo':
        data = brevoContacts;
        break;
      case 'matched':
        data = matchedRecords.map((m) => ({
          ...m.neon,
          brevoId: m.brevo.id,
          brevoName: `${m.brevo.firstName || ''} ${m.brevo.lastName || ''}`.trim(),
          inBrevo: true,
        }));
        break;
      case 'unmatched':
        data = unmatchedNeon.map((n) => ({
          ...n,
          inBrevo: false,
        }));
        break;
    }

    if (!searchQuery.trim()) return data;

    const query = searchQuery.toLowerCase();
    return data.filter((item: any) => {
      const email = (item.email || '').toLowerCase();
      const firstName = (item.first_name || item.firstName || '').toLowerCase();
      const lastName = (item.last_name || item.lastName || '').toLowerCase();
      const phone = (item.phone || '').toLowerCase();
      
      return email.includes(query) || 
             firstName.includes(query) || 
             lastName.includes(query) || 
             phone.includes(query);
    });
  }, [viewMode, neonCustomers, brevoContacts, matchedRecords, unmatchedNeon, searchQuery]);

  if (loading) {
    return <LoadingState message="Loading clients..." />;
  }

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  return (
    <div className="space-y-4">
      {/* Header with View Mode Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-charcoal">
            {viewMode === 'neon' && 'Neon Customers (Source of Truth)'}
            {viewMode === 'brevo' && 'Brevo Contacts'}
            {viewMode === 'matched' && 'Matched Records (Neon ↔ Brevo)'}
            {viewMode === 'unmatched' && 'Unmatched Neon Customers'}
          </h2>
          <p className="text-sm text-warm-gray mt-1">
            {viewMode === 'neon' && 'Viewing customers from Neon database (source of truth)'}
            {viewMode === 'brevo' && 'Viewing contacts from Brevo email marketing platform'}
            {viewMode === 'matched' && `Showing ${matchedRecords.length} customers that exist in both Neon and Brevo`}
            {viewMode === 'unmatched' && `Showing ${unmatchedNeon.length} Neon customers not yet in Brevo (need sync)`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="px-4 py-2 bg-sand/30 text-charcoal rounded-lg hover:bg-sand/50 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="flex items-center gap-2 border-b border-sand">
        <button
          onClick={() => setViewMode('neon')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            viewMode === 'neon'
              ? 'border-dark-sage text-dark-sage'
              : 'border-transparent text-warm-gray hover:text-charcoal'
          }`}
        >
          Neon ({neonCustomers.length})
        </button>
        <button
          onClick={() => setViewMode('brevo')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            viewMode === 'brevo'
              ? 'border-dark-sage text-dark-sage'
              : 'border-transparent text-warm-gray hover:text-charcoal'
          }`}
        >
          Brevo ({brevoContacts.length})
        </button>
        <button
          onClick={() => setViewMode('matched')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            viewMode === 'matched'
              ? 'border-dark-sage text-dark-sage'
              : 'border-transparent text-warm-gray hover:text-charcoal'
          }`}
        >
          Matched ({matchedRecords.length})
        </button>
        <button
          onClick={() => setViewMode('unmatched')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            viewMode === 'unmatched'
              ? 'border-dark-sage text-dark-sage'
              : 'border-transparent text-warm-gray hover:text-charcoal'
          }`}
        >
          Unmatched ({unmatchedNeon.length})
        </button>
      </div>

      {/* Sync Status and Actions */}
      {viewMode === 'unmatched' && syncStatus && (
        <div className="bg-sage-light/30 border border-sage-dark/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-charcoal">
                Sync Status: {syncStatus.synced} of {syncStatus.total} customers synced to Brevo
              </p>
              <p className="text-xs text-warm-gray mt-1">
                {syncStatus.pending} pending sync (customers with marketing opt-in)
              </p>
            </div>
            <button
              onClick={handleSyncAll}
              disabled={syncingAll || syncStatus.pending === 0}
              className="px-4 py-2 bg-dark-sage text-white rounded-lg hover:bg-dark-sage/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {syncingAll ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Sync All to Brevo
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-warm-gray" />
          <input
            type="text"
            placeholder="Search by email, name, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-sage-dark/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-sand rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-sage-light/30">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Email</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Phone</th>
                {viewMode === 'neon' && (
                  <>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Marketing Opt-In</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Used Welcome Offer</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">In Brevo</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Actions</th>
                  </>
                )}
                {viewMode === 'brevo' && (
                  <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Brevo ID</th>
                )}
                {viewMode === 'matched' && (
                  <>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Marketing Opt-In</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Brevo ID</th>
                  </>
                )}
                {viewMode === 'unmatched' && (
                  <>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Marketing Opt-In</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Actions</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-sand">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={viewMode === 'neon' ? 7 : viewMode === 'brevo' ? 4 : viewMode === 'matched' ? 5 : 5} className="px-4 py-8 text-center text-warm-gray">
                    No clients found
                  </td>
                </tr>
              ) : (
                filteredData.map((item: any) => (
                  <tr key={item.id || item.email} className="hover:bg-sand/10">
                    <td className="px-4 py-3 text-sm text-charcoal">{item.email || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-charcoal">
                      {viewMode === 'brevo'
                        ? `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'N/A'
                        : `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-charcoal">{item.phone || 'N/A'}</td>
                    {viewMode === 'neon' && (
                      <>
                        <td className="px-4 py-3 text-sm">
                          {item.marketing_opt_in ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <XCircle className="w-4 h-4 text-gray-400" />
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {item.used_welcome_offer ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <XCircle className="w-4 h-4 text-gray-400" />
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {brevoByEmail.has(item.email?.toLowerCase() || '') ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <XCircle className="w-4 h-4 text-gray-400" />
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {item.marketing_opt_in && (
                            <button
                              onClick={() => handleSyncToBrevo(item.id)}
                              disabled={syncingToBrevo === item.id || brevoByEmail.has(item.email?.toLowerCase() || '')}
                              className="px-3 py-1 bg-dark-sage text-white rounded hover:bg-dark-sage/80 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                            >
                              {syncingToBrevo === item.id ? 'Syncing...' : 'Push to Brevo'}
                            </button>
                          )}
                        </td>
                      </>
                    )}
                    {viewMode === 'brevo' && (
                      <td className="px-4 py-3 text-sm text-warm-gray font-mono text-xs">
                        {item.id}
                      </td>
                    )}
                    {viewMode === 'matched' && (
                      <>
                        <td className="px-4 py-3 text-sm">
                          {item.marketing_opt_in ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <XCircle className="w-4 h-4 text-gray-400" />
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-warm-gray font-mono text-xs">
                          {item.brevoId}
                        </td>
                      </>
                    )}
                    {viewMode === 'unmatched' && (
                      <>
                        <td className="px-4 py-3 text-sm">
                          {item.marketing_opt_in ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <XCircle className="w-4 h-4 text-gray-400" />
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {item.marketing_opt_in && (
                            <button
                              onClick={() => handleSyncToBrevo(item.id)}
                              disabled={syncingToBrevo === item.id}
                              className="px-3 py-1 bg-dark-sage text-white rounded hover:bg-dark-sage/80 disabled:opacity-50 text-xs"
                            >
                              {syncingToBrevo === item.id ? 'Syncing...' : 'Push to Brevo'}
                            </button>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="text-sm text-warm-gray">
        Showing {filteredData.length} of {
          viewMode === 'neon' ? neonCustomers.length :
          viewMode === 'brevo' ? brevoContacts.length :
          viewMode === 'matched' ? matchedRecords.length :
          unmatchedNeon.length
        } clients
        {viewMode === 'unmatched' && syncStatus && (
          <span className="ml-2">
            ({syncStatus.pending} pending sync)
          </span>
        )}
      </div>
    </div>
  );
}
