'use client';

import { useState } from 'react';
import ResourcesManager from './ResourcesManager';
import LocationsManager from './LocationsManager';
import { Users, MapPin } from 'lucide-react';

type SubTab = 'resources' | 'locations';

export default function ResourcesAndLocationsManager() {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('resources');

  const subTabs: { id: SubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'resources', label: 'Employees', icon: <Users className="w-4 h-4" /> },
    { id: 'locations', label: 'Locations', icon: <MapPin className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Sub-tabs */}
      <div className="border-b border-sand">
        <div className="flex overflow-x-auto">
          {subTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-2 px-4 md:px-6 py-3 font-medium text-xs md:text-sm transition-colors whitespace-nowrap min-h-[44px] ${
                activeSubTab === tab.id
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
      <div>
        {activeSubTab === 'resources' && <ResourcesManager />}
        {activeSubTab === 'locations' && <LocationsManager />}
      </div>
    </div>
  );
}

