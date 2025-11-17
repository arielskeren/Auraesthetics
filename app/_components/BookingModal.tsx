'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, Loader2, RefreshCcw, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useBodyScrollLock } from '../_hooks/useBodyScrollLock';
import CustomPaymentModal from './CustomPaymentModal';
import Button from './Button';
import { computeFiveDayWindow } from '@/lib/scheduling/suggestions';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: {
    name: string;
    summary: string;
    description?: string;
    duration: string;
    price: string;
    category: string;
    slug?: string;
  } | null;
}

export default function BookingModal({ isOpen, onClose, service }: BookingModalProps) {
  useBodyScrollLock(isOpen);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [availabilityStatus, setAvailabilityStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
    'idle'
  );
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [requestedDate, setRequestedDate] = useState<string>(''); // YYYY-MM-DD
  const [requestedTime, setRequestedTime] = useState<string>(''); // HH:MM
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [daySlots, setDaySlots] = useState<AvailabilitySlot[]>([]);
  const [timeValidationError, setTimeValidationError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [deferredSlot, setDeferredSlot] = useState<AvailabilitySlot | null>(null);
  const [availabilityTimezone, setAvailabilityTimezone] = useState<string | null>(null);
  const [pendingBooking, setPendingBooking] = useState<PendingBooking | null>(null);
  const [lockStatus, setLockStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [lockError, setLockError] = useState<string | null>(null);
  const [collapseTimes, setCollapseTimes] = useState<boolean>(false);

  // Always use EST for bookings (business is in Florida)
  const userTimezone = 'America/New_York';

  // Do not prefetch availability. Fetch only after user selects date+time and searches.

  useEffect(() => {
    if (!isOpen) {
      setDeferredSlot(null);
      setSelectedSlot(null);
      setPendingBooking(null);
      setLockStatus('idle');
      setLockError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!selectedSlot) {
      return;
    }

    setDeferredSlot(selectedSlot);
    setCollapseTimes(true);
  }, [selectedSlot]);

  useEffect(() => {
    if (selectedSlot || lockStatus === 'loading') {
      return;
    }
    setPendingBooking(null);
    setLockError(null);
  }, [selectedSlot, lockStatus]);

  useEffect(() => {
    setPendingBooking(null);
    setLockError(null);
  }, [service?.slug, reloadToken]);

  // Seed default requested date to today when modal opens
  useEffect(() => {
    if (!isOpen) return;
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const today = `${yyyy}-${mm}-${dd}`;
    setRequestedDate(today);
  }, [isOpen]);

  // Local session cache for availability window responses
  const availabilityCacheRef = useRef<Map<string, AvailabilityApiResponse>>(new Map());

  // Generate every 15-minute time from 09:00 to 19:00 for the requested date
  const timeOptionsForDay = useMemo(() => {
    if (!requestedDate) return [] as Date[];
    const start = new Date(`${requestedDate}T09:00:00`);
    const end = new Date(`${requestedDate}T19:00:00`);
    const result: Date[] = [];
    const cursor = new Date(start);
    while (cursor.getTime() <= end.getTime()) {
      result.push(new Date(cursor));
      cursor.setMinutes(cursor.getMinutes() + 15);
    }
    return result;
  }, [requestedDate]);

  // Default requested time to the first valid option (future if today), else 09:00
  useEffect(() => {
    if (!requestedDate) return;
    const now = new Date();
    const isToday =
      now.getFullYear() === new Date(requestedDate).getFullYear() &&
      now.getMonth() === new Date(requestedDate).getMonth() &&
      now.getDate() === new Date(requestedDate).getDate();
    let firstValid: Date | null = null;
    if (isToday) {
      firstValid = timeOptionsForDay.find((d) => d.getTime() >= now.getTime()) || null;
    } else {
      firstValid = timeOptionsForDay[0] || null;
    }
    if (firstValid) {
      const hh = String(firstValid.getHours()).padStart(2, '0');
      const mi = String(firstValid.getMinutes()).padStart(2, '0');
      setRequestedTime((prev) => prev || `${hh}:${mi}`);
      setTimeValidationError(null);
    } else {
      setRequestedTime('');
      setTimeValidationError(null);
    }
  }, [requestedDate, timeOptionsForDay]);

  // Recompute daySlots when requestedDate changes using already-fetched window slots
  useEffect(() => {
    if (!requestedDate || slots.length === 0) {
      // If we haven't fetched window availability yet, clear
      setDaySlots([]);
      return;
    }
    const dayStart = new Date(`${requestedDate}T00:00:00`);
    const dayEnd = new Date(`${requestedDate}T23:59:59`);
    const dayAvail = slots.filter((s) => {
      const sStart = new Date(s.start);
      return sStart >= dayStart && sStart <= dayEnd;
    });
    setDaySlots(dayAvail);
  }, [requestedDate, slots]);

  // Validate that selected date+time is not in the past
  useEffect(() => {
    if (!requestedDate || !requestedTime) {
      setTimeValidationError(null);
      return;
    }
    const [hh, mm] = requestedTime.split(':').map((v) => Number(v));
    const chosen = new Date(`${requestedDate}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`);
    const now = new Date();
    if (chosen.getTime() < now.getTime()) {
      setTimeValidationError('Please select a time in the future.');
    } else {
      setTimeValidationError(null);
    }
  }, [requestedDate, requestedTime]);

  const groupedAvailability = useMemo(() => {
    if (slots.length === 0) {
      return [];
    }

    // Group by day for display - always use EST
    const dateFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
    });

    // Helper to get hour in EST
    const getHourInEST = (date: Date): number => {
      return parseInt(
        new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/New_York',
          hour: '2-digit',
          hour12: false,
        }).format(date)
      );
    };

    // Helper to get date string in EST (YYYY-MM-DD)
    const getDateKeyInEST = (date: Date): string => {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(date);
      const year = parts.find((p) => p.type === 'year')?.value ?? '';
      const month = parts.find((p) => p.type === 'month')?.value ?? '';
      const day = parts.find((p) => p.type === 'day')?.value ?? '';
      return `${year}-${month}-${day}`;
    };

    const groups = new Map<string, AvailabilityDay>();

    for (const slot of slots) {
      const startDate = new Date(slot.start);
      const endDate = new Date(slot.end);
      
      // Filter: Only show slots between 9 AM - 7 PM EST
      const startHourEST = getHourInEST(startDate);
      if (startHourEST < 9 || startHourEST >= 19) {
        continue; // Skip slots outside business hours
      }

      // Use EST date for grouping (not UTC)
      const dayKey = getDateKeyInEST(startDate);
      const dayLabel = dateFormatter.format(startDate);

      if (!groups.has(dayKey)) {
        groups.set(dayKey, {
          key: dayKey,
          label: dayLabel,
          slots: [],
        });
      }

      groups.get(dayKey)!.slots.push({
        slot,
        startLabel: timeFormatter.format(startDate),
        endLabel: timeFormatter.format(endDate),
      });
    }

    // Sort slots within each day by start time
    const sortedGroups = Array.from(groups.values()).map((group) => ({
      ...group,
      slots: group.slots.sort((a, b) => {
        const timeA = new Date(a.slot.start).getTime();
        const timeB = new Date(b.slot.start).getTime();
        return timeA - timeB;
      }),
    }));

    return sortedGroups.sort((a, b) => a.key.localeCompare(b.key));
  }, [slots]);

  const hasAvailability = groupedAvailability.length > 0;

  // Compute a 5‑day window (chosen day centered with two working days before and after)
  const fiveDayWindow = useMemo(() => {
    if (!requestedDate) return [];
    const keys = computeFiveDayWindow(requestedDate);
    const fmtDay = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    return keys.map((k) => {
      const d = new Date(k + 'T00:00:00');
      return { key: k, label: fmtDay.format(d) };
    });
  }, [requestedDate]);

  // No suggested slots section; show only daily breakdown grid

  const handleSearchAvailability = async () => {
    if (!service?.slug) return;
    // Require date and time before searching
    if (!requestedDate || !requestedTime || timeValidationError) {
      setAvailabilityStatus('error');
      setAvailabilityError(timeValidationError || 'Please select a date and time to search.');
      return;
    }

    const abortController = new AbortController();
    setAvailabilityStatus('loading');
    setAvailabilityError(null);
    setSelectedSlot(null);
    setDeferredSlot(null);
    setPendingBooking(null);
    setLockError(null);
    setAvailabilityTimezone(null);

    try {
      // Build a window covering the chosen day ± two working days (Mon–Fri).
      const [hour, minute] = requestedTime.split(':').map((v) => Number(v));
      const chosen = new Date(`${requestedDate}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`);

      const isWorkingDay = (d: Date) => {
        const day = d.getDay(); // 0 Sun ... 6 Sat
        return day !== 0 && day !== 6;
      };
      const prevWorkingDays: Date[] = [];
      const nextWorkingDays: Date[] = [];

      // Walk backwards to collect two prior working days
      {
        const cursor = new Date(chosen);
        for (let i = 0; i < 10 && prevWorkingDays.length < 2; i++) {
          cursor.setDate(cursor.getDate() - 1);
          if (isWorkingDay(cursor)) {
            prevWorkingDays.push(new Date(cursor));
          }
        }
      }
      // Walk forwards to collect two next working days
      {
        const cursor = new Date(chosen);
        for (let i = 0; i < 10 && nextWorkingDays.length < 2; i++) {
          cursor.setDate(cursor.getDate() + 1);
          if (isWorkingDay(cursor)) {
            nextWorkingDays.push(new Date(cursor));
          }
        }
      }

      const allDays = [...prevWorkingDays.reverse(), new Date(chosen), ...nextWorkingDays];
      const windowStart = new Date(allDays[0]);
      windowStart.setHours(0, 0, 0, 0);
      const windowEnd = new Date(allDays[allDays.length - 1]);
      windowEnd.setHours(23, 59, 59, 0);

      const params = new URLSearchParams({
        slug: service.slug,
        from: windowStart.toISOString(),
        to: windowEnd.toISOString(),
        timezone: userTimezone,
      });
      const cacheKey = `${service.slug}|${windowStart.toISOString()}|${windowEnd.toISOString()}|${userTimezone}`;
      let json: AvailabilityApiResponse | null = null;
      if (availabilityCacheRef.current.has(cacheKey)) {
        json = availabilityCacheRef.current.get(cacheKey)!;
      } else {
        const response = await fetch(`/api/availability?${params.toString()}`, {
          method: 'GET',
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          throw new Error(errorBody?.error ?? 'Failed to load availability');
        }

        json = (await response.json()) as AvailabilityApiResponse;
        availabilityCacheRef.current.set(cacheKey, json);
      }
      setSlots(json?.availability ?? []);
      setAvailabilityTimezone(json?.meta?.timezone ?? null);
      setAvailabilityStatus('success');
      // Derive daySlots for the requestedDate from the window results
      if (requestedDate) {
        const dayStart = new Date(`${requestedDate}T00:00:00`);
        const dayEnd = new Date(`${requestedDate}T23:59:59`);
        const dayAvail = (json?.availability ?? []).filter((s) => {
          const sStart = new Date(s.start);
          return sStart >= dayStart && sStart <= dayEnd;
        });
        setDaySlots(dayAvail);
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        return;
      }
      console.error('Failed to fetch Hapio availability', error);
      setAvailabilityStatus('error');
      setAvailabilityError(error?.message ?? 'Unable to load availability');
    }
  };

  const handleStartPayment = async () => {
    if (!service?.slug || !selectedSlot) {
      return;
    }

    setLockStatus('loading');
    setLockError(null);

    try {
      const response = await fetch('/api/bookings/lock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceSlug: service.slug,
          start: selectedSlot.start,
          end: selectedSlot.end,
          timezone: availabilityTimezone ?? userTimezone,
          resourceId: selectedSlot.resources?.[0]?.id ?? null,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody?.error ?? 'Failed to reserve slot. Please try again.');
      }

      const pending = (await response.json()) as PendingBooking;
      setPendingBooking(pending);
      setLockStatus('idle');
      setShowPaymentModal(true);
    } catch (error: any) {
      console.error('Failed to lock Hapio booking', error);
      setLockStatus('error');
      setLockError(error?.message ?? 'Failed to hold this time slot. Try another time.');
    }
  };

  if (!service) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              className="bg-white rounded-lg max-w-3xl w-full max-h-[85vh] overflow-hidden shadow-xl relative"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 p-2 hover:bg-sand/30 rounded-full transition-colors"
                aria-label="Close modal"
              >
                <X size={20} className="text-charcoal" />
              </button>

              {/* Content */}
              <div className="overflow-y-auto max-h-[85vh]">
                <div className="p-8">
                  {/* Header */}
                  <div className="mb-6">
                    <span className="inline-block px-3 py-1 bg-dark-sage/20 text-dark-sage text-xs font-medium rounded-full mb-3">
                      {service.category}
                    </span>
                    <h2 className="text-2xl font-serif text-charcoal mb-2">{service.name}</h2>
                    <p className="text-warm-gray text-sm">{service.summary}</p>
                  </div>

                  {/* Service Details */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-sand/30 p-4 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-warm-gray mb-1">
                        <svg className="w-4 h-4 text-dark-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">Duration</span>
                      </div>
                      <p className="text-charcoal font-medium">{service.duration}</p>
                    </div>

                    <div className="bg-sand/30 p-4 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-warm-gray mb-1">
                        <svg className="w-4 h-4 text-dark-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">Price</span>
                      </div>
                      <p className="text-charcoal font-medium">{service.price}</p>
                    </div>
                  </div>

                  {/* Description */}
                  {service.description && (
                    <div className="mb-6">
                      <h3 className="text-lg font-serif text-charcoal mb-2">About This Treatment</h3>
                      <p className="text-sm text-warm-gray leading-relaxed">{service.description}</p>
                    </div>
                  )}

                  {/* Availability Section */}
                  <div className="mb-6">
                    <div className="bg-gradient-to-br from-dark-sage/10 to-sand rounded-lg px-5 py-4 border-2 border-dark-sage/30">
                      <div className="flex items-center gap-2 mb-3">
                        <CalendarDays className="w-5 h-5 text-dark-sage" />
                        <h4 className="text-lg font-semibold text-charcoal">
                          Pick a time that works for you
                        </h4>
                      </div>

                      {/* Step 1: Date + Time picklists (no prefetch) */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                        <div className="flex flex-col">
                          <label className="text-xs text-warm-gray mb-1">Date</label>
                          <select
                            className="h-11 px-3 border border-sand rounded-lg bg-white hover:border-dark-sage focus:outline-none focus:ring-2 focus:ring-dark-sage text-sm"
                            value={requestedDate}
                            onChange={(e) => setRequestedDate(e.target.value)}
                          >
                            {Array.from({ length: 120 }).map((_, idx) => {
                              const d = new Date();
                              d.setDate(d.getDate() + idx);
                              const yyyy = String(d.getFullYear());
                              const mm = String(d.getMonth() + 1).padStart(2, '0');
                              const dd = String(d.getDate()).padStart(2, '0');
                              const value = `${yyyy}-${mm}-${dd}`;
                              const label = new Intl.DateTimeFormat(undefined, {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                              }).format(d);
                              return (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                        <div className="flex flex-col">
                          <label className="text-xs text-warm-gray mb-1">Preferred time</label>
                          <select
                            className="h-11 px-3 border border-sand rounded-lg bg-white hover:border-dark-sage focus:outline-none focus:ring-2 focus:ring-dark-sage text-sm"
                            value={requestedTime}
                            onChange={(e) => setRequestedTime(e.target.value)}
                          >
                            <option value="" disabled>
                              Select time
                            </option>
                            {timeOptionsForDay.map((d) => {
                              const now = new Date();
                              const isPast =
                                d.getFullYear() === now.getFullYear() &&
                                d.getMonth() === now.getMonth() &&
                                d.getDate() === now.getDate() &&
                                d.getTime() < now.getTime();
                              const hh = String(d.getHours()).padStart(2, '0');
                              const mi = String(d.getMinutes()).padStart(2, '0');
                              const value = `${hh}:${mi}`;
                              const label = new Intl.DateTimeFormat(undefined, {
                                hour: 'numeric',
                                minute: '2-digit',
                              }).format(d);
                              return (
                                <option key={value + d.toISOString()} value={value} disabled={isPast}>
                                  {label}
                                </option>
                              );
                            })}
                          </select>
                          {timeValidationError && (
                            <span className="mt-1 text-xs text-red-600">{timeValidationError}</span>
                          )}
                        </div>
                        <div className="flex items-center">
                          <Button
                            onClick={handleSearchAvailability}
                            className="w-full"
                            variant={timeValidationError || !requestedDate || !requestedTime ? 'disabled' : 'primary'}
                            tooltip={
                              timeValidationError
                                ? timeValidationError
                                : !requestedDate || !requestedTime
                                ? 'Choose a date and time'
                                : undefined
                            }
                          >
                            Find times
                          </Button>
                        </div>
                      </div>

                      {availabilityStatus === 'loading' && (
                        <div className="flex items-center gap-2 text-sm text-warm-gray">
                          <Loader2 className="w-4 h-4 animate-spin text-dark-sage" />
                          Checking live availability…
                        </div>
                      )}

                      {availabilityStatus === 'error' && (
                        <div className="flex flex-col gap-3 text-sm">
                          <p className="text-red-600">
                            {availabilityError || 'We could not load availability. Please try again.'}
                          </p>
                          <button
                            type="button"
                            className="inline-flex items-center gap-2 text-dark-sage font-medium underline underline-offset-4 hover:text-sage-dark"
                            onClick={() => {
                              setAvailabilityStatus('idle');
                              setAvailabilityError(null);
                              setSlots([]);
                              setSelectedSlot(null);
                              setDeferredSlot(null);
                              setReloadToken((token) => token + 1);
                            }}
                          >
                            <RefreshCcw className="w-4 h-4" />
                            Try again
                          </button>
                        </div>
                      )}

                      {availabilityStatus === 'success' && !hasAvailability && (
                        <p className="text-sm text-warm-gray">No availability for the selected date.</p>
                      )}

                      {availabilityStatus === 'success' && hasAvailability && !collapseTimes && (
                        <div className="space-y-4">
                          {/* Five‑day grid */}
                          {fiveDayWindow.length === 5 && (
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                              {fiveDayWindow.map((day) => {
                                const dayGroup = groupedAvailability.find((g) => g.key === day.key);
                                return (
                                  <div key={`grid-${day.key}`} className="border border-dark-sage/40 bg-sand/20 rounded-lg p-3">
                                    <div className="text-sm font-semibold text-charcoal mb-2">{day.label}</div>
                                    {dayGroup ? (
                                      <div className="flex flex-col gap-2">
                                        {dayGroup.slots.map(({ slot, startLabel, endLabel }) => {
                                          const isSelected =
                                            selectedSlot?.start === slot.start && selectedSlot?.end === slot.end;
                                          return (
                                            <button
                                              key={`grid-slot-${slot.start}-${slot.end}`}
                                              type="button"
                                              onClick={() => setSelectedSlot(isSelected ? null : slot)}
                                              className={`w-full text-left px-3 py-2 rounded-md border text-xs font-semibold transition-colors shadow-sm ${
                                                isSelected
                                                  ? 'bg-dark-sage text-charcoal border-dark-sage'
                                                  : 'bg-white/90 border-dark-sage/30 text-charcoal hover:bg-dark-sage/10 hover:border-dark-sage/60'
                                              }`}
                                            >
                                              {startLabel} – {endLabel}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <div className="text-xs text-warm-gray italic">No availability</div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                      {availabilityStatus === 'success' && hasAvailability && collapseTimes && selectedSlot && (
                        <div className="space-y-3">
                          <div className="border border-sand rounded-lg p-3 bg-white">
                            <div className="text-sm font-medium text-charcoal mb-1">Selected time</div>
                            <div className="text-sm text-warm-gray">
                              {new Date(selectedSlot.start).toLocaleString(undefined, {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                              })}{' '}
                              –{' '}
                              {new Date(selectedSlot.end).toLocaleTimeString(undefined, {
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>
                          <div>
                            <Button
                              onClick={() => setCollapseTimes(false)}
                              variant="secondary"
                              className="w-full"
                            >
                              Change booking time
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Time wheel overlay removed; using picklists above */}
                  {/* Booking CTA */}
                  <div className="mb-6">
                    <div className="bg-gradient-to-br from-dark-sage/10 to-sand rounded-lg p-6 text-center border-2 border-dark-sage/30">
                      <div className="flex items-center justify-center gap-2 mb-3">
                        <svg
                          className="w-6 h-6 text-dark-sage"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <h4 className="text-lg font-semibold text-charcoal">Secure Your Booking</h4>
                      </div>
                      <p className="text-sm text-warm-gray mb-4">
                        Select a time above and complete payment to hold your appointment instantly.
                      </p>
                      <Button
                        onClick={handleStartPayment}
                        className="w-full"
                        variant={
                          !selectedSlot || lockStatus === 'loading' ? 'disabled' : 'primary'
                        }
                        tooltip={
                          !selectedSlot
                            ? 'Choose an available time to continue'
                            : lockStatus === 'loading'
                            ? 'Locking your time...'
                            : undefined
                        }
                      >
                        {lockStatus === 'loading'
                          ? 'Locking your time…'
                          : selectedSlot
                          ? 'Continue to Payment'
                          : 'Select a time to continue'}
                      </Button>
                      <p className="text-xs text-warm-gray/70 text-center italic mt-3">
                        Payment required to reserve your appointment.
                      </p>
                      {lockError && (
                        <p className="text-xs text-red-600 mt-2">{lockError}</p>
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="bg-dark-sage/5 border-l-4 border-dark-sage p-4 rounded">
                    <p className="text-xs text-warm-gray">
                      <strong className="text-dark-sage">Heads up:</strong> We’ll hold your selected slot
                      while you pay so no one else can book it.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}

      {/* Payment Modal */}
      <CustomPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        service={service}
        selectedSlot={deferredSlot}
        pendingBooking={pendingBooking}
      />
    </AnimatePresence>
  );
}

type AvailabilitySlot = {
  start: string;
  end: string;
  bufferStart?: string | null;
  bufferEnd?: string | null;
  resources: Array<{
    id: string;
    name: string;
    enabled: boolean;
    metadata?: Record<string, unknown> | null;
  }>;
};

type AvailabilityApiResponse = {
  availability: Array<{
    start: string;
    end: string;
    bufferStart?: string | null;
    bufferEnd?: string | null;
    resources: Array<{
      id: string;
      name: string;
      enabled: boolean;
      metadata?: Record<string, unknown> | null;
    }>;
  }>;
  meta?: {
    timezone?: string | null;
  };
};

type AvailabilityDay = {
  key: string;
  label: string;
  slots: Array<{
    slot: AvailabilitySlot;
    startLabel: string;
    endLabel: string;
  }>;
};

type PendingBooking = {
  hapioBookingId: string;
  serviceId: string;
  locationId: string;
  resourceId: string | null;
  startsAt: string;
  endsAt: string;
  isTemporary: boolean;
  timezone: string | null;
};


