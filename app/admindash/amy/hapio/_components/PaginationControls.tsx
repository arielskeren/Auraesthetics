'use client';

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
  from?: number | null;
  to?: number | null;
}

interface PaginationLinks {
  first?: string | null;
  last?: string | null;
  next?: string | null;
  prev?: string | null;
}

interface PaginationControlsProps {
  meta: PaginationMeta;
  links?: PaginationLinks;
  onPageChange: (page: number) => void;
  className?: string;
}

export default function PaginationControls({
  meta,
  links,
  onPageChange,
  className = '',
}: PaginationControlsProps) {
  const { current_page, last_page, total, from, to } = meta;

  if (total === 0) {
    return null;
  }

  return (
    <div className={`flex items-center justify-between ${className}`}>
      <div className="text-sm text-warm-gray">
        Showing {from ?? 0} to {to ?? 0} of {total} results
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(1)}
          disabled={current_page === 1}
          className="p-2 rounded border border-sand disabled:opacity-50 disabled:cursor-not-allowed hover:bg-sand/30 transition-colors"
          aria-label="First page"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => onPageChange(current_page - 1)}
          disabled={current_page === 1 || !links?.prev}
          className="p-2 rounded border border-sand disabled:opacity-50 disabled:cursor-not-allowed hover:bg-sand/30 transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm text-charcoal px-3">
          Page {current_page} of {last_page}
        </span>
        <button
          onClick={() => onPageChange(current_page + 1)}
          disabled={current_page === last_page || !links?.next}
          className="p-2 rounded border border-sand disabled:opacity-50 disabled:cursor-not-allowed hover:bg-sand/30 transition-colors"
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => onPageChange(last_page)}
          disabled={current_page === last_page}
          className="p-2 rounded border border-sand disabled:opacity-50 disabled:cursor-not-allowed hover:bg-sand/30 transition-colors"
          aria-label="Last page"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

