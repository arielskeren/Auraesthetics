import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type WheelItem<T> = {
  label: string;
  value: T;
};

export interface WheelPickerProps<T> {
  items: WheelItem<T>[];
  value: T;
  onChange: (value: T) => void;
  itemHeight?: number; // px
  visibleCount?: number; // odd number, e.g., 5 or 7
  className?: string;
}

/**
 * Generic scroll-wheel picker with CSS scroll snapping.
 * - Renders items in a vertical scroll container with a centered selection window.
 * - Updates selected value when the center item changes.
 */
export default function WheelPicker<T extends string | number>({
  items,
  value,
  onChange,
  itemHeight = 44,
  visibleCount = 5,
  className = '',
}: WheelPickerProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [internalIndex, setInternalIndex] = useState<number>(() =>
    Math.max(0, items.findIndex((i) => i.value === value))
  );

  const containerHeight = useMemo(
    () => itemHeight * (visibleCount % 2 === 1 ? visibleCount : visibleCount + 1),
    [itemHeight, visibleCount]
  );

  useEffect(() => {
    const idx = items.findIndex((i) => i.value === value);
    if (idx >= 0 && idx !== internalIndex) {
      setInternalIndex(idx);
      // center the selected item
      const el = containerRef.current;
      if (el) {
        el.scrollTo({
          top: Math.max(0, idx * itemHeight - Math.floor(visibleCount / 2) * itemHeight),
          behavior: 'auto',
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, items.length]);

  const onScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const centerOffset = el.scrollTop + containerHeight / 2;
    const idx = Math.round((centerOffset - itemHeight / 2) / itemHeight);
    const bounded = Math.min(Math.max(idx, 0), items.length - 1);
    if (bounded !== internal.current._idx) {
      setInternalIndex(bounded);
    }
  }, [containerHeight, itemHeight, items.length]);

  // Sync selected value after scroll settles
  const internal = useRef<{ timer: number | null; _idx: number }>({ timer: null, _idx: internalIndex });
  useEffect(() => {
    internal.current._idx = internalIndex;
    if (internal.current.timer) {
      window.clearTimeout(internal.current.timer);
    }
    // Debounce to allow snap to finish
    internal.current.timer = window.setTimeout(() => {
      const idx = internal.current._idx;
      if (idx >= 0 && idx < items.length) {
        const next = items[idx].value;
        if (next !== value) {
          onChange(next);
        }
      }
    }, 80);
    return () => {
      if (internal.current.timer) {
        window.clearTimeout(internal.current.timer);
        internal.current.timer = null;
      }
    };
  }, [internalIndex, items, onChange, value]);

  const onItemClick = useCallback(
    (idx: number) => {
      const el = containerRef.current;
      if (!el) return;
      el.scrollTo({
        top: Math.max(0, idx * itemHeight - Math.floor(visibleCount / 2) * itemHeight),
        behavior: 'smooth',
      });
    },
    [itemHeight, visibleCount]
  );

  return (
    <div className={className} style={{ position: 'relative', height: `${containerHeight}px` }}>
      <div
        ref={containerRef}
        className="overflow-y-auto hide-scrollbar snap-y snap-mandatory"
        style={{
          scrollSnapType: 'y mandatory',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
        onScroll={onScroll}
      >
        <div style={{ paddingTop: `${Math.floor(visibleCount / 2) * itemHeight}px` }} />
        {items.map((it, idx) => {
          const isActive = idx === internalIndex;
          return (
            <div
              key={`${String(it.value)}-${idx}`}
              onClick={() => onItemClick(idx)}
              className={`snap-center select-none cursor-pointer flex items-center justify-center ${
                isActive ? 'text-charcoal font-semibold' : 'text-warm-gray'
              }`}
              style={{ height: `${itemHeight}px` }}
            >
              {it.label}
            </div>
          );
        })}
        <div style={{ paddingBottom: `${Math.floor(visibleCount / 2) * itemHeight}px` }} />
      </div>
      {/* Selection indicator */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 right-0"
        style={{
          top: `${(containerHeight - itemHeight) / 2}px`,
          height: `${itemHeight}px`,
          borderTop: '1px solid rgba(0,0,0,0.08)',
          borderBottom: '1px solid rgba(0,0,0,0.08)',
        }}
      />
      <style jsx>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}


