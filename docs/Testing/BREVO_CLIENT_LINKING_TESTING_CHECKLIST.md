# Brevo Client Linking & Sync - Testing Checklist

## Overview
This checklist covers all features related to Brevo contact linking, conflict resolution, and synchronization in the Clients Manager.

---

## 1. Basic Client Management

### ✅ Add New Client
- [ ] Click "Add Client" button
- [ ] Fill in required fields (email, first name, last name)
- [ ] Verify form validation works (email required)
- [ ] Click "Create Client"
- [ ] Verify toast notification appears: "Client created successfully!"
- [ ] Verify toast auto-dismisses after 5 seconds
- [ ] Verify modal stays open after save
- [ ] Verify "Save Changes" button shows "Saved!" briefly, then reverts to "Save Changes"
- [ ] Verify new client appears in the table
- [ ] Click "Close" button
- [ ] Verify modal closes

### ✅ Edit Existing Client
- [ ] Click on a client row in the table
- [ ] Verify modal opens with client data pre-filled
- [ ] Modify client information (name, email, phone)
- [ ] Click "Save Changes"
- [ ] Verify toast notification appears
- [ ] Verify modal stays open
- [ ] Verify changes are reflected in the table after refresh
- [ ] Verify "Save Changes" button shows "Saved!" briefly

### ✅ Close Modal with Unsaved Changes
- [ ] Open edit modal
- [ ] Make changes to client data
- [ ] Click "Close" button (X or Close button)
- [ ] Verify confirmation dialog appears: "Are you sure? Unsaved changes will be lost."
- [ ] Click "Cancel" in confirmation
- [ ] Verify modal stays open
- [ ] Click "Close" again
- [ ] Click "Close Without Saving"
- [ ] Verify modal closes and changes are not saved

### ✅ Close Modal with No Changes
- [ ] Open edit modal
- [ ] Don't make any changes
- [ ] Click "Close"
- [ ] Verify modal closes immediately (no confirmation)

---

## 2. Brevo Contact Linking - No Existing Link

### ✅ View Available Brevo Contacts
- [ ] Open edit modal for a client WITHOUT a Brevo ID
- [ ] Verify "Brevo Contact ID" field shows a dropdown
- [ ] Verify dropdown shows "Select a Brevo contact to link..."
- [ ] Verify available Brevo contacts load (contacts not already linked)
- [ ] Verify contacts display as: "Name (ID) - Email"
- [ ] Verify contacts are sorted alphabetically by name

### ✅ Link Existing Brevo Contact (No Conflicts)
- [ ] Open edit modal for a client WITHOUT a Brevo ID
- [ ] Select a Brevo contact from dropdown
- [ ] Verify conflict check runs automatically
- [ ] If no conflicts, verify `pendingBrevoId` is set
- [ ] Click "Save Changes"
- [ ] Verify Brevo ID is linked in Neon
- [ ] Verify client syncs to Brevo with Neon data
- [ ] Verify Brevo ID appears in the table after refresh
- [ ] Verify Brevo ID field becomes read-only after linking

### ✅ Link Existing Brevo Contact (With Conflicts)
- [ ] Open edit modal for a client WITHOUT a Brevo ID
- [ ] Select a Brevo contact that has different data (email, name, phone)
- [ ] Verify conflict resolution modal appears
- [ ] Verify all conflicting fields are shown:
  - [ ] Email conflict (if different)
  - [ ] First name conflict (if different)
  - [ ] Last name conflict (if different)
  - [ ] Phone conflict (if different)
- [ ] Verify each conflict shows:
  - [ ] Neon value with creation date
  - [ ] Brevo value with creation date
  - [ ] Radio buttons to choose which to keep
- [ ] Select "Neon" for some fields, "Brevo" for others
- [ ] Click "Resolve & Link"
- [ ] Verify conflict modal closes
- [ ] Click "Save Changes"
- [ ] Verify selected values are applied:
  - [ ] Fields with "Neon" selected use Neon values
  - [ ] Fields with "Brevo" selected use Brevo values
- [ ] Verify both Neon and Brevo are updated with resolved values
- [ ] Verify Brevo ID is linked

### ✅ Create New Brevo Record
- [ ] Open edit modal for a client WITHOUT a Brevo ID
- [ ] Click "Create new Brevo Record" button
- [ ] Verify button shows "Creating..." while processing
- [ ] Verify Brevo contact is created immediately
- [ ] Verify Brevo contact is linked automatically (brevo_contact_id set)
- [ ] Verify toast notification: "Brevo contact created and linked successfully!"
- [ ] Verify Brevo ID field becomes read-only
- [ ] Verify Brevo ID appears in the table
- [ ] Verify client data is synced to Brevo (name, email, phone)
- [ ] Verify `emailBlacklisted` in Brevo matches `!marketing_opt_in`

