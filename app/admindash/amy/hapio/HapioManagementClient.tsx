'use client';

import { useState } from 'react';
import { Calendar, Users, Settings, BookOpen, Clock, Layers, UserCircle, Tag, RefreshCw, Menu } from 'lucide-react';
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
      className="flex items-center gap-2 px-2 py-1 md:px-4 md:py-2 bg-sand/30 text-charcoal rounded-lg hover:bg-sand/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs md:text-sm font-medium min-h-[44px] md:min-h-0"
      title="Refresh all cached data"
    >
      <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
      <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh Data'}</span>
      <span className="sm:hidden">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
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

  const activeTabData = tabs.find(tab => tab.id === activeTab) || tabs[0];

  return (
    <HapioDataProvider>
      <div className="min-h-screen bg-sand/20 p-2 md:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-dark-sage text-charcoal px-3 md:px-6 py-3 md:py-4 border-b border-sage-light">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0">
              <div className="flex-1">
                <h1 className="text-lg md:text-2xl font-bold">Aura Esthetics Dashboard</h1>
                <p className="text-xs md:text-sm text-charcoal/70 mt-1">
                  Manage availability, schedules, bookings, employees, and clients
                </p>
              </div>
              <RefreshButton />
            </div>
          </div>

            {/* Mobile Tab Selector */}
            <div className="md:hidden border-b border-sand bg-white px-3 py-2">
              <select
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value as Tab)}
                className="w-full px-3 py-2 bg-white border border-sage-dark/20 rounded-lg text-sm font-medium text-charcoal focus:outline-none focus:ring-2 focus:ring-dark-sage min-h-[44px]"
              >
                {tabs.map((tab) => (
                  <option key={tab.id} value={tab.id}>
                    {tab.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Desktop Tabs */}
            <div className="hidden md:block border-b border-sand bg-white">
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
            <div className="p-3 md:p-6">
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

