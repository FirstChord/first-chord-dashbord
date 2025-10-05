console.log('🚀 First Chord content script loaded!');
console.log('📍 Current URL:', window.location.href);
console.log('📍 Page title:', document.title);

// Add a global indicator that the content script is loaded
window.firstChordExtensionLoaded = true;
console.log('✅ Content script indicator set');

// API Token - Working token from dashboard (internal use only)
const MMS_API_TOKEN = "eyJhbGciOiJodHRwOi8vd3d3LnczLm9yZy8yMDAxLzA0L3htbGRzaWctbW9yZSNobWFjLXNoYTI1NiIsInR5cCI6IkpXVCJ9.eyJJbXBlcnNvbmF0aW5nIjpmYWxzZSwiUHJvZmlsZU1vZGUiOiJBcGlLZXkiLCJTY2hvb2xJRCI6InNjaF9GeDVKUSIsIk5hbWUiOiJGaXJzdCBDaG9yZCBEYXNoYm9hcmQiLCJBdXRoVG9rZW4iOiJha193WUpmLldKTnNhclY4NjVUOGQ5Z1dVVGNUS1VDU1h1SzY5MGJZZVB2VkE0RURMQWM9IiwiaWF0IjoxNzU1MTU0NjM1fQ.jE6sNUVTtzRoT6LVSyf_4bVt3eCFSSFq93GvA0gkxZI";

// Stripe configuration
const STRIPE_API_KEY = "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"; // Internal use only
const STRIPE_API_BASE = "https://api.stripe.com/v1";

