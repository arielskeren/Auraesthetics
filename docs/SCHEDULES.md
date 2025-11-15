# Hapio Schedule Management Documentation

## Overview

This document describes the schedule management system for the Hapio admin dashboard. The system supports three types of schedules:

1. **Recurring Schedules** - Base working hours patterns (e.g., Mon-Fri 10:00-18:00)
2. **Schedule Blocks** - One-off exceptions (e.g., closed on 2025-12-25)
3. **Recurring Schedule Blocks** - Recurring exceptions (e.g., closed every Wednesday afternoon)

## How Hapio Merges Schedules

Hapio combines schedules in the following priority order (highest to lowest):

1. **Schedule Blocks** (one-off) - Override everything for specific dates
2. **Recurring Schedule Blocks** (exceptions) - Override recurring schedules for specific days of week
3. **Recurring Schedules** (base) - Normal working hours

The effective schedule is calculated as:
```
Effective Schedule = Recurring Schedules ⊖ Recurring Schedule Blocks ⊖ Schedule Blocks
```

## API Endpoints

### Recurring Schedules

**Base Path**: `/v1/resources/{resourceId}/recurring-schedules`

- `GET /v1/resources/{resourceId}/recurring-schedules` - List all recurring schedules
- `GET /v1/resources/{resourceId}/recurring-schedules/{scheduleId}` - Get a specific recurring schedule
- `POST /v1/resources/{resourceId}/recurring-schedules` - Create a new recurring schedule
- `PATCH /v1/resources/{resourceId}/recurring-schedules/{scheduleId}` - Partially update a recurring schedule
- `PUT /v1/resources/{resourceId}/recurring-schedules/{scheduleId}` - Replace a recurring schedule
- `DELETE /v1/resources/{resourceId}/recurring-schedules/{scheduleId}` - Delete a recurring schedule

### Recurring Schedule Blocks

**Base Path**: `/v1/resources/{resourceId}/recurring-schedule-blocks`

- `GET /v1/resources/{resourceId}/recurring-schedule-blocks` - List all recurring schedule blocks
- `GET /v1/resources/{resourceId}/recurring-schedule-blocks/{blockId}` - Get a specific recurring schedule block
- `POST /v1/resources/{resourceId}/recurring-schedule-blocks` - Create a new recurring schedule block
- `PATCH /v1/resources/{resourceId}/recurring-schedule-blocks/{blockId}` - Partially update a recurring schedule block
- `PUT /v1/resources/{resourceId}/recurring-schedule-blocks/{blockId}` - Replace a recurring schedule block
- `DELETE /v1/resources/{resourceId}/recurring-schedule-blocks/{blockId}` - Delete a recurring schedule block

### Schedule Blocks

**Base Path**: `/v1/resources/{resourceId}/schedule-blocks`

- `GET /v1/resources/{resourceId}/schedule-blocks` - List all schedule blocks (supports `from` and `to` query params)
- `GET /v1/resources/{resourceId}/schedule-blocks/{blockId}` - Get a specific schedule block
- `POST /v1/resources/{resourceId}/schedule-blocks` - Create a new schedule block
- `PATCH /v1/resources/{resourceId}/schedule-blocks/{blockId}` - Partially update a schedule block
- `PUT /v1/resources/{resourceId}/schedule-blocks/{blockId}` - Replace a schedule block
- `DELETE /v1/resources/{resourceId}/schedule-blocks/{blockId}` - Delete a schedule block

## TypeScript Interfaces

### RecurringSchedule

```typescript
export interface HapioRecurringSchedule {
  id: string;
  name?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}
```

### RecurringSchedulePayload

```typescript
export interface HapioRecurringSchedulePayload {
  name?: string | null;
  metadata?: Record<string, unknown> | null;
}
```

### RecurringScheduleBlock

```typescript
export interface HapioRecurringScheduleBlock {
  id: string;
  recurring_schedule_id: string;
  day_of_week?: number | null; // 0 = Sunday, 6 = Saturday
  start_time?: string | null; // HH:mm format
  end_time?: string | null; // HH:mm format
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}
```

### RecurringScheduleBlockPayload

```typescript
export interface HapioRecurringScheduleBlockPayload {
  recurring_schedule_id: string;
  day_of_week?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  metadata?: Record<string, unknown> | null;
}
```

### ScheduleBlock

```typescript
export interface HapioScheduleBlock {
  id: string;
  starts_at: string; // ISO 8601 format with timezone
  ends_at: string; // ISO 8601 format with timezone
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}
```

### ScheduleBlockPayload

```typescript
export interface HapioScheduleBlockPayload {
  starts_at: string; // ISO 8601 format with timezone
  ends_at: string; // ISO 8601 format with timezone
  metadata?: Record<string, unknown> | null;
}
```

