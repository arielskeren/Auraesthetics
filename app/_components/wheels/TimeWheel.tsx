import React, { useEffect, useMemo } from 'react';
import WheelPicker from './WheelPicker';

type TimeItem = { label: string; value: string }; // value: 'HH:MM'

export interface TimeWheelProps {
  value: string; // 'HH:MM'
  onChange: (value: string) => void;
  stepMinutes?: number; // default: 30
  startHour?: number; // default: 7
  endHour?: number; // exclusive end, default: 21 means up to 20:30
  includeEnd?: boolean; // if true, also include exactly endHour:00 as last option
  className?: string;
}

function toHM(h: number, m: number) {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function formatHM(h: number, m: number) {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(d);
}

export default function TimeWheel({
  value,
  onChange,
  stepMinutes = 30,
  startHour = 7,
  endHour = 21,
  includeEnd = false,
  className,
}: TimeWheelProps) {
  const items: TimeItem[] = useMemo(() => {
    const arr: TimeItem[] = [];
    for (let h = startHour; h < endHour; h++) {
      for (let m = 0; m < 60; m += stepMinutes) {
        const v = toHM(h, m);
        arr.push({ label: formatHM(h, m), value: v });
      }
    }
    if (includeEnd && endHour > startHour) {
      // include exactly endHour:00 as final selectable value
      arr.push({ label: formatHM(endHour, 0), value: toHM(endHour, 0) });
    }
    return arr;
  }, [startHour, endHour, stepMinutes, includeEnd]);

  useEffect(() => {
    if (!value && items.length) {
      onChange(items[0].value);
    }
  }, [items, onChange, value]);

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