// Retry utility with exponential backoff
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = i === maxRetries - 1;

      // Don't retry on authentication errors or 400 errors
      if (error.message.includes('401') || error.message.includes('403') || error.message.includes('400')) {
        throw error;
      }

      if (isLastAttempt) {
        throw error;
      }

      // Calculate exponential backoff delay
      const delay = baseDelay * Math.pow(2, i);
      console.log(`⏳ Retry attempt ${i + 1}/${maxRetries} after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Simple token getter - uses working token from dashboard
function getWorkingToken() {
  console.log('🔑 Using MMS API token');
  return MMS_API_TOKEN;
}

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Message received in content script:', request.action);
  console.log('📨 Full request:', request);
  
  try {
    if (request.action === 'test') {
      console.log('🧪 Processing test request...');
      const hasToken = !!getWorkingToken();
      const currentToken = getWorkingToken();
      const tokenPreview = hasToken ? currentToken.substring(0, 50) + '...' : 'None';
      const tokenType = capturedToken ? 'Live session token' : 'API key fallback';
      
      const response = {
        success: true, 
        message: 'Test successful!', 
        hasToken: hasToken,
        tokenPreview: tokenPreview,
        tokenType: tokenType
      };
      console.log('🧪 Sending test response:', response);
      sendResponse(response);
      return true;
    }
    
    if (request.action === 'findStudent') {
      console.log('🔍 Finding student:', request.data?.studentForename, request.data?.studentSurname);
      
      findStudentByName(request.data)
        .then(result => {
          console.log('✅ Student found:', result);
          sendResponse({success: true, data: result});
        })
        .catch(error => {
          console.error('❌ Student search failed:', error.message);
          sendResponse({success: false, error: error.message});
        });
      
      return true; // Keep channel open for async response
    }
    
    if (request.action === 'searchLessons') {
      console.log('📅 Searching lessons for:', request.data?.studentId);
      
      searchStudentLessons(request.data)
        .then(result => {
          console.log('✅ Lessons found:', result?.length || 0);
          sendResponse({success: true, data: result});
        })
        .catch(error => {
          console.error('❌ Lesson search failed:', error.message);
          sendResponse({success: false, error: error.message});
        });
      
      return true;
    }
    
    if (request.action === 'updateAttendance') {
      console.log('✏️ Updating attendance:', request.data?.attendanceId);
      
      updateAttendanceToAbsent(request.data)
        .then(result => {
          console.log('✅ Attendance updated');
          sendResponse({success: true, data: result});
        })
        .catch(error => {
          console.error('❌ Attendance update failed:', error.message);
          sendResponse({success: false, error: error.message});
        });
      
      return true;
    }
    
    if (request.action === 'pauseStripeSubscription') {
      console.log('💳 Handling Stripe pause for:', request.data?.email);

      handleStripePause(request.data)
        .then(result => {
          console.log(`✅ Stripe ${result.pauseType} pause successful`);
          sendResponse({success: true, data: result});
        })
        .catch(error => {
          console.error('❌ Stripe pause failed:', error.message);
          sendResponse({success: false, error: error.message});
        });

      return true;
    }
    
    sendResponse({success: false, error: 'Unknown action: ' + request.action});
    return false;
    
  } catch (error) {
    console.error('❌ Message handler error:', error);
    sendResponse({success: false, error: error.message});
    return false;
  }
});

// API Functions
async function findStudentByName(student) {
  const token = getWorkingToken();

  console.log('🔗 Using token for API call:', token.substring(0, 50) + '...');

  // Try to use a more efficient search if possible
  // First, attempt to search with name filter
  const searchName = `${student.studentForename} ${student.studentSurname}`;

  // Option 1: Try searching with a name filter (if the API supports it)
  try {
    const response = await fetch('https://api.mymusicstaff.com/v1/search/names/students/?orderby=Name', {
      method: 'POST',
      headers: {
        'accept': 'application/json, text/plain, */*',
        'authorization': `Bearer ${token}`,
        'content-type': 'application/json',
        'origin': 'https://app.mymusicstaff.com',
        'referer': 'https://app.mymusicstaff.com/Teacher/v2/en/calendar'
      },
      body: JSON.stringify({
        "TeacherIDs": [],
        "SearchTerm": searchName // Try adding search term to filter results
      })
    });

    if (response.ok) {
      const students = await response.json();
      console.log(`📋 Found ${students.length} students with search filter`);

      if (students.length > 0) {
        const targetName = searchName.toLowerCase();
        const matchingStudent = students.find(s => {
          const fullName = `${s.FirstName} ${s.LastName}`.toLowerCase();
          return fullName === targetName;
        });

        if (matchingStudent) {
          console.log('✅ Found student using filtered search');
          return matchingStudent.ID;
        }
      }
    }
  } catch (error) {
    console.log('⚠️ Filtered search not supported, falling back to full search');
  }

  // Fallback: Load all students (less efficient)
  const response = await fetch('https://api.mymusicstaff.com/v1/search/names/students/?orderby=Name', {
    method: 'POST',
    headers: {
      'accept': 'application/json, text/plain, */*',
      'authorization': `Bearer ${token}`,
      'content-type': 'application/json',
      'origin': 'https://app.mymusicstaff.com',
      'referer': 'https://app.mymusicstaff.com/Teacher/v2/en/calendar'
    },
    body: JSON.stringify({"TeacherIDs": []})
  });

  if (!response.ok) {
    throw new Error(`Student search failed: ${response.status}`);
  }

  const students = await response.json();
  console.log(`📋 Found ${students.length} total students (fallback search)`);

  const targetName = searchName.toLowerCase();
  const matchingStudent = students.find(s => {
    const fullName = `${s.FirstName} ${s.LastName}`.toLowerCase();
    return fullName === targetName;
  });

  if (!matchingStudent) {
    throw new Error(`Student "${student.studentForename} ${student.studentSurname}" not found`);
  }

  return matchingStudent.ID;
}

async function searchStudentLessons(data) {
  const { studentId, startDate, endDate } = data;

  console.log(`🔍 API call: lessons for ${studentId} from ${startDate} to ${endDate}`);

  // Wrap in retry logic
  const response = await retryWithBackoff(async () => {
    const token = getWorkingToken();

    const res = await fetch('https://api.mymusicstaff.com/v1/search/calendar/events/', {
      method: 'POST',
      headers: {
        'accept': 'application/json, text/plain, */*',
        'authorization': `Bearer ${token}`,
        'content-type': 'application/json',
        'origin': 'https://app.mymusicstaff.com',
        'referer': 'https://app.mymusicstaff.com/Teacher/v2/en/calendar'
      },
      body: JSON.stringify({
        "StartDate": startDate,
        "EndDate": endDate,
        "StartTime": null,
        "EndTime": null,
        "EventIDs": [],
        "EventCategoryIDs": [],
        "EventLocationIDs": [],
        "StudentIDs": [studentId],
        "TeacherIDs": [],
        "OriginalTeacherIDs": [],
        "SeriesIDs": [],
        "AllDay": null,
        "MakeUpCreditRequired": null,
        "HoldTimeSlot": null,
        "AttendanceStatuses": []
      })
    });

    if (!res.ok) {
      throw new Error(`Lesson search failed: ${res.status}`);
    }

    return res;
  });

  const responseData = await response.json();
  console.log('🔍 Raw lesson API response:', responseData);
  console.log('🔍 Response type:', typeof responseData);
  console.log('🔍 Is array:', Array.isArray(responseData));
  
  // Handle different response structures safely
  let events = [];
  if (Array.isArray(responseData)) {
    events = responseData;
  } else if (responseData && Array.isArray(responseData.ItemSubset)) {
    events = responseData.ItemSubset; // MyMusicStaff uses ItemSubset!
  } else if (responseData && Array.isArray(responseData.Events)) {
    events = responseData.Events;
  } else if (responseData && Array.isArray(responseData.events)) {
    events = responseData.events;
  } else if (responseData && Array.isArray(responseData.data)) {
    events = responseData.data;
  } else {
    console.log('⚠️ Unexpected API response structure, using empty array');
    events = [];
  }
  
  console.log(`📅 Parsed ${events.length} events`);
  
  // Debug: Log the first event structure to see why attendance filtering fails
  if (events.length > 0) {
    console.log('🔍 First event structure:', events[0]);
    console.log('🔍 First event Attendances:', events[0]?.Attendances);
    console.log('🔍 Attendances type:', typeof events[0]?.Attendances);
    console.log('🔍 Is Attendances array?', Array.isArray(events[0]?.Attendances));
  }
  
  // Filter lessons with attendance (note: it's "Attendances" plural!)
  const lessonsWithAttendance = events.filter(event => 
    event && event.Attendances && Array.isArray(event.Attendances) && event.Attendances.length > 0
  );
  
  console.log(`🎯 Found ${lessonsWithAttendance.length} lessons with attendance`);
  
  // Transform data (note: using Attendances plural!)
  const lessonData = lessonsWithAttendance.map(event => ({
    EventID: event.ID,
    ID: event.Attendances[0]?.ID,
    OriginalChargeAmount: event.Attendances[0]?.Charge?.Amount || 0,
    Date: event.StartDate,
    StudentName: event.Attendances[0]?.Student?.Name
  }));
  
  return lessonData;
}

async function updateAttendanceToAbsent(data) {
  console.log('🧪 DEBUG: updateAttendanceToAbsent called with:', data);
  const { eventId, attendanceId, originalPrice } = data;
  
  console.log(`🔄 Updating attendance ${attendanceId} for event ${eventId} to absent...`);
  console.log('🔍 Original price value:', originalPrice, typeof originalPrice);
  
  const token = getWorkingToken();
  
  // First try without PriceOverride (for events that don't support it)
  let payload = {
    "TeacherNote": "",
    "ParentNote": "",
    "StudentNote": "",
    "AttendanceStatus": "AbsentNotice"
  };
  
  console.log('🔍 Sending payload (without PriceOverride):', JSON.stringify(payload, null, 2));
  
  try {
    const response = await fetch(`https://api.mymusicstaff.com/v1/events/${eventId}/attendance/${attendanceId}`, {
      method: 'PUT',
      headers: {
        'accept': 'application/json, text/plain, */*',
        'authorization': `Bearer ${token}`,
        'content-type': 'application/json',
        'origin': 'https://app.mymusicstaff.com',
        'referer': 'https://app.mymusicstaff.com/Teacher/v2/en/calendar'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      // If that fails and we have a price, try with PriceOverride
      if (originalPrice && originalPrice > 0) {
        console.log('🔄 Retrying with PriceOverride...');
        payload.PriceOverride = originalPrice;
        
        const retryResponse = await fetch(`https://api.mymusicstaff.com/v1/events/${eventId}/attendance/${attendanceId}`, {
          method: 'PUT',
          headers: {
            'accept': 'application/json, text/plain, */*',
            'authorization': `Bearer ${token}`,
            'content-type': 'application/json',
            'origin': 'https://app.mymusicstaff.com',
            'referer': 'https://app.mymusicstaff.com/Teacher/v2/en/calendar'
          },
          body: JSON.stringify(payload)
        });
        
        if (!retryResponse.ok) {
          const errorText = await retryResponse.text();
          console.error('❌ API Error Response (retry):', errorText);
          throw new Error(`Attendance update failed: ${retryResponse.status} - ${errorText}`);
        }
        
        const retryResult = await retryResponse.json();
        console.log('✅ Attendance updated successfully (with retry):', retryResult);
        return retryResult;
      } else {
        // Get the error response body for debugging
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText);
        throw new Error(`Attendance update failed: ${response.status} - ${errorText}`);
      }
    }

    const result = await response.json();
    console.log('✅ Attendance updated successfully:', result);
    return result;

  } catch (error) {
    console.error('❌ Failed to update attendance:', error);
    throw error;
  }
}

