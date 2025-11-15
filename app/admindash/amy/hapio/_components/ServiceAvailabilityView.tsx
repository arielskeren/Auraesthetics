'use client';

import { Calendar } from 'lucide-react';

interface ServiceAvailabilityViewProps {
  serviceId: string;
}

export default function ServiceAvailabilityView({ serviceId }: ServiceAvailabilityViewProps) {
  return (
    <div className="bg-white border border-sand rounded-lg p-6 text-center text-warm-gray">
      <Calendar className="w-12 h-12 mx-auto mb-3 text-warm-gray/50" />
      <p>Service availability view coming soon</p>
      <p className="text-sm mt-2">Service ID: {serviceId}</p>
    </div>
  );
}

