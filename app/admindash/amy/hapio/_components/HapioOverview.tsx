'use client';

import { Calendar, Users, Settings, BookOpen, Clock } from 'lucide-react';

type Tab = 'bookings' | 'resources-locations' | 'services' | 'schedules';

interface HapioOverviewProps {
  onNavigate?: (tab: Tab) => void;
}

export default function HapioOverview({ onNavigate }: HapioOverviewProps) {
  return (
    <div className="space-y-4 md:space-y-6">
      {/* Welcome Message */}
      <div className="bg-gradient-to-r from-dark-sage/10 to-sage-light/20 rounded-lg p-4 md:p-8 border border-sage-light">
        <h2 className="text-lg md:text-2xl font-semibold text-charcoal mb-2 md:mb-3">Welcome, Amy! 👋</h2>
        <p className="text-sm md:text-base text-warm-gray leading-relaxed mb-3 md:mb-4">
          This is your Aura Esthetics Dashboard. Here you can manage all aspects of your business operations.
        </p>
        <div className="bg-white/50 rounded-lg p-3 md:p-4 border border-sage-light/50">
          <h3 className="text-sm md:text-base font-semibold text-charcoal mb-2">How This Dashboard Works:</h3>
          <ul className="space-y-2 text-xs md:text-sm text-warm-gray">
            <li className="flex items-start">
              <span className="text-dark-sage mr-2">•</span>
              <span><strong>Bookings:</strong> View and manage all client appointments, process refunds, and track payment status</span>
            </li>
            <li className="flex items-start">
              <span className="text-dark-sage mr-2">•</span>
              <span><strong>Services:</strong> Manage your service catalog, sync with Hapio and Stripe, and control pricing</span>
            </li>
            <li className="flex items-start">
              <span className="text-dark-sage mr-2">•</span>
              <span><strong>Employees & Locations:</strong> Configure staff schedules and location settings</span>
            </li>
            <li className="flex items-start">
              <span className="text-dark-sage mr-2">•</span>
              <span><strong>Schedules:</strong> Set up recurring availability and manage time blocks</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white border border-sand rounded-lg p-4 md:p-6">
        <h2 className="text-lg md:text-xl font-semibold text-charcoal mb-3 md:mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <button
            onClick={() => onNavigate?.('bookings')}
            className="flex items-center gap-2 md:gap-3 px-4 py-3 bg-dark-sage text-white rounded-lg hover:bg-dark-sage/80 transition-colors text-xs md:text-sm font-medium min-h-[44px]"
          >
            <BookOpen className="w-4 h-4 md:w-5 md:h-5" />
            View Bookings
          </button>
          <button
            onClick={() => onNavigate?.('services')}
            className="flex items-center gap-2 md:gap-3 px-4 py-3 bg-sage-light text-charcoal rounded-lg hover:bg-sage-light/80 transition-colors text-xs md:text-sm font-medium min-h-[44px]"
          >
            <Settings className="w-4 h-4 md:w-5 md:h-5" />
            Manage Services
          </button>
          <button
            onClick={() => onNavigate?.('resources-locations')}
            className="flex items-center gap-2 md:gap-3 px-4 py-3 bg-sage-light text-charcoal rounded-lg hover:bg-sage-light/80 transition-colors text-xs md:text-sm font-medium min-h-[44px]"
          >
            <Users className="w-4 h-4 md:w-5 md:h-5" />
            Employees & Locations
          </button>
          <button
            onClick={() => onNavigate?.('schedules')}
            className="flex items-center gap-2 md:gap-3 px-4 py-3 bg-sage-light text-charcoal rounded-lg hover:bg-sage-light/80 transition-colors text-xs md:text-sm font-medium min-h-[44px]"
          >
            <Clock className="w-4 h-4 md:w-5 md:h-5" />
            Configure Schedules
          </button>
        </div>
      </div>
    </div>
  );
}

