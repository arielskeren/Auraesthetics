# Exact Postman Instructions to Extract Hapio API Endpoints

## Step-by-Step Instructions

### 1. Open Postman Collection

1. Go to: https://www.postman.com/hapioapi/workspace/hapio
2. Navigate to the **"Recurring Schedule Blocks"** folder
3. Open the **"Create Recurring Schedule Block"** request

### 2. Extract the Endpoint Information

For the **"Create Recurring Schedule Block"** request, copy the following:

#### A. HTTP Method and URL
- Look at the top of the request
- Copy the **HTTP method** (should be POST)
- Copy the **full URL path** (e.g., `/v1/recurring-schedules/{recurring_schedule_id}/recurring-schedule-blocks`)
- **Important**: Include the full path with any `{variable}` placeholders

#### B. Request Body
1. Click on the **"Body"** tab
2. Make sure **"raw"** and **"JSON"** are selected
3. Copy the **entire JSON structure** shown
4. If there are example values, include them
5. Note which fields are required vs optional

#### C. Response Example
1. Click on the **"Examples"** tab (or look for saved responses)
2. Find a successful response example (status 200 or 201)
3. Copy the **entire JSON response structure**
4. Include all fields that are returned

### 3. Repeat for Other Endpoints

Do the same for:
- **Get Recurring Schedule Block** (GET)
- **List Recurring Schedule Blocks** (GET) 
- **Update Recurring Schedule Block** (PATCH or PUT)
- **Delete Recurring Schedule Block** (DELETE)

### 4. Format Your Response

Paste the information in this format:

```
=== CREATE RECURRING SCHEDULE BLOCK ===

Method: POST
URL: /v1/[EXACT PATH HERE]

Request Body:
{
  [PASTE EXACT JSON STRUCTURE HERE]
}

Response (200/201):
{
  [PASTE EXACT RESPONSE STRUCTURE HERE]
}

=== GET RECURRING SCHEDULE BLOCK ===

Method: GET
URL: /v1/[EXACT PATH HERE]

Response (200):
{
  [PASTE EXACT RESPONSE STRUCTURE HERE]
}

=== LIST RECURRING SCHEDULE BLOCKS ===

Method: GET
URL: /v1/[EXACT PATH HERE]
Query Params: [LIST ANY QUERY PARAMETERS]

Response (200):
{
  [PASTE EXACT RESPONSE STRUCTURE HERE]
}

=== UPDATE RECURRING SCHEDULE BLOCK ===

Method: PATCH (or PUT)
URL: /v1/[EXACT PATH HERE]

Request Body:
{
  [PASTE EXACT JSON STRUCTURE HERE]
}

Response (200):
{
  [PASTE EXACT RESPONSE STRUCTURE HERE]
}

=== DELETE RECURRING SCHEDULE BLOCK ===

Method: DELETE
URL: /v1/[EXACT PATH HERE]

Response: [STATUS CODE AND ANY RESPONSE BODY]
```

## Quick Checklist

For each endpoint, provide:
- [ ] HTTP Method (GET, POST, PATCH, PUT, DELETE)
- [ ] Full URL path (with {variables} if any)
- [ ] Request body structure (if applicable)
- [ ] Response structure
- [ ] Query parameters (for List endpoint)
- [ ] Path parameters (what goes in {variable} placeholders)

## Example of What We Need

Here's an example of the level of detail needed:

```
Method: POST
URL: /v1/recurring-schedules/abc123/recurring-schedule-blocks

Request Body:
{
  "day_of_week": 1,
  "start_time": "09:00",
  "end_time": "17:00",
  "metadata": {
    "service_ids": ["service-1", "service-2"]
  }
}

Response:
{
  "id": "block-123",
  "recurring_schedule_id": "abc123",
  "day_of_week": 1,
  "start_time": "09:00",
  "end_time": "17:00",
  "metadata": {
    "service_ids": ["service-1", "service-2"]
  },
  "created_at": "2025-11-15T16:00:00+00:00",
  "updated_at": "2025-11-15T16:00:00+00:00"
}
```

## Important Notes

1. **Exact field names**: Copy the exact field names as they appear (snake_case vs camelCase matters!)
2. **Path variables**: Note what goes in `{variable}` placeholders (e.g., `{recurring_schedule_id}` vs `{resource_id}`)
3. **Required fields**: Note which fields are required (usually marked with * or in validation)
4. **Date formats**: Note the exact format for dates/times (e.g., `HH:mm` vs `HH:mm:ss`)

Once you provide this information, I'll update the code to match Hapio's exact API structure!


