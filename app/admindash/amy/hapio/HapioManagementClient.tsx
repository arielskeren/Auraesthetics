'use client';

import { useState } from 'react';
import { Calendar, Users, Settings, BookOpen, Clock, Layers, UserCircle, Tag, RefreshCw } from 'lucide-react';
import { HapioDataProvider, useHapioData } from './_contexts/HapioDataContext';
import HapioOverview from './_components/HapioOverview';
import BookingsManager from './_components/BookingsManager';
import ServicesManager from './_components/ServicesManager';
import SchedulesManager from './_components/SchedulesManager';
import ResourcesAndLocationsManager from './_components/ResourcesAndLocationsManager';
import ClientsManager from './_components/ClientsManager';
import DiscountCodesManager from './_components/DiscountCodesManager';

function RefreshButton() {
  const { refreshData, isLoadingServices, isLoadingResources, isLoadingLocations } = useHapioData();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isLoading = isLoadingServices || isLoadingResources || isLoadingLocations;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshData();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={isRefreshing || isLoading}
      className="flex items-center gap-2 px-4 py-2 bg-sand/30 text-charcoal rounded-lg hover:bg-sand/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
      title="Refresh all cached data"
    >
      <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
      {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
    </button>
  );
}

type Tab = 'overview' | 'bookings' | 'resources-locations' | 'services' | 'schedules' | 'clients' | 'discount-codes';

export default function HapioManagementClient() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Calendar className="w-4 h-4" /> },
    { id: 'bookings', label: 'Bookings', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'clients', label: 'Clients', icon: <UserCircle className="w-4 h-4" /> },
    { id: 'discount-codes', label: 'Discount Codes', icon: <Tag className="w-4 h-4" /> },
    { id: 'resources-locations', label: 'Employees & Locations', icon: <Users className="w-4 h-4" /> },
    { id: 'services', label: 'Services', icon: <Settings className="w-4 h-4" /> },
    { id: 'schedules', label: 'Schedules', icon: <Clock className="w-4 h-4" /> },
  ];

  return (
    <HapioDataProvider>
      <div className="min-h-screen bg-sand/20 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-dark-sage text-charcoal px-6 py-4 border-b border-sage-light">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">Aura Esthetics Dashboard</h1>
                <p className="text-sm text-charcoal/70 mt-1">
                  Manage availability, schedules, bookings, employees, and clients
                </p>
              </div>
              <RefreshButton />
            </div>
          </div>

            {/* Tabs */}
            <div className="border-b border-sand bg-white">
              <div className="flex overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-6 py-4 font-medium text-sm transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'text-dark-sage border-b-2 border-dark-sage bg-sage-light/30'
                        : 'text-warm-gray hover:text-charcoal hover:bg-sand/20'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {activeTab === 'overview' && <HapioOverview onNavigate={(tab) => setActiveTab(tab)} />}
              {activeTab === 'bookings' && <BookingsManager />}
              {activeTab === 'clients' && <ClientsManager />}
              {activeTab === 'discount-codes' && <DiscountCodesManager />}
              {activeTab === 'resources-locations' && <ResourcesAndLocationsManager />}
              {activeTab === 'services' && <ServicesManager />}
              {activeTab === 'schedules' && <SchedulesManager />}
            </div>
          </div>
        </div>
      </div>
    </HapioDataProvider>
  );
}

