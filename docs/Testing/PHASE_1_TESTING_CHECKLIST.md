# Phase 1: Services Database Migration - Testing Checklist

## 📋 Summary of Changes

### Database Schema Changes
1. **Added `hapio_service_id` column** - Stores the Hapio service ID after syncing
2. **Added `buffer_before_minutes` and `buffer_after_minutes` columns** - Time buffers for services
3. **Changed `price` column** - From VARCHAR (e.g., "from $150") to NUMERIC (e.g., 150.00)

### Service Management Flow Changes
1. **Services now load ONLY from Neon DB** - No Hapio API calls on page load
2. **Save button** - Updates Neon DB only (does NOT sync to Hapio)
3. **New "Sync to Hapio" button** - Manually syncs service data to Hapio when clicked
4. **Price input** - Changed from text field to numeric field
5. **Buffer fields** - Added to service edit modal

### API Changes
1. **New endpoint**: `POST /api/admin/services/[id]/sync` - Syncs Neon DB service to Hapio
2. **Public APIs** - Format price as "from $150" for display
3. **Admin APIs** - Return raw numeric price for editing

### TypeScript Type Updates
- Updated `Service`, `ServiceCreateInput`, and `ServiceUpdateInput` interfaces
- `price` changed from `string | null` to `number | null`
- Added `buffer_before_minutes` and `buffer_after_minutes` fields

---

## 🚀 Next Steps (In Order)

### Step 1: Run Database Migrations
Run these SQL scripts in your Neon database **in this exact order**:

1. **First**: `scripts/add-hapio-service-id-column.sql`
   ```sql
   ALTER TABLE services 
   ADD COLUMN IF NOT EXISTS hapio_service_id VARCHAR(255);
   CREATE INDEX IF NOT EXISTS idx_services_hapio_service_id ON services(hapio_service_id);
   ```

2. **Second**: `scripts/add-buffer-columns-and-update-price.sql`
   - Adds buffer columns
   - Migrates price from VARCHAR to NUMERIC
   - **⚠️ This will convert existing price strings to numbers**

3. **Third**: `scripts/update-service-prices.sql`
   - Updates all services with correct prices from `services.json`
   - Only updates services where `price IS NULL` or `price = 0`