### ✅ Create New Brevo Record When No Contacts Available
- [ ] Ensure no unlinked Brevo contacts exist
- [ ] Open edit modal for a client WITHOUT a Brevo ID
- [ ] Verify dropdown is empty or shows "Select a Brevo contact to link..."
- [ ] Verify "Create new Brevo Record" button is still visible
- [ ] Click "Create new Brevo Record"
- [ ] Verify it works correctly (creates and links)

---

## 3. Brevo Contact Linking - Already Linked

### ✅ View Linked Brevo ID
- [ ] Open edit modal for a client WITH a Brevo ID
- [ ] Verify "Brevo Contact ID" field shows read-only text
- [ ] Verify Brevo ID is displayed correctly
- [ ] Verify field has gray background (disabled appearance)
- [ ] Verify no dropdown or "Create" button is shown

### ✅ Update Linked Client
- [ ] Open edit modal for a client WITH a Brevo ID
- [ ] Modify client data (name, email, phone, marketing_opt_in)
- [ ] Click "Save Changes"
- [ ] Verify changes are saved to Neon
- [ ] Verify changes are synced to Brevo automatically
- [ ] Verify `emailBlacklisted` in Brevo is updated based on `marketing_opt_in`
- [ ] Verify sync happens regardless of `marketing_opt_in` status

---

## 4. Conflict Resolution

### ✅ Conflict Detection (Case-Insensitive)
- [ ] Create a test scenario where:
  - Neon: "John@Example.com"
  - Brevo: "john@example.com"
- [ ] Try to link them
- [ ] Verify NO conflict is detected (case-insensitive email matching)
- [ ] Create a test scenario where:
  - Neon: "John Doe"
  - Brevo: "john doe"
- [ ] Verify NO conflict is detected (case-insensitive name matching)

### ✅ Conflict Detection (Different Values)
- [ ] Create a test scenario where:
  - Neon: "john@example.com"
  - Brevo: "jane@example.com"
- [ ] Try to link them
- [ ] Verify conflict IS detected
- [ ] Verify conflict modal shows both values with dates

### ✅ Conflict Resolution - All Fields
- [ ] Create a test scenario with conflicts in:
  - Email
  - First name
  - Last name
  - Phone
- [ ] Resolve each field independently:
  - [ ] Choose "Neon" for email
  - [ ] Choose "Brevo" for first name
  - [ ] Choose "Neon" for last name
  - [ ] Choose "Brevo" for phone
- [ ] Click "Resolve & Link"
- [ ] Click "Save Changes"
- [ ] Verify:
  - [ ] Email uses Neon value
  - [ ] First name uses Brevo value
  - [ ] Last name uses Neon value
  - [ ] Phone uses Brevo value
- [ ] Verify both Neon and Brevo are updated correctly

### ✅ Cancel Conflict Resolution
- [ ] Open conflict resolution modal
- [ ] Make some selections
- [ ] Click "Cancel"
- [ ] Verify modal closes
- [ ] Verify `pendingBrevoId` is still set (not cleared)
- [ ] Verify user can try again

---

## 5. Save Button States

### ✅ Save Button States Flow
- [ ] Open edit modal
- [ ] Verify button shows "Save Changes" (idle state)
- [ ] Click "Save Changes"
- [ ] Verify button shows "Saving..." with spinning icon (saving state)
- [ ] After save completes, verify button shows "Saved!" with checkmark (saved state)
- [ ] After 2 seconds, verify button reverts to "Save Changes" (idle state)
- [ ] Make another change
- [ ] Verify button shows "Save Changes" again (ready for another save)

### ✅ Save Button Disabled States
- [ ] Open add modal
- [ ] Verify button is disabled when email is empty
- [ ] Enter email
- [ ] Verify button becomes enabled
- [ ] During save, verify button is disabled
- [ ] After save, verify button is enabled again

---

## 6. Toast Notifications

### ✅ Toast Appearance
- [ ] Perform a save operation
- [ ] Verify toast appears at top center of page
- [ ] Verify toast has green background
- [ ] Verify toast shows checkmark icon
- [ ] Verify toast shows success message
- [ ] Verify toast has close button (X)

### ✅ Toast Auto-Dismiss
- [ ] Trigger a toast notification
- [ ] Wait 5 seconds
- [ ] Verify toast disappears automatically
- [ ] Verify no errors in console

### ✅ Toast Manual Dismiss
- [ ] Trigger a toast notification
- [ ] Click the X button
- [ ] Verify toast disappears immediately

### ✅ Multiple Toasts
- [ ] Perform multiple save operations quickly
- [ ] Verify only one toast is shown at a time
- [ ] Verify new toast replaces old one

---

## 7. Data Synchronization

### ✅ Always Sync When Linked
- [ ] Link a client to Brevo
- [ ] Update client in Neon (name, email, phone)
- [ ] Verify changes sync to Brevo automatically
- [ ] Verify sync happens even if `marketing_opt_in` is false
- [ ] Verify `emailBlacklisted` in Brevo = `!marketing_opt_in`

### ✅ Sync All Fields
- [ ] Link a client to Brevo
- [ ] Update all fields in Neon:
  - [ ] First name
  - [ ] Last name
  - [ ] Email
  - [ ] Phone
  - [ ] Marketing opt-in
