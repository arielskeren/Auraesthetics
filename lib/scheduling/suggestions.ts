export type AvailabilitySlot = {
  start: string;
  end: string;
};

export function computeFiveDayWindow(requestedDate: string): string[] {
  const chosenDate = new Date(requestedDate + 'T00:00:00');
  // Exclude only Saturdays (day 6). Sundays (day 0) are work days.
  const isWorkingDay = (d: Date) => {
    const day = d.getDay();
    return day !== 6; // Only exclude Saturday
  };
  const prev: Date[] = [];
  const next: Date[] = [];
  {
    const c = new Date(chosenDate);
    for (let i = 0; i < 14 && prev.length < 2; i++) {
      c.setDate(c.getDate() - 1);
      if (isWorkingDay(c)) prev.push(new Date(c));
    }
  }
  {
    const c = new Date(chosenDate);
    for (let i = 0; i < 14 && next.length < 2; i++) {
      c.setDate(c.getDate() + 1);
      if (isWorkingDay(c)) next.push(new Date(c));
    }
  }
  const ordered = [...prev.reverse(), chosenDate, ...next];
  return ordered.map((d) => d.toISOString().split('T')[0]);
}

export function suggestSlots(
  slots: AvailabilitySlot[],
  requestedDate: string,
  requestedTime: string
): AvailabilitySlot[] {
  if (!slots.length || !requestedDate || !requestedTime) return [];
  const [rh, rm] = requestedTime.split(':').map((v) => Number(v));
  const targetMinutes = rh * 60 + rm;

  const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();
  const dayKey = (d: Date) => d.toISOString().split('T')[0];

  const byDay = new Map<string, AvailabilitySlot[]>();
  for (const s of slots) {
    const d = new Date(s.start);
    const k = dayKey(d);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(s);
  }

  const windowKeys = computeFiveDayWindow(requestedDate);
  const score = (s: AvailabilitySlot) => {
    const d = new Date(s.start);
    return Math.abs(minutesOfDay(d) - targetMinutes);
  };
  const pickTop = (arr: AvailabilitySlot[], n: number) =>
    arr.slice().sort((a, b) => score(a) - score(b)).slice(0, n);

  const chosenKey = requestedDate;
  const prevKeys = windowKeys.slice(0, 2);
  const nextKeys = windowKeys.slice(3);

  const result: AvailabilitySlot[] = [];
  if (byDay.has(chosenKey)) result.push(...pickTop(byDay.get(chosenKey)!, 7));
  for (const k of prevKeys) if (byDay.has(k)) result.push(...pickTop(byDay.get(k)!, 7));
  for (const k of nextKeys) if (byDay.has(k)) result.push(...pickTop(byDay.get(k)!, 7));
  return result.slice(0, 35);
}


