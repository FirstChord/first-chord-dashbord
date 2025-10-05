# Stripe Subscription Schedules Implementation

## What We Built

Future-dated payment pauses using Stripe Subscription Schedules API. Now you can schedule a pause that starts in 2 weeks (or any future date) and it will automatically pause and resume on those dates.

## How It Works

### Smart Detection
The extension detects if a pause is:
- **Immediate** (starts today) → Uses `pause_collection` (existing method)
- **Future** (starts tomorrow or later) → Uses Subscription Schedules (new method)

### 3-Phase Schedule Approach

When you schedule a future pause, the extension creates a 3-phase subscription schedule:

**Phase 1 (Active)**: Now → Pause Start Date
- Normal billing continues
- Same price, same quantity

**Phase 2 (Paused)**: Pause Start → Pause End Date
- Quantity set to 0 = no billing
- No prorations

**Phase 3 (Resume)**: Pause End → Ongoing
- Billing resumes
- Same price, same quantity
- Continues indefinitely

### Example
Today: Oct 5
Student away: Oct 20-30

**Extension creates schedule:**
- Phase 1: Oct 5-20 (active, charge $50/week)
- Phase 2: Oct 20-30 (paused, charge $0)
- Phase 3: Oct 30+ (active, charge $50/week)

All scheduled when you click the button. Stripe handles the transitions automatically on those dates.

## The Tricky Parts (What Made It Work)

### Challenge 1: Stripe API Constraints

Stripe Subscription Schedules have VERY specific rules that took multiple attempts to figure out:

#### ❌ What DOESN'T Work:
1. **Can't set phases with `from_subscription`**
   ```javascript
   // This fails!
   params.append('from_subscription', subscriptionId);
   params.append('phases[0][start_date]', now);
   // Error: "You cannot set `phases` if `from_subscription` is set"
   ```

2. **Can't use both `duration` and `iterations`**
   ```javascript
   // This fails!
   params.append('phases[0][duration]', '864000');
   params.append('phases[0][iterations]', '1');
   // Error: "You may only specify one of these parameters"
   ```

3. **Can't modify current phase start_date**
   ```javascript
   // This fails!
   params.append('phases[0][start_date]', now);
   // Error: "You can not modify the start date of the current phase"
   ```

4. **Must have at least one phase with start_date**
   ```javascript
   // This fails!
   params.append('phases[0][end_date]', pauseStart);
   params.append('phases[1][end_date]', pauseEnd);
   // Error: "Missing at least one phase with `start_date` to anchor end dates"
   ```

#### ✅ What DOES Work:

**2-Step Process:**

**Step 1: Create Schedule from Subscription**
```javascript
// Create schedule using from_subscription
// This auto-creates Phase 0 with current subscription settings
const createParams = new URLSearchParams();
createParams.append('from_subscription', subscriptionId);

const response = await fetch('${STRIPE_API_BASE}/subscription_schedules', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${STRIPE_API_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: createParams
});

const schedule = await response.json();
// Now we have schedule.id and schedule.phases[0] (current phase)
```

**Step 2: Update Schedule with All 3 Phases**
```javascript
// MUST include ALL phases when updating
// MUST provide start_date for ALL phases (to anchor end_dates)
const updateParams = new URLSearchParams();

// Phase 0: Keep current phase settings, just add end_date
const currentPhase = schedule.phases[0];
currentPhase.items.forEach((item, index) => {
  updateParams.append(`phases[0][items][${index}][price]`, item.price);
  updateParams.append(`phases[0][items][${index}][quantity]`, item.quantity);
});
updateParams.append('phases[0][start_date]', currentPhase.start_date); // MUST include!
updateParams.append('phases[0][end_date]', pauseStart);

// Phase 1: Paused
updateParams.append('phases[1][items][0][price]', priceId);
updateParams.append('phases[1][items][0][quantity]', '0'); // Zero = paused
updateParams.append('phases[1][start_date]', pauseStart); // MUST include!
updateParams.append('phases[1][end_date]', pauseEnd);
updateParams.append('phases[1][proration_behavior]', 'none');

// Phase 2: Resume
updateParams.append('phases[2][items][0][price]', priceId);
updateParams.append('phases[2][items][0][quantity]', originalQuantity);
updateParams.append('phases[2][start_date]', pauseEnd); // MUST include!
// No end_date = continues indefinitely

const updateResponse = await fetch(`${STRIPE_API_BASE}/subscription_schedules/${schedule.id}`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${STRIPE_API_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: updateParams
});
```

### Challenge 2: Handling Existing Schedules

If a subscription already has a schedule (from a previous pause attempt), you can't create a new one:

```javascript
// Error: "You cannot migrate a subscription that is already attached to a schedule"
```

**Solution: Check and Reuse**
```javascript
let schedule;

if (subscription.schedule) {
  // Subscription already has a schedule, fetch it
  const response = await fetch(`${STRIPE_API_BASE}/subscription_schedules/${subscription.schedule}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${STRIPE_API_KEY}` }
  });
  schedule = await response.json();
  console.log('✅ Using existing schedule');
} else {
  // Create new schedule
  const createParams = new URLSearchParams();
  createParams.append('from_subscription', subscriptionId);
  // ... create schedule
  console.log('✅ Created new schedule');
}

// Now update the schedule (whether existing or new)
```

### Challenge 3: Phase Dates Must Be Sequential

Phases must follow each other perfectly:
- Phase 0 end_date = Phase 1 start_date
- Phase 1 end_date = Phase 2 start_date

