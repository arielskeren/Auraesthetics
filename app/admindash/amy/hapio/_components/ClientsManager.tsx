'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import LoadingState from './LoadingState';

interface Customer {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  marketing_opt_in: boolean;
  used_welcome_offer?: boolean;
  created_at: string;
  updated_at: string;
}

export default function ClientsManager() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

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
        <button
          onClick={loadCustomers}
          className="px-3 md:px-4 py-2 bg-sand/30 text-charcoal rounded-lg hover:bg-sand/50 transition-colors flex items-center gap-2 text-xs md:text-sm min-h-[44px]"
        >
          <RefreshCw className="w-4 h-4" />
          <span className="hidden sm:inline">Refresh</span>
          <span className="sm:hidden">Refresh</span>
        </button>
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
                  <th className="px-4 py-3 text-left text-xs md:text-sm font-semibold text-charcoal">Phone</th>
                  <th className="px-4 py-3 text-left text-xs md:text-sm font-semibold text-charcoal">Marketing</th>
                  <th className="px-4 py-3 text-left text-xs md:text-sm font-semibold text-charcoal">ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand">
                {filteredCustomers.map((customer) => {
                  const fullName = [customer.first_name, customer.last_name]
                    .filter(Boolean)
                    .join(' ') || 'N/A';
                  
                  return (
                    <tr key={customer.id} className="hover:bg-sand/10 transition-colors">
                      <td className="px-4 py-3 text-xs md:text-sm text-charcoal">{fullName}</td>
                      <td className="px-4 py-3 text-xs md:text-sm text-charcoal">{customer.email}</td>
                      <td className="px-4 py-3 text-xs md:text-sm text-charcoal">{customer.phone || 'N/A'}</td>
                      <td className="px-4 py-3 text-xs md:text-sm">
                        {customer.marketing_opt_in ? (
                          <span className="text-green-600 font-medium">Yes</span>
                        ) : (
                          <span className="text-warm-gray">No</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs md:text-sm text-warm-gray font-mono">
                        {customer.id.substring(0, 8)}...
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
    </div>
  );
}