// STRIPE API FUNCTIONS

async function pauseStripeSubscription(data) {
  const { email, startDate, endDate } = data;
  
  console.log(`💳 Starting Stripe pause process for ${email}`);
  
  try {
    // Step 1: Find customer by email
    console.log('🔍 Looking up Stripe customer...');
    const customer = await findStripeCustomerByEmail(email);
    
    if (!customer) {
      throw new Error(`No Stripe customer found for email: ${email}`);
    }
    
    console.log(`✅ Found customer: ${customer.id} (${customer.name || 'No name'})`);
    
    // Step 2: Get their subscriptions
    console.log('📋 Getting customer subscriptions...');
    const subscriptions = await getCustomerSubscriptions(customer.id);
    
    if (subscriptions.length === 0) {
      throw new Error(`No active subscriptions found for ${email}`);
    }
    
    console.log(`📋 Found ${subscriptions.length} subscription(s)`);
    
    // Step 3: Pause each subscription (assuming one subscription per customer for now)
    const subscription = subscriptions[0]; // Using option C approach
    
    if (subscriptions.length > 1) {
      console.warn(`⚠️ Multiple subscriptions found for ${email}. Pausing the first one: ${subscription.id}`);
    }
    
    console.log(`⏸️ Pausing subscription ${subscription.id}...`);
    const pausedSubscription = await pauseSubscriptionForDateRange(subscription.id, startDate, endDate);
    
    console.log('✅ Stripe subscription paused successfully');
    
    return {
      customer: customer,
      subscription: pausedSubscription,
      pauseStart: startDate,
      pauseEnd: endDate
    };
    
  } catch (error) {
    console.error('❌ Stripe pause failed:', error);
    throw error;
  }
}

