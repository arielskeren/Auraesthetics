'use client';

import { Calendar, List, Grid, Clock } from 'lucide-react';

export type ViewMode = 'day' | 'week' | 'month' | 'list';

interface ViewModeSwitcherProps {
  currentMode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
}

export default function ViewModeSwitcher({
  currentMode,
  onModeChange,
}: ViewModeSwitcherProps) {
  const modes: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
    { id: 'day', label: 'Day', icon: <Clock className="w-4 h-4" /> },
    { id: 'week', label: 'Week', icon: <Calendar className="w-4 h-4" /> },
    { id: 'month', label: 'Month', icon: <Grid className="w-4 h-4" /> },
    { id: 'list', label: 'List', icon: <List className="w-4 h-4" /> },
  ];

  return (
    <div className="flex items-center gap-2 bg-white border border-sand rounded-lg p-1">
      {modes.map((mode) => (
        <button
          key={mode.id}
          onClick={() => onModeChange(mode.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            currentMode === mode.id
              ? 'bg-dark-sage text-charcoal'
              : 'text-warm-gray hover:text-charcoal hover:bg-sand/20'
          }`}
        >
          {mode.icon}
          {mode.label}
        </button>
      ))}
    </div>
  );
}