- [ ] Save changes
- [ ] Verify all fields sync to Brevo
- [ ] Verify Brevo contact has correct values

### ✅ Email Blacklist Sync
- [ ] Link a client to Brevo
- [ ] Set `marketing_opt_in = true`
- [ ] Save
- [ ] Verify `emailBlacklisted = false` in Brevo
- [ ] Set `marketing_opt_in = false`
- [ ] Save
- [ ] Verify `emailBlacklisted = true` in Brevo

---

## 8. Edge Cases & Error Handling

### ✅ Network Errors
- [ ] Disconnect internet
- [ ] Try to save a client
- [ ] Verify error message is shown
- [ ] Verify modal doesn't close
- [ ] Reconnect internet
- [ ] Try to save again
- [ ] Verify it works

### ✅ Invalid Brevo ID
- [ ] Manually set an invalid Brevo ID in Neon (via database)
- [ ] Open edit modal for that client
- [ ] Try to save
- [ ] Verify error handling works gracefully

### ✅ Brevo API Errors
- [ ] Simulate Brevo API failure
- [ ] Try to create Brevo record
- [ ] Verify error message is shown
- [ ] Verify client is still created in Neon (if applicable)

### ✅ Empty Form Data
- [ ] Open add modal
- [ ] Try to save without email
- [ ] Verify save button is disabled
- [ ] Verify validation prevents save

---

## 9. UI/UX

### ✅ Modal Behavior
- [ ] Click outside modal
- [ ] Verify modal closes (if no unsaved changes)
- [ ] Make changes, click outside
- [ ] Verify confirmation dialog appears

### ✅ Responsive Design
- [ ] Test on mobile device
- [ ] Verify modal is scrollable
- [ ] Verify all buttons are accessible
- [ ] Verify table is scrollable horizontally on mobile

### ✅ Loading States
- [ ] Verify loading spinner when fetching Brevo contacts
- [ ] Verify "Creating..." state when creating Brevo record
- [ ] Verify "Saving..." state during save

### ✅ Visual Feedback
- [ ] Verify checkmarks/X icons for boolean fields
- [ ] Verify green/red colors for status indicators
- [ ] Verify hover states on buttons
- [ ] Verify disabled states are visually distinct

---

## 10. Data Integrity

### ✅ No Duplicate Links
- [ ] Link Client A to Brevo Contact 1
- [ ] Try to link Client B to Brevo Contact 1
- [ ] Verify Brevo Contact 1 is not in available contacts list for Client B
- [ ] Verify only unlinked contacts appear in dropdown

### ✅ Link Persistence
- [ ] Link a client to Brevo
- [ ] Refresh the page
- [ ] Verify link persists
- [ ] Verify Brevo ID is still shown in table
- [ ] Verify Brevo ID is read-only in edit modal

### ✅ Data Consistency
- [ ] Link a client to Brevo
- [ ] Update client in Neon
- [ ] Verify Brevo is updated
- [ ] Update client in Brevo (manually)
- [ ] Update client in Neon again
- [ ] Verify Neon data overwrites Brevo (Neon is source of truth)

---

## 11. Performance

### ✅ Large Contact Lists
- [ ] Ensure 100+ unlinked Brevo contacts exist
- [ ] Open edit modal
- [ ] Verify dropdown loads all contacts
- [ ] Verify dropdown is scrollable
- [ ] Verify no performance issues

### ✅ Rapid Saves
- [ ] Make multiple changes quickly
- [ ] Click "Save Changes" multiple times
- [ ] Verify only one save operation runs at a time
- [ ] Verify no race conditions

---

## 12. Integration Testing

### ✅ End-to-End Flow
1. [ ] Create new client in Neon
2. [ ] Open edit modal
3. [ ] Create new Brevo record
4. [ ] Verify link is established
5. [ ] Update client data
6. [ ] Verify sync to Brevo
7. [ ] Update marketing opt-in
8. [ ] Verify emailBlacklisted updates
9. [ ] Refresh page
10. [ ] Verify all data persists correctly

### ✅ Multi-User Scenario
- [ ] Open same client in two browser tabs
- [ ] Make changes in tab 1
- [ ] Save in tab 1
- [ ] Refresh tab 2
- [ ] Verify tab 2 shows updated data

---

## Notes

- All tests should be performed in a development/staging environment
- Test with both production and test Brevo accounts
- Verify database changes persist after page refresh
- Check browser console for errors during all operations
- Verify server logs for API calls and sync operations

---

## Known Issues / Future Improvements

- [ ] Add ability to unlink Brevo contact (currently requires backend)
- [ ] Add bulk operations for linking multiple clients
- [ ] Add search/filter in Brevo contacts dropdown
- [ ] Add pagination for large Brevo contact lists

---

**Last Updated:** [Current Date]
**Tested By:** [Tester Name]
**Status:** [ ] Passed [ ] Failed [ ] Partial

