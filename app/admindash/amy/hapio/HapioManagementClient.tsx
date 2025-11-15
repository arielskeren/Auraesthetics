'use client';

import { useState } from 'react';
import { Calendar, Users, Settings, BookOpen, Clock, Layers } from 'lucide-react';
import HapioOverview from './_components/HapioOverview';
import BookingsManager from './_components/BookingsManager';
import ServicesManager from './_components/ServicesManager';
import SchedulesManager from './_components/SchedulesManager';
import ResourcesAndLocationsManager from './_components/ResourcesAndLocationsManager';

type Tab = 'overview' | 'bookings' | 'resources-locations' | 'services' | 'schedules';

export default function HapioManagementClient() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Calendar className="w-4 h-4" /> },
    { id: 'bookings', label: 'Bookings', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'resources-locations', label: 'Employees & Locations', icon: <Users className="w-4 h-4" /> },
    { id: 'services', label: 'Services', icon: <Settings className="w-4 h-4" /> },
    { id: 'schedules', label: 'Schedules', icon: <Clock className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-sand/20 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-dark-sage text-charcoal px-6 py-4 border-b border-sage-light">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">Hapio Management Portal</h1>
                <p className="text-sm text-charcoal/70 mt-1">
                  Manage availability, schedules, bookings, and employees
                </p>
              </div>
              <a
                href="/admindash/amy"
                className="px-4 py-2 bg-charcoal text-white rounded-lg hover:bg-charcoal/80 transition-colors text-sm font-medium"
              >
                Main Dashboard
              </a>
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
            {activeTab === 'resources-locations' && <ResourcesAndLocationsManager />}
            {activeTab === 'services' && <ServicesManager />}
            {activeTab === 'schedules' && <SchedulesManager />}
          </div>
        </div>
      </div>
    </div>
  );
}

