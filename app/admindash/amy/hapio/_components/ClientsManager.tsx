'use client';

import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Search, CheckCircle, XCircle, Upload, Download, AlertTriangle } from 'lucide-react';
import LoadingState from './LoadingState';
import ErrorDisplay from './ErrorDisplay';

type ViewMode = 'all' | 'matched' | 'unmatched';

interface UnifiedClient {
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  neonId: string | null;
  brevoId: string | null;
  marketingOptIn: boolean;
  usedWelcomeOffer: boolean;
  inNeon: boolean;
  inBrevo: boolean;
  hasMismatch: boolean; // Data differs between Neon and Brevo
  neonData?: any;
  brevoData?: any;
}

export default function ClientsManager() {
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [neonCustomers, setNeonCustomers] = useState<any[]>([]);
  const [brevoContacts, setBrevoContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [syncingToBrevo, setSyncingToBrevo] = useState<string | null>(null);
  const [syncingToNeon, setSyncingToNeon] = useState<string | null>(null);
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

  const handleSyncToNeon = async (brevoContactId: string) => {
    try {
      setSyncingToNeon(brevoContactId);
      setError(null);

      const response = await fetch(`/api/admin/brevo/clients/${brevoContactId}/sync-to-neon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync to Neon');
      }

      // Reload data and status
      await Promise.all([loadData(), loadSyncStatus()]);
      alert('Contact synced to Neon successfully');
    } catch (err: any) {
      setError(err);
      alert(`Sync failed: ${err.message}`);
    } finally {
      setSyncingToNeon(null);
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

  // Create unified client list with both Neon and Brevo data
  const unifiedClients = useMemo(() => {
    const clientsMap = new Map<string, UnifiedClient>();

    // Add all Neon customers
    neonCustomers.forEach((neon) => {
      if (neon.email) {
        const emailLower = neon.email.toLowerCase();
        clientsMap.set(emailLower, {
          email: neon.email,
          firstName: neon.first_name || '',
          lastName: neon.last_name || '',
          phone: neon.phone || null,
          neonId: neon.id,
          brevoId: neon.brevo_contact_id || null,
          marketingOptIn: neon.marketing_opt_in || false,
          usedWelcomeOffer: neon.used_welcome_offer || false,
          inNeon: true,
          inBrevo: !!neon.brevo_contact_id,
          hasMismatch: false,
          neonData: neon,
        });
      }
    });

    // Add/merge Brevo contacts
    brevoContacts.forEach((brevo) => {
      if (brevo.email) {
        const emailLower = brevo.email.toLowerCase();
        const existing = clientsMap.get(emailLower);
        
        if (existing) {
          // Merge with existing Neon record
          existing.brevoId = brevo.id;
          existing.inBrevo = true;
          existing.brevoData = brevo;
          
          // Check for mismatches (display Neon data, but highlight if different)
          const nameMatch = 
            (existing.firstName || '').toLowerCase() === (brevo.firstName || '').toLowerCase() &&
            (existing.lastName || '').toLowerCase() === (brevo.lastName || '').toLowerCase();
          const phoneMatch = 
            (existing.phone || '').replace(/\D/g, '') === (brevo.phone || '').replace(/\D/g, '');
          
          existing.hasMismatch = !nameMatch || !phoneMatch;
        } else {
          // Brevo-only contact
          clientsMap.set(emailLower, {
            email: brevo.email,
            firstName: brevo.firstName || '',
            lastName: brevo.lastName || '',
            phone: brevo.phone || null,
            neonId: null,
            brevoId: brevo.id,
            marketingOptIn: !brevo.emailBlacklisted,
            usedWelcomeOffer: brevo.usedWelcomeOffer || false,
            inNeon: false,
            inBrevo: true,
            hasMismatch: false,
            brevoData: brevo,
          });
        }
      }
    });

    return Array.from(clientsMap.values()).sort((a, b) => {
      // Sort by email
      return a.email.localeCompare(b.email);
    });
  }, [neonCustomers, brevoContacts]);

  // Filter by view mode
  const filteredByMode = useMemo(() => {
    switch (viewMode) {
      case 'matched':
        return unifiedClients.filter(c => c.inNeon && c.inBrevo);
      case 'unmatched':
        return unifiedClients.filter(c => (c.inNeon && !c.inBrevo) || (!c.inNeon && c.inBrevo));
      case 'all':
      default:
        return unifiedClients;
    }
  }, [unifiedClients, viewMode]);

  // Apply search filter
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return filteredByMode;

    const query = searchQuery.toLowerCase();
    return filteredByMode.filter((client) => {
      const email = (client.email || '').toLowerCase();
      const firstName = (client.firstName || '').toLowerCase();
      const lastName = (client.lastName || '').toLowerCase();
      const phone = (client.phone || '').toLowerCase();
      
      return email.includes(query) || 
             firstName.includes(query) || 
             lastName.includes(query) ||
             phone.includes(query);
    });
  }, [filteredByMode, searchQuery]);

  // Calculate counts
  const matchedCount = unifiedClients.filter(c => c.inNeon && c.inBrevo).length;
  const unmatchedCount = unifiedClients.filter(c => (c.inNeon && !c.inBrevo) || (!c.inNeon && c.inBrevo)).length;
  const mismatchCount = unifiedClients.filter(c => c.hasMismatch).length;

  if (loading) {
    return <LoadingState message="Loading clients..." />;
  }

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-charcoal">Clients</h2>
          <p className="text-sm text-warm-gray mt-1">
            {viewMode === 'all' && `Showing all ${unifiedClients.length} clients (Neon and Brevo)`}
            {viewMode === 'matched' && `Showing ${matchedCount} clients in both Neon and Brevo`}
            {viewMode === 'unmatched' && `Showing ${unmatchedCount} clients not in both systems`}
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
          onClick={() => setViewMode('all')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            viewMode === 'all'
              ? 'border-dark-sage text-dark-sage'
              : 'border-transparent text-warm-gray hover:text-charcoal'
          }`}
        >
          All ({unifiedClients.length})
        </button>
        <button
          onClick={() => setViewMode('matched')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            viewMode === 'matched'
              ? 'border-dark-sage text-dark-sage'
              : 'border-transparent text-warm-gray hover:text-charcoal'
          }`}
        >
          Matched ({matchedCount})
        </button>
        <button
          onClick={() => setViewMode('unmatched')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            viewMode === 'unmatched'
              ? 'border-dark-sage text-dark-sage'
              : 'border-transparent text-warm-gray hover:text-charcoal'
          }`}
        >
          Unmatched ({unmatchedCount})
        </button>
      </div>

      {/* Mismatch Warning */}
      {mismatchCount > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600" />
            <p className="text-sm text-yellow-800">
              {mismatchCount} client{mismatchCount !== 1 ? 's' : ''} have data mismatches between Neon and Brevo. Rows are highlighted in yellow.
            </p>
          </div>
        </div>
      )}

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
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Neon ID</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Brevo ID</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Marketing Opt-In</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Used Welcome Offer</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-warm-gray">
                    No clients found
                  </td>
                </tr>
              ) : (
                filteredData.map((client) => (
                  <tr 
                    key={client.email} 
                    className={`hover:bg-sand/10 ${
                      client.hasMismatch ? 'bg-yellow-50/50' : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-sm text-charcoal">{client.email}</td>
                    <td className="px-4 py-3 text-sm text-charcoal">
                      {`${client.firstName} ${client.lastName}`.trim() || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-charcoal">{client.phone || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-warm-gray font-mono text-xs">
                      {client.neonId ? (
                        <span className="text-charcoal">{client.neonId}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-warm-gray font-mono text-xs">
                      {client.brevoId ? (
                        <span className="text-charcoal">{client.brevoId}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {client.marketingOptIn ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-gray-400" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {client.usedWelcomeOffer ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-gray-400" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        {client.inNeon && !client.inBrevo && client.marketingOptIn && (
                          <button
                            onClick={() => handleSyncToBrevo(client.neonId!)}
                            disabled={syncingToBrevo === client.neonId}
                            className="px-2 py-1 bg-dark-sage text-white rounded hover:bg-dark-sage/80 disabled:opacity-50 disabled:cursor-not-allowed text-xs flex items-center gap-1"
                            title="Sync to Brevo"
                          >
                            <Upload className="w-3 h-3" />
                            To Brevo
                          </button>
                        )}
                        {!client.inNeon && client.inBrevo && (
                          <button
                            onClick={() => handleSyncToNeon(client.brevoId!)}
                            disabled={syncingToNeon === client.brevoId}
                            className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs flex items-center gap-1"
                            title="Create in Neon from Brevo"
                          >
                            <Download className="w-3 h-3" />
                            To Neon
                          </button>
                        )}
                        {client.inNeon && client.inBrevo && client.hasMismatch && (
                          <button
                            onClick={() => handleSyncToBrevo(client.neonId!)}
                            disabled={syncingToBrevo === client.neonId}
                            className="px-2 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs flex items-center gap-1"
                            title="Sync Neon data to Brevo (fix mismatch)"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Fix Sync
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="text-sm text-warm-gray">
        Showing {filteredData.length} of {filteredByMode.length} clients
        {mismatchCount > 0 && (
          <span className="ml-2 text-yellow-700">
            ({mismatchCount} with data mismatches)
          </span>
        )}
      </div>
    </div>
  );
}
