'use client';

import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Search, CheckCircle, XCircle, Upload, Download, AlertTriangle, Edit, Trash2, X } from 'lucide-react';
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
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editing, setEditing] = useState<UnifiedClient | null>(null);
  const [viewingClient, setViewingClient] = useState<UnifiedClient | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    marketingOptIn: false,
  });
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
      
      // Clear state aggressively before loading to prevent stale data
      setNeonCustomers([]);
      setBrevoContacts([]);

      // Add cache-busting timestamp
      const timestamp = Date.now();

      // Load both Neon and Brevo data simultaneously with cache-busting
      const [neonResponse, brevoResponse] = await Promise.all([
        fetch(`/api/admin/customers?limit=1000&_t=${timestamp}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }),
        fetch(`/api/admin/brevo/clients?limit=1000&_t=${timestamp}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }),
      ]);

      if (!neonResponse.ok) {
        throw new Error('Failed to load Neon customers');
      }
      if (!brevoResponse.ok) {
        throw new Error('Failed to load Brevo contacts');
      }

      const neonData = await neonResponse.json();
      const brevoData = await brevoResponse.json();

      const neonCustomersList = neonData.customers || [];
      const brevoContactsList = brevoData.contacts || [];
      
      // Debug logging
      console.log('[ClientsManager] Loaded data:', {
        neonCount: neonCustomersList.length,
        brevoCount: brevoContactsList.length,
        neonEmails: neonCustomersList.map((c: any) => c.email),
        brevoEmails: brevoContactsList.map((c: any) => c.email),
      });

      setNeonCustomers(neonCustomersList);
      setBrevoContacts(brevoContactsList);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const loadSyncStatus = async () => {
    try {
      const timestamp = Date.now();
      const response = await fetch(`/api/admin/customers/sync-all?_t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
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

  const handleComprehensiveSync = async () => {
    if (!confirm('Run comprehensive sync? This will:\n1. Pull all contacts from Brevo\n2. Pull all customers from Neon\n3. Create missing contacts in Neon first\n4. Update Neon with any missing data from Brevo\n5. Sync all Neon customers to Brevo (Neon is source of truth)\n\nThis may take several minutes. Continue?')) {
      return;
    }

    try {
      setSyncingAll(true);
      setError(null);

      const response = await fetch('/api/admin/customers/comprehensive-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to run comprehensive sync');
      }

      const result = await response.json();
      
      // Reload data and status
      await Promise.all([loadData(), loadSyncStatus()]);
      
      const results = result.results || {};
      const errorCount = results.errors?.length || 0;
      const errorMsg = errorCount > 0 ? `\n\n${errorCount} errors occurred. Check console for details.` : '';
      
      alert(
        `Comprehensive sync complete!\n\n` +
        `Created in Neon: ${results.createdInNeon || 0}\n` +
        `Updated in Neon: ${results.updatedInNeon || 0}\n` +
        `Synced to Brevo: ${results.syncedToBrevo || 0}\n` +
        `Total Brevo contacts: ${results.totalBrevoContacts || 0}\n` +
        `Total Neon customers: ${results.totalNeonCustomers || 0}` +
        errorMsg
      );
      
      if (errorCount > 0) {
        console.error('[Comprehensive Sync] Errors:', results.errors);
      }
    } catch (err: any) {
      setError(err);
      alert(`Comprehensive sync failed: ${err.message}`);
      console.error('[Comprehensive Sync] Error:', err);
    } finally {
      setSyncingAll(false);
    }
  };

  const handleEdit = (client: UnifiedClient) => {
    setViewingClient(null);
    setEditing(client);
    setEditForm({
      firstName: client.firstName || '',
      lastName: client.lastName || '',
      email: client.email || '',
      phone: client.phone || '',
      marketingOptIn: client.marketingOptIn,
    });
  };

  const handleSaveEdit = async () => {
    if (!editing) return;

    // Validate email format
    if (!editForm.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email)) {
      alert('Please enter a valid email address');
      return;
    }

    try {
      setError(null);

      // Determine which system to update based on where the client exists
      // Always prefer Neon if it exists (source of truth)
      if (editing.inNeon && editing.neonId) {
        // Update Neon (source of truth) - will auto-sync to Brevo if linked
        const response = await fetch(`/api/admin/customers/${editing.neonId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            first_name: editForm.firstName,
            last_name: editForm.lastName,
            email: editForm.email,
            phone: editForm.phone,
            marketing_opt_in: editForm.marketingOptIn,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update customer');
        }

        // If also in Brevo, sync will happen automatically via the PATCH endpoint
      } else if (editing.inBrevo && editing.brevoId) {
        // Update Brevo directly (no Neon record)
        // Note: If email is being changed, this will fail - user should create in Neon first
        const response = await fetch(`/api/admin/brevo/clients/${editing.brevoId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: editForm.firstName,
            lastName: editForm.lastName,
            email: editForm.email !== editing.email ? editing.email : undefined, // Don't change email in Brevo
            phone: editForm.phone,
            marketingOptIn: editForm.marketingOptIn,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update Brevo contact');
        }
      } else {
        throw new Error('Cannot update: client has no ID in either system');
      }

      // Reload data
      await Promise.all([loadData(), loadSyncStatus()]);
      setEditing(null);
      alert('Client updated successfully');
      // Refresh viewing client if it was open
      if (viewingClient && viewingClient.email === editForm.email) {
        await loadData();
      }
    } catch (err: any) {
      setError(err);
      alert(`Update failed: ${err.message}`);
    }
  };

  const handleDelete = async (client: UnifiedClient) => {
    const confirmMessage = client.inNeon && client.inBrevo
      ? `Delete this client from both Neon and Brevo? This action cannot be undone.`
      : client.inNeon
      ? `Delete this client from Neon? This action cannot be undone.`
      : `Delete this contact from Brevo? This action cannot be undone.`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const deleteKey = client.inNeon ? client.neonId! : client.brevoId!;
      setDeleting(deleteKey);
      setError(null);

      let response: Response;
      if (client.inNeon && client.neonId) {
        // Delete from Neon (will also delete from Brevo if linked)
        response = await fetch(`/api/admin/customers/${client.neonId}`, {
          method: 'DELETE',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });
      } else if (client.inBrevo && client.brevoId) {
        // Delete from Brevo (will also delete from Neon if linked)
        response = await fetch(`/api/admin/brevo/clients/${client.brevoId}`, {
          method: 'DELETE',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });
      } else {
        throw new Error('Cannot delete: client has no ID');
      }

      if (response.status === 404) {
        // If the client is not found on the server, remove it from local state immediately
        const emailLower = client.email.toLowerCase();
        setNeonCustomers(prev => prev.filter(c => {
          const cEmailLower = (c.email || '').toLowerCase();
          return c.id !== client.neonId && cEmailLower !== emailLower;
        }));
        setBrevoContacts(prev => prev.filter(c => {
          const cEmailLower = (c.email || '').toLowerCase();
          return c.id !== client.brevoId && cEmailLower !== emailLower;
        }));
        alert('This client no longer exists and has been removed from the list.');
        setDeleting(null);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete client');
      }

      // Clear state aggressively before reloading to ensure no stale data
      setNeonCustomers([]);
      setBrevoContacts([]);
      
      // Add a small delay to ensure database transaction commits before reloading
      await new Promise<void>((resolve, reject) => {
        setTimeout(async () => {
          try {
            await loadData();
            resolve();
          } catch (error) {
            reject(error);
          }
        }, 100);
      });
      
      alert('Client deleted successfully');
    } catch (err: any) {
      setError(err);
      alert(`Delete failed: ${err.message}`);
    } finally {
      setDeleting(null);
    }
  };

  // Create unified client list with both Neon and Brevo data
  const unifiedClients = useMemo(() => {
    const clientsMap = new Map<string, UnifiedClient>();
    const brevoByIdMap = new Map<string, any>(); // Map Brevo contacts by ID for matching

    // First, index all Brevo contacts by ID
    brevoContacts.forEach((brevo) => {
      if (brevo.id) {
        brevoByIdMap.set(String(brevo.id), brevo);
      }
    });

    // Add all Neon customers (only if they have a valid email)
    neonCustomers.forEach((neon) => {
      // Only include customers with valid, non-empty emails
      if (neon.email && typeof neon.email === 'string' && neon.email.trim().length > 0) {
        const emailLower = neon.email.toLowerCase().trim();
        // Skip if email is invalid format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
          console.warn('[ClientsManager] Skipping Neon customer with invalid email:', neon.email, neon.id);
          return;
        }
        
        const brevoIdStr = neon.brevo_contact_id ? String(neon.brevo_contact_id) : null;
        const brevoContact = brevoIdStr ? brevoByIdMap.get(brevoIdStr) : null;
        
        // Check if this email already exists in the map (duplicate prevention)
        if (clientsMap.has(emailLower)) {
          console.warn('[ClientsManager] Duplicate email found in Neon customers:', emailLower, 'IDs:', clientsMap.get(emailLower)?.neonId, neon.id);
          // Keep the first one, skip duplicates
          return;
        }
        
        clientsMap.set(emailLower, {
          email: neon.email.trim(),
          firstName: neon.first_name || '',
          lastName: neon.last_name || '',
          phone: neon.phone || null,
          neonId: neon.id,
          brevoId: brevoIdStr,
          marketingOptIn: neon.marketing_opt_in || false,
          usedWelcomeOffer: neon.used_welcome_offer || false,
          inNeon: true,
          inBrevo: !!brevoContact, // Only true if Brevo contact actually exists
          hasMismatch: false,
          neonData: neon,
          brevoData: brevoContact || undefined,
        });
        
        // If we found a Brevo contact, check for mismatches
        if (brevoContact) {
          const client = clientsMap.get(emailLower)!;
          const neonFirstName = (client.firstName || '').trim().toLowerCase();
          const neonLastName = (client.lastName || '').trim().toLowerCase();
          const brevoFirstName = (brevoContact.firstName || '').trim().toLowerCase();
          const brevoLastName = (brevoContact.lastName || '').trim().toLowerCase();
          
          const nameMatch = 
            neonFirstName === brevoFirstName &&
            neonLastName === brevoLastName;
          
          const neonPhone = (client.phone || '').replace(/\D/g, '');
          const brevoPhone = (brevoContact.phone || '').replace(/\D/g, '');
          const phoneMatch = neonPhone === brevoPhone || (!neonPhone && !brevoPhone);
          
          const marketingMatch = client.marketingOptIn === !brevoContact.emailBlacklisted;
          
          client.hasMismatch = !nameMatch || !phoneMatch || !marketingMatch;
        }
      }
    });

    // Add/merge Brevo contacts that weren't matched by brevo_contact_id
    brevoContacts.forEach((brevo) => {
      // Only include contacts with valid, non-empty emails
      if (brevo.email && typeof brevo.email === 'string' && brevo.email.trim().length > 0) {
        const emailLower = brevo.email.toLowerCase().trim();
        // Skip if email is invalid format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
          console.warn('[ClientsManager] Skipping Brevo contact with invalid email:', brevo.email, brevo.id);
          return;
        }
        
        const brevoIdStr = String(brevo.id);
        const existing = clientsMap.get(emailLower);
        
        if (existing) {
          // Already matched - just ensure brevoId and brevoData are set
          if (!existing.brevoId || existing.brevoId !== brevoIdStr) {
            existing.brevoId = brevoIdStr;
            existing.inBrevo = true;
            existing.brevoData = brevo;
          }
        } else {
          // Check if this Brevo contact matches a Neon customer by brevo_contact_id
          let matchedByBrevoId = false;
          Array.from(clientsMap.values()).forEach((client) => {
            if (client.brevoId === brevoIdStr && client.inNeon && !matchedByBrevoId) {
              // Found a match by brevo_contact_id
              client.brevoId = brevoIdStr;
              client.inBrevo = true;
              client.brevoData = brevo;
              matchedByBrevoId = true;
            }
          });
          
          if (!matchedByBrevoId) {
            // Brevo-only contact
            clientsMap.set(emailLower, {
              email: brevo.email.trim(), // Trim for consistency with Neon emails
              firstName: brevo.firstName || '',
              lastName: brevo.lastName || '',
              phone: brevo.phone || null,
              neonId: null,
              brevoId: brevoIdStr,
              marketingOptIn: !brevo.emailBlacklisted,
              usedWelcomeOffer: brevo.usedWelcomeOffer || false,
              inNeon: false,
              inBrevo: true,
              hasMismatch: false,
              brevoData: brevo,
            });
          }
        }
      }
    });

    const unifiedList = Array.from(clientsMap.values()).sort((a, b) => {
      // Sort by email
      return a.email.localeCompare(b.email);
    });
    
    // Debug logging
    console.log('[ClientsManager] Unified clients:', {
      total: unifiedList.length,
      inNeonOnly: unifiedList.filter(c => c.inNeon && !c.inBrevo).length,
      inBrevoOnly: unifiedList.filter(c => !c.inNeon && c.inBrevo).length,
      inBoth: unifiedList.filter(c => c.inNeon && c.inBrevo).length,
      emails: unifiedList.map(c => c.email),
    });
    
    return unifiedList;
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

  return (
    <div className="space-y-4">
      {/* Error Display - Inline, not blocking */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-red-800 mb-1">Error</h4>
                <p className="text-sm text-red-700">
                  {error?.message || error?.error || 'An error occurred'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setError(null)}
              className="p-1 hover:bg-red-100 rounded transition-colors flex-shrink-0"
              title="Dismiss error"
            >
              <X className="w-4 h-4 text-red-600" />
            </button>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0">
        <div>
          <h2 className="text-lg md:text-xl font-semibold text-charcoal">Clients</h2>
          <p className="text-xs md:text-sm text-warm-gray mt-1">
            {viewMode === 'all' && `Showing all ${unifiedClients.length} clients (Neon and Brevo)`}
            {viewMode === 'matched' && `Showing ${matchedCount} clients in both Neon and Brevo`}
            {viewMode === 'unmatched' && `Showing ${unmatchedCount} clients not in both systems`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleComprehensiveSync}
            disabled={syncingAll}
            className="px-3 md:px-4 py-2 bg-charcoal text-white rounded-lg hover:bg-warm-gray disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-xs md:text-sm min-h-[44px] font-semibold"
            title="Comprehensive sync: Pulls from both systems, creates missing records in Neon first, then syncs all to Brevo"
          >
            {syncingAll ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">Syncing...</span>
                <span className="sm:hidden">Sync...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Comprehensive Sync</span>
                <span className="sm:hidden">Full Sync</span>
              </>
            )}
          </button>
          <button
            onClick={loadData}
            className="px-3 md:px-4 py-2 bg-sand/30 text-charcoal rounded-lg hover:bg-sand/50 transition-colors flex items-center gap-2 text-xs md:text-sm min-h-[44px]"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
            <span className="sm:hidden">Refresh</span>
          </button>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="flex items-center gap-2 border-b border-sand overflow-x-auto">
        <button
          onClick={() => setViewMode('all')}
          className={`px-3 md:px-4 py-2 text-xs md:text-sm font-medium transition-colors border-b-2 whitespace-nowrap min-h-[44px] ${
            viewMode === 'all'
              ? 'border-dark-sage text-dark-sage'
              : 'border-transparent text-warm-gray hover:text-charcoal'
          }`}
        >
          All ({unifiedClients.length})
        </button>
        <button
          onClick={() => setViewMode('matched')}
          className={`px-3 md:px-4 py-2 text-xs md:text-sm font-medium transition-colors border-b-2 whitespace-nowrap min-h-[44px] ${
            viewMode === 'matched'
              ? 'border-dark-sage text-dark-sage'
              : 'border-transparent text-warm-gray hover:text-charcoal'
          }`}
        >
          Matched ({matchedCount})
        </button>
        <button
          onClick={() => setViewMode('unmatched')}
          className={`px-3 md:px-4 py-2 text-xs md:text-sm font-medium transition-colors border-b-2 whitespace-nowrap min-h-[44px] ${
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
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 md:p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
            <p className="text-xs md:text-sm text-yellow-800">
              {mismatchCount} client{mismatchCount !== 1 ? 's' : ''} have data mismatches between Neon and Brevo. Rows are highlighted in yellow.
            </p>
          </div>
        </div>
      )}

      {/* Sync Status and Actions */}
      {syncStatus && (
        <div className="bg-sage-light/30 border border-sage-dark/20 rounded-lg p-3 md:p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0">
            <div>
              <p className="text-xs md:text-sm font-medium text-charcoal">
                Sync Status: {syncStatus.synced} of {syncStatus.total} customers synced to Brevo
              </p>
              <p className="text-xs text-warm-gray mt-1">
                {syncStatus.pending} pending sync (customers with marketing opt-in)
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleSyncAll}
                disabled={syncingAll || syncStatus.pending === 0}
                className="px-4 py-2 bg-dark-sage text-white rounded-lg hover:bg-dark-sage/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-xs md:text-sm min-h-[44px] justify-center md:justify-start"
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
              <button
                onClick={handleComprehensiveSync}
                disabled={syncingAll}
                className="px-4 py-2 bg-charcoal text-white rounded-lg hover:bg-warm-gray disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-xs md:text-sm min-h-[44px] justify-center md:justify-start font-semibold"
                title="Comprehensive sync: Pulls from both systems, creates missing records in Neon first, then syncs all to Brevo"
              >
                {syncingAll ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Comprehensive Sync
                  </>
                )}
              </button>
            </div>
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
            className="w-full pl-10 pr-4 py-3 md:py-2 border border-sage-dark/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage text-sm"
          />
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white border border-sand rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-sage-light/30">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Email</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Phone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-warm-gray">
                    No clients found
                  </td>
                </tr>
              ) : (
                filteredData.map((client) => (
                  <tr 
                    key={client.email} 
                    onClick={() => setViewingClient(client)}
                    className={`hover:bg-sand/10 cursor-pointer transition-colors ${
                      client.hasMismatch ? 'bg-yellow-50/50' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-sm text-charcoal">
                        {`${client.firstName} ${client.lastName}`.trim() || 'N/A'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-charcoal">{client.email}</td>
                    <td className="px-4 py-3 text-sm text-charcoal">{client.phone || 'N/A'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-2">
        {filteredData.length === 0 ? (
          <div className="bg-white border border-sand rounded-lg p-8 text-center text-warm-gray">
            No clients found
          </div>
        ) : (
          filteredData.map((client) => (
            <div
              key={client.email}
              onClick={() => setViewingClient(client)}
              className={`bg-white border rounded-lg p-3 cursor-pointer transition-colors active:bg-sand/10 ${
                client.hasMismatch ? 'border-yellow-300 bg-yellow-50/30' : 'border-sand'
              }`}
            >
              <div className="font-semibold text-base text-charcoal mb-1">
                {`${client.firstName} ${client.lastName}`.trim() || 'N/A'}
              </div>
              <div className="text-sm text-warm-gray">{client.email}</div>
              {client.phone && (
                <div className="text-sm text-warm-gray mt-0.5">{client.phone}</div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Summary */}
      <div className="text-xs md:text-sm text-warm-gray">
        Showing {filteredData.length} of {filteredByMode.length} clients
        {mismatchCount > 0 && (
          <span className="ml-2 text-yellow-700">
            ({mismatchCount} with data mismatches)
          </span>
        )}
      </div>

      {/* Client Detail Modal */}
      {viewingClient && (() => {
        // Find the current client data from unifiedClients to get fresh data
        const currentClient = unifiedClients.find(c => c.email.toLowerCase() === viewingClient.email.toLowerCase()) || viewingClient;
        return (
          <div className="fixed inset-0 z-50 bg-charcoal/80 backdrop-blur-sm md:flex md:items-center md:justify-center md:p-4">
          <div className="bg-white h-full md:h-auto md:rounded-lg md:max-w-2xl md:w-full md:shadow-xl flex flex-col">
            <div className="p-4 md:p-6 flex-1 overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg md:text-xl font-semibold text-charcoal">Client Details</h3>
                <button
                  onClick={() => setViewingClient(null)}
                  className="p-1 hover:bg-sand/30 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <X className="w-5 h-5 text-charcoal" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Client Name - Emphasized */}
                <div>
                  <h4 className="text-2xl md:text-3xl font-bold text-charcoal mb-2">
                    {`${currentClient.firstName} ${currentClient.lastName}`.trim() || 'N/A'}
                  </h4>
                </div>

                {/* Basic Information */}
                <div className="bg-sage-light/20 rounded-lg p-4 space-y-3">
                  <div>
                    <label className="text-xs text-warm-gray uppercase tracking-wide">Email</label>
                    <div className="text-sm font-medium text-charcoal mt-1">{currentClient.email}</div>
                  </div>
                  <div>
                    <label className="text-xs text-warm-gray uppercase tracking-wide">Phone</label>
                    <div className="text-sm font-medium text-charcoal mt-1">{currentClient.phone || 'N/A'}</div>
                  </div>
                </div>

                {/* System Status */}
                <div className="bg-white border border-sand rounded-lg p-4 space-y-3">
                  <h5 className="font-semibold text-charcoal mb-2">System Status</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-warm-gray">In Neon:</span>
                      {currentClient.inNeon ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-gray-400" />
                      )}
                      {currentClient.neonId && (
                        <span className="text-xs font-mono text-warm-gray ml-1">{currentClient.neonId}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-warm-gray">In Brevo:</span>
                      {currentClient.inBrevo ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-gray-400" />
                      )}
                      {currentClient.brevoId && (
                        <span className="text-xs font-mono text-warm-gray ml-1">{currentClient.brevoId}</span>
                      )}
                    </div>
                  </div>
                  {currentClient.hasMismatch && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mt-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-600" />
                        <span className="text-xs text-yellow-800">Data mismatch detected between Neon and Brevo</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Preferences */}
                <div className="bg-white border border-sand rounded-lg p-4 space-y-3">
                  <h5 className="font-semibold text-charcoal mb-2">Preferences</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-warm-gray">Marketing Opt-In:</span>
                      {currentClient.marketingOptIn ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-warm-gray">Used Welcome Offer:</span>
                      {currentClient.usedWelcomeOffer ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="bg-white border border-sand rounded-lg p-4">
                  <h5 className="font-semibold text-charcoal mb-3">Actions</h5>
                  <div className="flex flex-col gap-2">
                    {currentClient.inNeon && !currentClient.inBrevo && currentClient.marketingOptIn && (
                    <button
                      onClick={async () => {
                        await handleSyncToBrevo(currentClient.neonId!);
                        await Promise.all([loadData(), loadSyncStatus()]);
                      }}
                      disabled={syncingToBrevo === currentClient.neonId}
                      className="w-full px-4 py-3 bg-dark-sage text-white rounded-lg hover:bg-dark-sage/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm min-h-[44px]"
                    >
                      <Upload className="w-4 h-4" />
                      {syncingToBrevo === currentClient.neonId ? 'Syncing...' : 'Sync to Brevo'}
                    </button>
                    )}
                    {!currentClient.inNeon && currentClient.inBrevo && (
                    <button
                      onClick={async () => {
                        await handleSyncToNeon(currentClient.brevoId!);
                        await Promise.all([loadData(), loadSyncStatus()]);
                      }}
                      disabled={syncingToNeon === currentClient.brevoId}
                      className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm min-h-[44px]"
                    >
                      <Download className="w-4 h-4" />
                      {syncingToNeon === currentClient.brevoId ? 'Syncing...' : 'Create in Neon from Brevo'}
                    </button>
                    )}
                    {currentClient.inNeon && currentClient.inBrevo && currentClient.hasMismatch && (
                    <button
                      onClick={async () => {
                        await handleSyncToBrevo(currentClient.neonId!);
                        await Promise.all([loadData(), loadSyncStatus()]);
                      }}
                      disabled={syncingToBrevo === currentClient.neonId}
                      className="w-full px-4 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm min-h-[44px]"
                    >
                      <RefreshCw className="w-4 h-4" />
                      {syncingToBrevo === currentClient.neonId ? 'Syncing...' : 'Fix Sync (Sync Neon to Brevo)'}
                    </button>
                    )}
                    <button
                      onClick={() => {
                        setViewingClient(null);
                        handleEdit(currentClient);
                      }}
                      className="w-full px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center justify-center gap-2 text-sm min-h-[44px]"
                    >
                      <Edit className="w-4 h-4" />
                      Edit Client
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm(`Are you sure you want to delete ${currentClient.email}? This action cannot be undone.`)) {
                          await handleDelete(currentClient);
                          setViewingClient(null);
                          await loadData();
                        }
                      }}
                      disabled={deleting === (currentClient.neonId || currentClient.brevoId)}
                      className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm min-h-[44px]"
                    >
                      <Trash2 className="w-4 h-4" />
                      {deleting === (currentClient.neonId || currentClient.brevoId) ? 'Deleting...' : 'Delete Client'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 md:p-6 border-t border-sand md:border-t-0">
              <button
                onClick={() => setViewingClient(null)}
                className="w-full px-4 py-3 md:py-2 bg-sand/30 text-charcoal rounded-lg hover:bg-sand/50 transition-colors font-medium text-sm min-h-[44px]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-charcoal/80 backdrop-blur-sm md:flex md:items-center md:justify-center md:p-4">
          <div className="bg-white h-full md:h-auto md:rounded-lg md:max-w-md md:w-full md:shadow-xl flex flex-col">
            <div className="p-4 md:p-6 flex-1 overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg md:text-xl font-semibold text-charcoal">Edit Client</h3>
                <button
                  onClick={() => setEditing(null)}
                  className="p-1 hover:bg-sand/30 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <X className="w-5 h-5 text-charcoal" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-3 md:py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage text-sm"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-charcoal mb-1">First Name</label>
                    <input
                      type="text"
                      value={editForm.firstName}
                      onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                      className="w-full px-3 py-3 md:py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-charcoal mb-1">Last Name</label>
                    <input
                      type="text"
                      value={editForm.lastName}
                      onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                      className="w-full px-3 py-3 md:py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1">Phone</label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-3 md:py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage text-sm"
                    placeholder="(555) 123-4567"
                  />
                </div>

                <div className="flex items-center gap-2 min-h-[44px]">
                  <input
                    type="checkbox"
                    id="marketing-opt-in"
                    checked={editForm.marketingOptIn}
                    onChange={(e) => setEditForm({ ...editForm, marketingOptIn: e.target.checked })}
                    className="w-5 h-5 md:w-4 md:h-4 text-dark-sage border-sand rounded focus:ring-dark-sage"
                  />
                  <label htmlFor="marketing-opt-in" className="text-sm text-charcoal">
                    Marketing Opt-In
                  </label>
                </div>
              </div>
            </div>
            <div className="p-4 md:p-6 border-t border-sand md:border-t-0">
              <div className="flex flex-col md:flex-row gap-3">
                <button
                  onClick={() => setEditing(null)}
                  className="flex-1 px-4 py-3 md:py-2 bg-sand/30 text-charcoal rounded-lg hover:bg-sand/50 transition-colors font-medium text-sm min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 px-4 py-3 md:py-2 bg-dark-sage text-white rounded-lg hover:bg-dark-sage/80 transition-colors font-medium text-sm min-h-[44px]"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
