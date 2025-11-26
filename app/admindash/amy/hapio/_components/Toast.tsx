'use client';

import { useEffect } from 'react';
import { CheckCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, onClose, duration = 5000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] animate-in slide-in-from-top-5 fade-in">
      <div className="bg-green-50 border border-green-200 rounded-lg shadow-lg p-4 flex items-center gap-3 min-w-[300px] max-w-md">
        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
        <p className="text-sm text-green-800 flex-1">{message}</p>
        <button
          onClick={onClose}
          className="text-green-600 hover:text-green-800 transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