async function findStripeCustomerByEmail(email) {
  return await retryWithBackoff(async () => {
    const response = await fetch(`${STRIPE_API_BASE}/customers?email=${encodeURIComponent(email)}&limit=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${STRIPE_API_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!response.ok) {
      throw new Error(`Stripe customer lookup failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return result.data.length > 0 ? result.data[0] : null;
  });
}

async function getCustomerSubscriptions(customerId) {
  const response = await fetch(`${STRIPE_API_BASE}/subscriptions?customer=${customerId}&status=active&limit=10`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${STRIPE_API_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Stripe subscriptions lookup failed: ${response.status} ${response.statusText}`);
  }
  
  const result = await response.json();
  return result.data;
}

async function pauseSubscriptionForDateRange(subscriptionId, startDate, endDate) {
  // Calculate timestamps for pause period
  const pauseStart = Math.floor(new Date(startDate).getTime() / 1000);
  const pauseEnd = Math.floor(new Date(endDate).getTime() / 1000);
  
  console.log(`⏸️ Pausing subscription from ${startDate} to ${endDate}`);
  console.log(`📅 Unix timestamps: ${pauseStart} to ${pauseEnd}`);
  
  // Stripe subscription pause - this will pause billing
  const pauseParams = new URLSearchParams({
    'pause_collection[behavior]': 'void', // Don't charge during pause
    'pause_collection[resumes_at]': pauseEnd.toString()
  });
  
  const response = await fetch(`${STRIPE_API_BASE}/subscriptions/${subscriptionId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${STRIPE_API_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: pauseParams
  });
  
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Stripe subscription pause failed: ${response.status} - ${errorBody}`);
  }
  
  return await response.json();
}

// ============ SUBSCRIPTION SCHEDULES (Future-Dated Pauses) ============

/**
 * Create a subscription schedule for future-dated pause
 * Uses 3-phase approach: Active → Paused → Active
 */
async function createSubscriptionSchedule(subscriptionId, startDate, endDate) {
  console.log(`📅 Creating subscription schedule for future pause`);
  console.log(`📅 Subscription: ${subscriptionId}`);
  console.log(`📅 Pause period: ${startDate} to ${endDate}`);

  try {
    // Convert dates to Unix timestamps
    const now = Math.floor(Date.now() / 1000);
    const pauseStart = Math.floor(new Date(startDate).getTime() / 1000);
    const pauseEnd = Math.floor(new Date(endDate).getTime() / 1000);

    console.log(`📅 Timestamps: now=${now}, pauseStart=${pauseStart}, pauseEnd=${pauseEnd}`);

    // First, get the current subscription details to preserve settings
    const subResponse = await fetch(`${STRIPE_API_BASE}/subscriptions/${subscriptionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${STRIPE_API_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!subResponse.ok) {
      throw new Error(`Failed to fetch subscription: ${subResponse.status}`);
    }

    const subscription = await subResponse.json();
    console.log(`✅ Retrieved subscription details`);
    console.log(`📋 Billing interval: ${subscription.items.data[0].price.recurring.interval}`);

    // Check if subscription already has a schedule
    let initialSchedule;

    if (subscription.schedule) {
      console.log(`📋 Subscription already has schedule: ${subscription.schedule}`);

      // Get the existing schedule
      const scheduleResponse = await fetch(`${STRIPE_API_BASE}/subscription_schedules/${subscription.schedule}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${STRIPE_API_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (!scheduleResponse.ok) {
        throw new Error(`Failed to fetch existing schedule: ${scheduleResponse.status}`);
      }

      initialSchedule = await scheduleResponse.json();
      console.log(`✅ Using existing schedule: ${initialSchedule.id}`);
    } else {
      // Step 1: Create schedule using from_subscription (this creates initial phase automatically)
      console.log(`📤 Step 1: Creating schedule from subscription...`);
      const createParams = new URLSearchParams();
      createParams.append('from_subscription', subscriptionId);

      const createResponse = await fetch(`${STRIPE_API_BASE}/subscription_schedules`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${STRIPE_API_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: createParams
      });

      if (!createResponse.ok) {
        const errorBody = await createResponse.text();
        throw new Error(`Schedule creation failed: ${createResponse.status} - ${errorBody}`);
      }

      initialSchedule = await createResponse.json();
      console.log(`✅ Initial schedule created: ${initialSchedule.id}`);
    }

    console.log(`📋 Current phase:`, initialSchedule.phases[0]);

    // Step 2: Update schedule to add pause and resume phases
    console.log(`📤 Step 2: Adding pause phases to schedule...`);

    const updateParams = new URLSearchParams();

    // Phase 0: Keep current phase but set end_date to pause start
    // Copy all items from current phase
    const currentPhase = initialSchedule.phases[0];
    currentPhase.items.forEach((item, index) => {
      updateParams.append(`phases[0][items][${index}][price]`, item.price);
      updateParams.append(`phases[0][items][${index}][quantity]`, item.quantity);
    });
    updateParams.append('phases[0][start_date]', currentPhase.start_date.toString());
    updateParams.append('phases[0][end_date]', pauseStart.toString());

    // Phase 1: Paused (pause start → pause end)
    updateParams.append('phases[1][items][0][price]', subscription.items.data[0].price.id);
    updateParams.append('phases[1][items][0][quantity]', '0'); // Quantity 0 = paused
    updateParams.append('phases[1][start_date]', pauseStart.toString());
    updateParams.append('phases[1][end_date]', pauseEnd.toString());
    updateParams.append('phases[1][proration_behavior]', 'none');

    // Phase 2: Active billing resumes (pause end → ongoing)
    updateParams.append('phases[2][items][0][price]', subscription.items.data[0].price.id);
    updateParams.append('phases[2][items][0][quantity]', subscription.items.data[0].quantity || 1);
    updateParams.append('phases[2][start_date]', pauseEnd.toString());
    // No end_date for phase 2 - continues indefinitely

    const response = await fetch(`${STRIPE_API_BASE}/subscription_schedules/${initialSchedule.id}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_API_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: updateParams
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Schedule creation failed: ${response.status} - ${errorBody}`);
    }

    const schedule = await response.json();
    console.log(`✅ Subscription schedule created: ${schedule.id}`);
    console.log(`📅 Schedule status: ${schedule.status}`);

    return schedule;

  } catch (error) {
    console.error('❌ Subscription schedule creation failed:', error);
    throw error;
  }
}

/**
 * Main function to handle Stripe pause (immediate or scheduled)
 * Detects if pause is immediate or future-dated and uses appropriate method
 */
async function handleStripePause(data) {
  const { email, startDate, endDate } = data;

  console.log(`💳 Starting Stripe pause process for ${email}`);

  try {
    // Step 1: Find customer and subscription
    console.log('🔍 Looking up Stripe customer...');
    const customer = await findStripeCustomerByEmail(email);

    if (!customer) {
      throw new Error(`No Stripe customer found for email: ${email}`);
    }

    console.log(`✅ Found customer: ${customer.id} (${customer.name || 'No name'})`);

    console.log('📋 Getting customer subscriptions...');
    const subscriptions = await getCustomerSubscriptions(customer.id);

    if (subscriptions.length === 0) {
      throw new Error(`No active subscriptions found for ${email}`);
    }

    console.log(`📋 Found ${subscriptions.length} subscription(s)`);
    const subscription = subscriptions[0];

    if (subscriptions.length > 1) {
      console.warn(`⚠️ Multiple subscriptions found. Pausing the first one: ${subscription.id}`);
    }

    // Step 2: Check if pause is immediate or future-dated
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const pauseStartDate = new Date(startDate);
    pauseStartDate.setHours(0, 0, 0, 0);
    const isFuturePause = pauseStartDate > today;

    if (isFuturePause) {
      // Future pause: Use Subscription Schedules
      console.log(`📅 Future pause detected (starts ${startDate}) - using Subscription Schedules`);
      const schedule = await createSubscriptionSchedule(subscription.id, startDate, endDate);

      return {
        customer: customer,
        subscription: subscription,
        schedule: schedule,
        pauseStart: startDate,
        pauseEnd: endDate,
        pauseType: 'scheduled'
      };
    } else {
      // Immediate pause: Use existing pause_collection method
      console.log(`⏸️ Immediate pause detected - using pause_collection`);
      const pausedSubscription = await pauseSubscriptionForDateRange(subscription.id, startDate, endDate);

      return {
        customer: customer,
        subscription: pausedSubscription,
        pauseStart: startDate,
        pauseEnd: endDate,
        pauseType: 'immediate'
      };
    }

  } catch (error) {
    console.error('❌ Stripe pause failed:', error);
    throw error;
  }
}

console.log('🚀 Setup complete!');
console.log('🔑 MMS API Token ready');
console.log('📡 Extension ready for communication');