# Hapio API Diagnostic Tool

This diagnostic endpoint helps us inspect the exact field names, formats, and structures that Hapio's API uses.

## Usage

### Basic Query
```
GET /api/admin/hapio/diagnostic?resource_id={resource_id}
```

### With Schedule ID
```
GET /api/admin/hapio/diagnostic?resource_id={resource_id}&schedule_id={schedule_id}
```

### With Block ID
```
GET /api/admin/hapio/diagnostic?resource_id={resource_id}&schedule_id={schedule_id}&block_id={block_id}
```

## What It Returns

The diagnostic endpoint will return:

1. **Recurring Schedules Structure**
   - Count of existing schedules
   - Sample schedule object
   - All field names in the response

2. **Recurring Schedule Blocks Structure**
   - Count of existing blocks
   - Sample block object
   - All field names in the response
   - Detailed analysis of weekday and time formats

3. **Field Analysis**
   - Exact field names used by Hapio (e.g., `weekday` vs `day_of_week`)
   - Time format examples (e.g., `09:00:00` vs `09:00`)
   - Weekday value examples and types

## Example Response

```json
{
  "resource_id": "f680513c-4f4f-4993-a948-89edf4006b80",
  "recurring_schedules": {
    "count": 1,
    "sample": {
      "id": "...",
      "weekday": 1,
      "start_time": "09:00:00",
      ...
    },
    "full_response_structure": ["id", "weekday", "start_time", "end_time", ...]
  },
  "recurring_schedule_blocks": {
    "count": 1,
    "sample": {
      "id": "...",
      "weekday": 1,
      "start_time": "09:00:00",
      ...
    }
  },
  "field_analysis": {
    "weekday_field_name": "weekday",
    "time_format": {
      "start_time_example": "09:00:00",
      "inferred_format": "H:i:s"
    }
  }
}
```

## How to Use

1. Open your browser's developer console
2. Navigate to: `https://your-domain.com/api/admin/hapio/diagnostic?resource_id=YOUR_RESOURCE_ID`
3. Copy the JSON response
4. Use it to update field names and formats in the codebase

## Next Steps

After running the diagnostic:
1. Check the `field_analysis.weekday_field_name` to confirm if it's `weekday` or `day_of_week`
2. Check the `field_analysis.time_format.inferred_format` to confirm if it's `H:i:s` or `H:i`
3. Check the `weekday_value` to see what range Hapio uses (0-6, 1-7, etc.)
4. Update the codebase accordingly

