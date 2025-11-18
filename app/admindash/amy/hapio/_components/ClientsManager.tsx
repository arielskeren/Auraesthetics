'use client';

import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Search, UserCircle, Mail, Phone, CheckCircle, XCircle } from 'lucide-react';
import LoadingState from './LoadingState';
import ErrorDisplay from './ErrorDisplay';

export default function ClientsManager() {
  const [viewingBrevo, setViewingBrevo] = useState(false);
  const [neonCustomers, setNeonCustomers] = useState<any[]>([]);
  const [brevoContacts, setBrevoContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [syncingToBrevo, setSyncingToBrevo] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [viewingBrevo]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (viewingBrevo) {
        const response = await fetch('/api/admin/brevo/clients?limit=100');
        if (!response.ok) {
          throw new Error('Failed to load Brevo contacts');
        }
        const data = await response.json();
        setBrevoContacts(data.contacts || []);
      } else {
        const response = await fetch('/api/admin/customers?limit=100');
        if (!response.ok) {
          throw new Error('Failed to load Neon customers');
        }
        const data = await response.json();
        setNeonCustomers(data.customers || []);
      }
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
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

      alert('Customer synced to Brevo successfully');
      loadData();
    } catch (err: any) {
      setError(err);
      alert(`Sync failed: ${err.message}`);
    } finally {
      setSyncingToBrevo(null);
    }
  };

  const filteredData = useMemo(() => {
    const data = viewingBrevo ? brevoContacts : neonCustomers;
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
  }, [viewingBrevo, neonCustomers, brevoContacts, searchQuery]);

  if (loading) {
    return <LoadingState message="Loading clients..." />;
  }

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  return (
    <div className="space-y-4">
      {/* Header with Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-charcoal">
            {viewingBrevo ? 'Brevo Contacts' : 'Neon Customers (Source of Truth)'}
          </h2>
          <p className="text-sm text-warm-gray mt-1">
            {viewingBrevo 
              ? 'Viewing contacts from Brevo email marketing platform'
              : 'Viewing customers from Neon database (source of truth)'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setViewingBrevo(!viewingBrevo)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewingBrevo
                ? 'bg-sage-light text-charcoal hover:bg-sage-light/80'
                : 'bg-dark-sage text-white hover:bg-dark-sage/80'
            }`}
          >
            {viewingBrevo ? 'View Neon' : 'View Brevo'}
          </button>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-sand/30 text-charcoal rounded-lg hover:bg-sand/50 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

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
                {!viewingBrevo && (
                  <>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Marketing Opt-In</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Used Welcome Offer</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Actions</th>
                  </>
                )}
                {viewingBrevo && (
                  <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Brevo ID</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-sand">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={viewingBrevo ? 4 : 6} className="px-4 py-8 text-center text-warm-gray">
                    No clients found
                  </td>
                </tr>
              ) : (
                filteredData.map((item: any) => (
                  <tr key={item.id || item.email} className="hover:bg-sand/10">
                    <td className="px-4 py-3 text-sm text-charcoal">{item.email || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-charcoal">
                      {viewingBrevo 
                        ? `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'N/A'
                        : `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-charcoal">{item.phone || 'N/A'}</td>
                    {!viewingBrevo && (
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
                          <button
                            onClick={() => handleSyncToBrevo(item.id)}
                            disabled={syncingToBrevo === item.id}
                            className="px-3 py-1 bg-dark-sage text-white rounded hover:bg-dark-sage/80 disabled:opacity-50 text-xs"
                          >
                            {syncingToBrevo === item.id ? 'Syncing...' : 'Sync to Brevo'}
                          </button>
                        </td>
                      </>
                )}
                    {viewingBrevo && (
                      <td className="px-4 py-3 text-sm text-warm-gray font-mono text-xs">
                        {item.id}
                      </td>
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
        Showing {filteredData.length} of {viewingBrevo ? brevoContacts.length : neonCustomers.length} clients
      </div>
    </div>
  );
}