## Example Payloads

### Create Recurring Schedule

```json
{
  "name": "Schedule from 2025-11-15",
  "metadata": {
    "start_date": "2025-11-15",
    "end_date": null
  }
}
```

### Create Recurring Schedule Block

```json
{
  "recurring_schedule_id": "schedule-id-here",
  "day_of_week": 1,
  "start_time": "09:00",
  "end_time": "17:00",
  "metadata": {
    "service_ids": ["service-id-1", "service-id-2"]
  }
}
```

### Create Schedule Block

```json
{
  "starts_at": "2025-12-25T00:00:00+00:00",
  "ends_at": "2025-12-25T23:59:59+00:00",
  "metadata": {
    "service_ids": []
  }
}
```

## Usage Examples

### Creating a Weekly Schedule

1. Create a recurring schedule (parent):
```typescript
const schedule = await createRecurringSchedule('resource', resourceId, {
  name: 'Weekly Schedule',
  metadata: {
    start_date: '2025-11-15',
    end_date: null, // Indefinite
  },
});
```

2. Create recurring schedule blocks for each day:
```typescript
// Monday
await createRecurringScheduleBlock('resource', resourceId, {
  recurring_schedule_id: schedule.id,
  day_of_week: 1,
  start_time: '09:00',
  end_time: '17:00',
  metadata: {
    service_ids: ['service-1', 'service-2'],
  },
});

// Tuesday
await createRecurringScheduleBlock('resource', resourceId, {
  recurring_schedule_id: schedule.id,
  day_of_week: 2,
  start_time: '09:00',
  end_time: '17:00',
  metadata: {
    service_ids: ['service-1', 'service-2'],
  },
});
```

### Creating a One-Off Block (Closed Day)

```typescript
await createScheduleBlock('resource', resourceId, {
  starts_at: '2025-12-25T00:00:00+00:00',
  ends_at: '2025-12-25T23:59:59+00:00',
  metadata: {
    service_ids: [], // Empty = closed
  },
});
```

### Creating a Recurring Exception

1. Create a recurring schedule marked as exception:
```typescript
const exceptionSchedule = await createRecurringSchedule('resource', resourceId, {
  name: 'Recurring exceptions',
  metadata: {
    start_date: '2025-11-15',
    end_date: null,
    is_exception: true,
  },
});
```

2. Create recurring schedule blocks for exception days:
```typescript
// Closed every Wednesday afternoon
await createRecurringScheduleBlock('resource', resourceId, {
  recurring_schedule_id: exceptionSchedule.id,
  day_of_week: 3, // Wednesday
  start_time: '13:00',
  end_time: '17:00',
  metadata: {
    service_ids: [], // Closed
  },
});
```

## Date and Time Formats

- **Date ranges**: `YYYY-MM-DD` format (e.g., `2025-11-15`)
- **Time ranges**: `HH:mm` format (e.g., `09:00`, `17:00`)
- **ISO timestamps**: Full ISO 8601 with timezone (e.g., `2025-12-25T00:00:00+00:00`)
- **Day of week**: Integer (0 = Sunday, 1 = Monday, ..., 6 = Saturday)

## Service Selection

Services can be associated with schedules via the `metadata.service_ids` array:

- Empty array `[]` = Closed (no services available)
- Array with service IDs = Only those services available
- Omitted or `null` = All services available (default)

## Overlap Prevention

The system prevents overlapping schedules for the same day:

- **Recurring Schedules**: Cannot overlap with other recurring schedules on the same day
- **Recurring Schedule Blocks**: Cannot overlap with other recurring schedule blocks on the same day
- **Schedule Blocks**: Can overlap (Hapio handles priority)

Use the `detectOverlaps()` and `validateSchedule()` functions from `lib/scheduleUtils.ts` to check before saving.

## Error Handling

All API functions throw errors with:
- `error.message` - Human-readable error message
- `error.status` - HTTP status code
- `error.response?.data` - Detailed error response from Hapio API

Handle errors gracefully in UI components using `ErrorDisplay` component.

## Best Practices

1. **Always validate** schedules before saving using `validateSchedule()`
2. **Check for overlaps** using `detectOverlaps()` before creating new schedules
3. **Use metadata** to store additional information (date ranges, service IDs, etc.)
4. **Set date ranges** appropriately - use indefinite for ongoing schedules
5. **Service selection** - Default to all services, only restrict when needed
6. **Test thoroughly** - Verify schedules work as expected before going live

## Notes

- **Postman Collection**: Exact field names and formats should be verified from the official Hapio Postman collection
- **API Version**: This documentation is based on the current implementation and may need updates when exact Postman schemas are provided
- **Timezone**: All times should be in the location's timezone (stored in location.timezone)
- **Date Ranges**: Start date is required, end date is optional (null = indefinite)

