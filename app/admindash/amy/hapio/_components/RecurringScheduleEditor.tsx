'use client';

import { Calendar } from 'lucide-react';

export default function RecurringScheduleEditor() {
  return (
    <div className="bg-white border border-sand rounded-lg p-6 text-center text-warm-gray">
      <Calendar className="w-12 h-12 mx-auto mb-3 text-warm-gray/50" />
      <p>Recurring schedule editor coming soon</p>
      <p className="text-sm mt-2">Configure recurring availability patterns</p>
    </div>
  );
}

