import React, { useEffect, useMemo } from 'react';
import WheelPicker from './WheelPicker';

type DateItem = { label: string; value: string };

export interface DateWheelProps {
  startDate?: Date; // default: today
  days?: number; // default: 120
  value: string; // 'YYYY-MM-DD'
  onChange: (value: string) => void;
  className?: string;
}

function formatDateLabel(d: Date) {
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(d);
  const month = new Date(d).toLocaleString(undefined, { month: 'short' });
  const day = String(d.getDate()).padStart(2, '0');
  return `${weekday} ${month} ${day}`;
}

function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function DateWheel({ startDate, days = 120, value, onChange, className }: DateWheelProps) {
  const base = useMemo(() => {
    const today = startDate ? new Date(startDate) : new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }, [startDate]);

  const items: DateItem[] = useMemo(() => {
    const arr: DateItem[] = [];
    for (let i = 0; i <= days; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      arr.push({ label: formatDateLabel(d), value: toYMD(d) });
    }
    return arr;
  }, [base, days]);

  // Ensure value is within range; if empty, set to base
  useEffect(() => {
    if (!value) {
      onChange(toYMD(base));
    }
  }, [base, onChange, value]);

  return (
    <div className={className}>
      <WheelPicker
        items={items}
        value={value || items[0]?.value}
        onChange={onChange}
        itemHeight={44}
        visibleCount={5}
      />
    </div>
  );
}