### Step 2: Verify Database Schema
Run this query to verify all columns exist:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'services'
ORDER BY ordinal_position;
```

Expected columns:
- `id` (uuid)
- `slug` (varchar)
- `name` (varchar)
- `category` (varchar)
- `summary` (text)
- `description` (text)
- `duration_minutes` (integer)
- `duration_display` (varchar)
- `price` (numeric) ← **Should be NUMERIC, not VARCHAR**
- `buffer_before_minutes` (integer) ← **New**
- `buffer_after_minutes` (integer) ← **New**
- `test_pricing` (boolean)
- `image_url` (varchar)
- `image_filename` (varchar)
- `enabled` (boolean)
- `display_order` (integer)
- `hapio_service_id` (varchar) ← **New**
- `created_at` (timestamp)
- `updated_at` (timestamp)

### Step 3: Verify Price Data
Run this query to check prices were migrated correctly:
```sql
SELECT slug, name, price 
FROM services 
ORDER BY slug;
```

All prices should be numeric (e.g., 150.00, 165.00) not strings.

---

## ✅ Testing Checklist

### Test 1: Database Migration Verification
- [X] Run all three migration scripts successfully
- [X] Verify `hapio_service_id` column exists
- [X] Verify `buffer_before_minutes` and `buffer_after_minutes` columns exist
- [x] Verify `price` column is NUMERIC type (not VARCHAR)
- [x] Verify all services have numeric prices (not null, not 0)
- [X] Verify prices match `services.json` values

### Test 2: Admin Dashboard - Services Page Load
- [X] Navigate to `/admindash/amy/hapio` → Services tab
- [X] **Verify**: Services load from Neon DB (check browser Network tab - should see `/api/admin/services`, NOT Hapio API calls)
- [X] **Verify**: Services table displays correctly with all columns
- [X] **Verify**: Price column shows numeric values (e.g., "$150" not "from $150")
- [X] **Verify**: No errors in browser console

### Test 3: Edit Service - Price Field
- [X] Click "Edit" on any service
- [X] **Verify**: Price field is a number input (not text)
- [X] **Verify**: Can enter decimal values (e.g., 150.50)
- [X] **Verify**: Can clear price (set to null)
- [X] Change price to a new value (e.g., 175.00)
- [X] Click "Update"
- [X] **Verify**: Service saves successfully
- [X] **Verify**: Price updates in the table
- [X] **Verify**: Price is saved as numeric in database (check with SQL query)

### Test 4: Edit Service - Buffer Fields
- [X] Click "Edit" on any service
- [X] **Verify**: "Buffer Before (minutes)" field exists
- [X] **Verify**: "Buffer After (minutes)" field exists
- [X] Set buffer_before_minutes to 15
- [X] Set buffer_after_minutes to 10
- [X] Click "Update"
- [X] **Verify**: Service saves successfully
- [X] **Verify**: Buffer values are saved in database (check with SQL query)
- [X] Re-open edit modal
- [X] **Verify**: Buffer values are displayed correctly

### Test 5: Create New Service
- [X] Click "Add Service"
- [X] Fill in all required fields:
  - Name: "Test Service"
  - Slug: "test-service" (auto-generated)
  - Duration: 60 minutes
  - Price: 100.00
  - Buffer Before: 5
  - Buffer After: 5
- [X] Click "Create"
- [X] **Verify**: Service is created in Neon DB
- [X] **Verify**: Service appears in the table
- [X] **Verify**: `hapio_service_id` is NULL (not synced yet)
- [X] **Verify**: Price, buffers saved correctly

### Test 6: Sync to Hapio - New Service (First Sync)
- [X] Find a service with `hapio_service_id` = NULL
- [X] Click the "Sync to Hapio" button (refresh icon)
- [X] **Verify**: Success message appears
- [X] **Verify**: Service is created in Hapio
- [X] **Verify**: `hapio_service_id` is saved in Neon DB (check database)
- [X] **Verify**: Service data in Hapio matches Neon DB:
  - Name matches
  - Duration matches
  - Buffer values match
  - Enabled status matches
  - Metadata contains: slug, category, summary, description, duration_display, price, test_pricing

### Test 7: Sync to Hapio - Existing Service (Update)
- [X] Edit a service that already has a `hapio_service_id`
  - Change name, price, or buffer values
  - Save to Neon DB
- [X] Click "Sync to Hapio" button
- [X] **Verify**: Success message appears
- [X] **Verify**: Service is UPDATED in Hapio (not created)
- [ ] **Verify**: Changes are reflected in Hapio
  - Click "View Hapio Services" button in the Services tab
  - Find the service by name in the Hapio services list
  - Verify the name, duration, price, and other fields match your changes
  - Alternatively, check the browser console for the sync response which includes the Hapio service data
- [X] **Verify**: `hapio_service_id` remains the same (not changed)

### Test 8: Public-Facing Services Page
- [X] Navigate to `/services` (public page)
- [X] **Verify**: Services load correctly
- [X] **Verify**: Prices display as "from $150" format (formatted for display)
- [X] **Verify**: No errors in browser console
- [X] **Verify**: Service cards display correctly

### Test 9: Service Booking Flow
- [X] Navigate to `/book` or click a service on `/services`
- [X] Click on a service to open booking modal
- [X] **Verify**: Service details display correctly
- [X] **Verify**: Price shows as "from $150" format
- [ ] **Verify**: Booking flow works (if applicable)

### Test 10: Home Page Featured Services
- [X] Navigate to `/` (home page)
- [X] **Verify**: Featured services load correctly
- [X] **Verify**: Prices display correctly
- [X] **Verify**: Service cards display correctly

### Test 11: Error Handling
- [ ] Try to sync a service with invalid data (e.g., missing name)
- [ ] **Verify**: Error message displays clearly
- [ ] **Verify**: Service is not synced to Hapio
- [ ] **Verify**: Neon DB data is not corrupted

### Test 12: Data Consistency
- [ ] Create a service in Neon DB
- [ ] Sync it to Hapio
- [ ] Edit the service in Neon DB (change name, price, buffers)
- [ ] **Verify**: Changes are NOT automatically synced to Hapio
- [ ] Click "Sync to Hapio"
- [ ] **Verify**: Changes are now synced to Hapio

---

## 🐛 Known Issues / Edge Cases to Watch For

1. **Price Migration**: If prices are NULL after migration, run `scripts/update-service-prices.sql`
2. **Buffer Defaults**: New services default to 0 for both buffers (this is correct)
3. **Price Formatting**: Admin dashboard shows "$150", public pages show "from $150" (this is intentional)
4. **Sync Button**: Only appears in admin dashboard, not on public pages

---

## 📝 Notes for Phase 2

Before moving to Phase 2, ensure:
- ✅ All services have been migrated to Neon DB
- ✅ All services have correct prices
- ✅ Sync functionality works correctly
- ✅ No Hapio API calls on page load
- ✅ Public-facing pages display services correctly

Phase 2 will likely involve:
- Stripe integration for payments
- Service-to-Hapio resource mapping
- Booking flow enhancements
- Additional service metadata

---

## 🔍 Quick Verification Commands

### Check if services table has all required columns:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'services' 
AND column_name IN ('price', 'buffer_before_minutes', 'buffer_after_minutes', 'hapio_service_id');
```

### Check services with null prices:
```sql
SELECT slug, name, price 
FROM services 
WHERE price IS NULL OR price = 0;
```

### Check services not yet synced to Hapio:
```sql
SELECT slug, name, hapio_service_id 
FROM services 
WHERE hapio_service_id IS NULL;
```

### Check services synced to Hapio:
```sql
SELECT slug, name, hapio_service_id 
FROM services 
WHERE hapio_service_id IS NOT NULL;
```

