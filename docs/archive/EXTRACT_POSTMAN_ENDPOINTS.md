# How to Extract Hapio API Endpoints from Postman

## Steps to Get Exact Endpoint Information

1. **Open Postman** and navigate to the Hapio workspace
2. **Open the "Recurring Schedule Blocks" folder**
3. **For each endpoint** (Create, Get, List, Update, Delete), please provide:

### For "Create Recurring Schedule Block" endpoint:

1. **HTTP Method**: (e.g., POST, GET, PUT, PATCH, DELETE)
2. **Full URL Path**: Copy the exact path from Postman
   - Example: `POST /v1/recurring-schedules/{recurring_schedule_id}/recurring-schedule-blocks`
   - Or: `POST /v1/resources/{resource_id}/recurring-schedule-blocks`
   - Include any path parameters in curly braces

3. **Request Body** (from the "Body" tab):
   - Copy the exact JSON structure
   - Include all required fields
   - Include all optional fields
   - Note the exact field names (snake_case vs camelCase)

4. **Response Example** (from "Examples" or "Save Response"):
   - Copy a sample successful response
   - Include all fields returned

### Example Format:

```
**Create Recurring Schedule Block**

Method: POST
Path: /v1/recurring-schedules/{recurring_schedule_id}/recurring-schedule-blocks

Request Body:
{
  "day_of_week": 1,
  "start_time": "09:00",
  "end_time": "17:00",
  "metadata": {
    "service_ids": []
  }
}

Response:
{
  "id": "abc123",
  "recurring_schedule_id": "xyz789",
  "day_of_week": 1,
  "start_time": "09:00",
  "end_time": "17:00",
  "metadata": {...},
  "created_at": "2025-11-15T...",
  "updated_at": "2025-11-15T..."
}
```

## Endpoints Needed

Please extract information for:

1. ✅ **Create Recurring Schedule Block** (POST)
2. ✅ **Get Recurring Schedule Block** (GET)
3. ✅ **List Recurring Schedule Blocks** (GET)
4. ✅ **Update Recurring Schedule Block** (PATCH/PUT)
5. ✅ **Delete Recurring Schedule Block** (DELETE)

## Notes

- **Path Parameters**: Note if `{recurring_schedule_id}` or `{resource_id}` is in the path
- **Query Parameters**: For List endpoint, note any query params (page, per_page, filters)
- **Field Names**: Pay attention to exact casing (snake_case vs camelCase)
- **Required vs Optional**: Note which fields are required vs optional

Once you provide this information, I'll update the code to use the exact endpoints and field names from Hapio's API.


