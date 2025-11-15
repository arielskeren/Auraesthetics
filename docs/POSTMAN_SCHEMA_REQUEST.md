# Hapio Postman Collection Schema Request

## Required Information

Please provide the exact JSON request/response examples from the Hapio Postman collection for the following endpoints:

### 1. Recurring Schedules

**Endpoints needed:**
- `GET /resources/{resourceId}/recurring-schedules/{scheduleId}` - Response example
- `POST /resources/{resourceId}/recurring-schedules` - Request body example
- `PATCH /resources/{resourceId}/recurring-schedules/{scheduleId}` - Request body example

**What to provide:**
- Full JSON response from GET endpoint (all fields)
- Full JSON request body from POST endpoint (all fields)
- Field names for:
  - Days of week (array? string? integer? format?)
  - Time ranges (start_time, end_time? format: HH:mm or ISO?)
  - Date ranges (from, to? format: YYYY-MM-DD or ISO?)
  - Recurrence rules (if any)
  - Service associations (if any)

### 2. Recurring Schedule Blocks

**Endpoints needed:**
- `GET /resources/{resourceId}/recurring-schedule-blocks/{blockId}` - Response example
- `POST /resources/{resourceId}/recurring-schedule-blocks` - Request body example
- `PATCH /resources/{resourceId}/recurring-schedule-blocks/{blockId}` - Request body example

**What to provide:**
- Full JSON response from GET endpoint
- Full JSON request body from POST endpoint
- Field names for:
  - Recurring schedule ID reference
  - Day of week (format?)
  - Time ranges
  - Any recurrence pattern fields

### 3. Schedule Blocks

**Endpoints needed:**
- `GET /resources/{resourceId}/schedule-blocks/{blockId}` - Response example
- `POST /resources/{resourceId}/schedule-blocks` - Request body example
- `PATCH /resources/{resourceId}/schedule-blocks/{blockId}` - Request body example

**What to provide:**
- Full JSON response from GET endpoint
- Full JSON request body from POST endpoint
- Field names for:
  - Date/time fields (starts_at, ends_at? format?)
  - Block type (closed, open, etc.?)
  - Service associations (if any)

## How to Extract

1. Open Postman collection: https://www.postman.com/hapioapi/hapio/collection/46vkb82/hapio
2. Navigate to each folder (Recurring Schedules, Recurring Schedule Blocks, Schedule Blocks)
3. Open the "Get" endpoint for each type
4. Copy the full JSON response (if example exists)
5. Open the "Create" endpoint for each type
6. Copy the full JSON request body example
7. Paste all examples here or in a separate file

## Notes

- Do NOT guess field names - only use what's in Postman
- Include all fields, even optional ones
- Note the exact format for dates, times, and weekdays
- Include any nested objects or arrays

