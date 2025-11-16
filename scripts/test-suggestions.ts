import { suggestSlots, computeFiveDayWindow } from '../lib/scheduling/suggestions';

const slots = [
  // Same day around 10:00
  { start: '2025-11-17T09:30:00.000Z', end: '2025-11-17T10:30:00.000Z' },
  { start: '2025-11-17T10:00:00.000Z', end: '2025-11-17T11:00:00.000Z' },
  { start: '2025-11-17T11:00:00.000Z', end: '2025-11-17T12:00:00.000Z' },
  // Previous working day near 10:00
  { start: '2025-11-14T10:00:00.000Z', end: '2025-11-14T11:00:00.000Z' },
  // Next working days near 10:00
  { start: '2025-11-18T10:00:00.000Z', end: '2025-11-18T11:00:00.000Z' },
  { start: '2025-11-19T10:00:00.000Z', end: '2025-11-19T11:00:00.000Z' },
];

const requestedDate = '2025-11-17'; // Monday
const requestedTime = '10:00';

console.log('Five-day window:', computeFiveDayWindow(requestedDate));
const suggested = suggestSlots(slots, requestedDate, requestedTime);
console.log('Suggested count:', suggested.length);
console.log('Suggested:', suggested);


