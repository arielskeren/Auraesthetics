'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface IdDisplayProps {
  id: string | null | undefined;
  label?: string;
  className?: string;
}

export default function IdDisplay({ id, label, className = '' }: IdDisplayProps) {
  const [copied, setCopied] = useState(false);

  if (!id) {
    return <span className={`text-warm-gray ${className}`}>—</span>;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy ID:', err);
    }
  };

  return (
    <div className={`flex items-center gap-2 group ${className}`}>
      <span className="text-xs text-warm-gray font-mono">{id}</span>
      <button
        onClick={handleCopy}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-sage-light rounded"
        title={`Copy ${label || 'ID'}`}
      >
        {copied ? (
          <Check className="w-3 h-3 text-green-600" />
        ) : (
          <Copy className="w-3 h-3 text-dark-sage" />
        )}
      </button>
    </div>
  );
}

