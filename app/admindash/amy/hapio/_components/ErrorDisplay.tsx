'use client';

import { AlertCircle } from 'lucide-react';
import { formatErrorForUI } from '@/lib/hapioErrors';

interface ErrorDisplayProps {
  error: any;
  className?: string;
}

export default function ErrorDisplay({ error, className = '' }: ErrorDisplayProps) {
  const formatted = formatErrorForUI(error);

  return (
    <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-semibold text-red-800 mb-1">Error</h4>
          <p className="text-sm text-red-700">{formatted.message}</p>
          {formatted.fieldErrors && formatted.fieldErrors.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-xs font-medium text-red-800">Field errors:</p>
              <ul className="list-disc list-inside text-xs text-red-700 space-y-0.5">
                {formatted.fieldErrors.map((fieldError, idx) => (
                  <li key={idx}>
                    <span className="font-medium">{fieldError.field}:</span> {fieldError.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