**Our Implementation:**
```javascript
const pauseStart = Math.floor(new Date(startDate).getTime() / 1000); // Unix timestamp
const pauseEnd = Math.floor(new Date(endDate).getTime() / 1000);

// Phase 0: ... → pauseStart
// Phase 1: pauseStart → pauseEnd
// Phase 2: pauseEnd → ...
```

## Key Learnings

### 1. Always Include start_date
Every phase MUST have a `start_date` when updating a schedule, even if you're only changing the `end_date`. This "anchors" the end_date.

### 2. Use from_subscription First
Creating a schedule with `from_subscription` is the easiest way to preserve all current subscription settings (billing anchor, metadata, etc.).

### 3. Update in Single Request
When updating phases, you must provide ALL phases in a single request. You can't update phases one at a time.

### 4. Quantity 0 = Paused
To pause billing, set `quantity` to 0. This is cleaner than removing items or using pause_collection in a schedule.

### 5. Check for Existing Schedules
Always check `subscription.schedule` before creating a new one, or you'll get an error.

### 6. No Prorations During Pause
Set `proration_behavior: 'none'` on the pause phase to avoid confusing billing adjustments.

## Code Structure

### Files Modified

**adminpanel.js**
- Added `isFuturePause(startDate)` - Detects if pause is future-dated
- Updated `previewChanges()` - Shows "SCHEDULED PAUSE" vs "IMMEDIATE PAUSE"
- Updated `generateWhatsAppMessage()` - Uses future tense for scheduled pauses

**content-script.js**
- Added `createSubscriptionSchedule(subscriptionId, startDate, endDate)` - 2-step schedule creation
- Added `handleStripePause(data)` - Smart function that routes to immediate or scheduled pause
- Updated message handler to use `handleStripePause()`

### Flow Diagram

```
User selects student + dates → Click "Full Automation"
                                        ↓
                        Is start date today or future?
                                        ↓
                ┌───────────────────────┴───────────────────────┐
                ↓                                               ↓
         Start date = TODAY                           Start date = FUTURE
                ↓                                               ↓
      Use pause_collection                         Use Subscription Schedules
      (existing method)                                         ↓
                ↓                                    1. Check if schedule exists
      Pause immediately                                         ↓
      Set resumes_at                                 2. Create or fetch schedule
                ↓                                               ↓
      Done!                                          3. Update with 3 phases
                                                                ↓
                                                     4. Stripe auto-transitions
                                                                ↓
                                                              Done!
```

## Testing

### Test Immediate Pause (Today)
1. Select student
2. Start date: **Today**
3. End date: 1 week from today
4. Preview shows: "⚡ IMMEDIATE PAUSE (starts today)"
5. WhatsApp: "has been paused" (past tense)
6. Execute → Uses `pause_collection`

### Test Future Pause (Tomorrow+)
1. Select student
2. Start date: **2 weeks from now**
3. End date: 2 weeks + 10 days
4. Preview shows: "📅 SCHEDULED PAUSE (starts [date])"
5. WhatsApp: "will be paused" (future tense)
6. Execute → Creates Subscription Schedule
7. Check Stripe dashboard → See 3 phases!

## Stripe Dashboard Verification

After creating a future pause, check:

1. Go to Stripe Dashboard → Subscriptions
2. Find the subscription
3. Look for "Subscription schedule" section
4. Should show:
   ```
   Upcoming phases
   [Pause Start Date] - Update (Decrease quantity: 1 → 0)
   [Pause End Date] - Update (Increase quantity: 0 → 1)
   ```

## Common Issues & Solutions

### Issue: "Cannot modify start date of current phase"
**Cause**: Trying to change Phase 0 start_date
**Solution**: Use the existing phase's start_date, don't change it

### Issue: "Missing at least one phase with start_date"
**Cause**: Provided end_date but no start_date
**Solution**: ALL phases must have start_date

### Issue: "Subscription already attached to schedule"
**Cause**: Previous schedule exists
**Solution**: Check `subscription.schedule` and reuse it

### Issue: "You cannot set phases if from_subscription is set"
**Cause**: Trying to set phases when creating schedule
**Solution**: Use 2-step: create first, then update with phases

## Performance Notes

- **Immediate pause**: ~1-2 seconds (1 API call)
- **Future pause**: ~2-3 seconds (3-4 API calls: fetch subscription, create/fetch schedule, update schedule)
- All scheduling happens immediately when button is clicked
- No background jobs or cron needed
- Stripe handles phase transitions automatically

## Future Enhancements

### Possible Improvements
1. **Cancel/Modify Scheduled Pauses**: Add UI to view and cancel upcoming scheduled pauses
2. **Bulk Future Pauses**: Schedule pauses for multiple students (e.g., school holiday)
3. **Recurring Pauses**: Schedule pauses that repeat (e.g., every summer)
4. **Smart Billing Alignment**: Adjust phase boundaries to align with billing cycle dates

### API Limitations to Be Aware Of
- Maximum 10 phases per schedule
- Phases must be sequential (no gaps or overlaps)
- Can't schedule more than 5 years in advance
- Quantity must be ≥ 0 (can't go negative)

## Credits

Implemented: Oct 2025
Debugging sessions: 8+ attempts to figure out Stripe's phase rules
Final working solution: 2-step create + update approach

**Key Insight**: Stripe Subscription Schedules are powerful but have strict constraints. The trick is:
1. Create schedule from subscription (auto-generates Phase 0)
2. Update that schedule with ALL phases including start_dates

This approach respects Stripe's rules and creates clean, working schedules! 🎉

---

**Last Updated**: October 2025
**Status**: ✅ Working in Production
**Tested With**: Weekly subscriptions, immediate and future pauses
