# How Brevo Handles Duplicate Contacts

## Email is the Unique Identifier

Brevo uses **email** as the unique identifier for contacts. Phone numbers are NOT unique identifiers.

## What Happens with `updateEnabled: true`

### Scenario 1: Same Email
- ✅ **Updates existing contact** with new data
- ✅ All attributes (FIRSTNAME, LASTNAME, SMS, etc.) get updated
- ✅ Added to the list if not already there
- Result: One contact with updated information

### Scenario 2: Different Email, Same Phone
- ✅ Creates **new contact** with different email
- ✅ Both contacts will have the same phone number
- ✅ Both appear in your list as separate contacts
- Result: Two separate contacts (different emails, same phone)

### Scenario 3: Same Email, Different Phone
- ✅ **Updates existing contact**
- ✅ Phone number gets updated to the new number
- ✅ Old phone number is overwritten
- Result: One contact with updated phone

### Scenario 4: Email Already in List
- ✅ **Updates contact** information
- ✅ Contact stays in the list
- ✅ All attributes get updated
- Result: Updated contact, stays subscribed

## Your Current Setup

```javascript
updateEnabled: true  // Updates existing contact if email matches
```

This means:
- If someone signs up with email they already used → Updates that contact
- If someone signs up with new email but same phone → Creates new contact
- If someone signs up with email they already used → Updates attributes and list membership

## Is This a Problem?

### ✅ Good:
- Prevents duplicate emails in your list
- Updates contact info if they change phone/address
- User can "re-subscribe" without creating duplicates

### ⚠️ Potential Issues:
- Same phone number could appear on multiple contacts (if they have different emails)
- If someone changes their email, it creates a new contact instead of updating

## Brevo Limitations

**Brevo does NOT:**
- Use phone as a unique identifier
- Merge contacts automatically
- Check for duplicates by phone number

**Brevo DOES:**
- Use email as the unique ID
- Update existing contact if email matches
- Allow multiple contacts with same phone

## Recommendation

Your current setup is **good for most cases** because:
1. Most people use the same email
2. Updates existing info if they sign up again
3. Prevents email duplicates

The only edge case is:
- Someone signs up with different emails but same phone
- This creates multiple contacts with the same phone
- This is uncommon and not really a problem

## If You Want to Prevent Phone Duplicates

You would need to:
1. Check Brevo API for existing phone before creating
2. This adds complexity and API calls
3. Not worth it for most use cases

**Bottom line:** Your current setup handles duplicates correctly for 99% of cases!

