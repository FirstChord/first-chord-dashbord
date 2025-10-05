// First Chord Payment Pause Manager - Admin Panel Logic
document.addEventListener('DOMContentLoaded', function() {
  
  // Get DOM elements
  const studentSearch = document.getElementById('student-search');
  const searchResults = document.getElementById('search-results');
  const selectedStudent = document.getElementById('selected-student');
  const startDate = document.getElementById('start-date');
  const endDate = document.getElementById('end-date');
  const pauseReason = document.getElementById('pause-reason');
  const previewBtn = document.getElementById('preview-btn');
  const executeMmsBtn = document.getElementById('execute-mms-btn');
  const executeFullBtn = document.getElementById('execute-full-btn');
  const previewPanel = document.getElementById('preview-panel');
  const previewContent = document.getElementById('preview-content');
  const confirmationMessage = document.getElementById('confirmation-message');
  const whatsappMessage = document.getElementById('whatsapp-message');
  const copyMessageBtn = document.getElementById('copy-message-btn');
  const statusMessage = document.getElementById('status-message');
  
  // Store student data and selected student
  let studentDatabase = [];
  let currentStudent = null;

  // Cache configuration
  const CACHE_KEY = 'student_database_cache';
  const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  // Load student data on startup and set dates
  loadStudentDatabase().then(() => {
    setDefaultDates();
  });

  // Cache helper functions
  async function getCachedStudentData() {
    try {
      const result = await chrome.storage.local.get([CACHE_KEY]);
      const cached = result[CACHE_KEY];

      if (!cached) {
        console.log('📭 No cache found');
        return null;
      }

      const age = Date.now() - cached.timestamp;
      if (age > CACHE_TTL) {
        console.log(`⏰ Cache expired (${Math.round(age / 1000 / 60 / 60)}h old)`);
        return null;
      }

      console.log(`✅ Cache valid (${Math.round(age / 1000 / 60)}min old)`);
      return cached;
    } catch (error) {
      console.error('❌ Cache read error:', error);
      return null;
    }
  }

  async function cacheStudentData(students) {
    try {
      const cacheData = {
        students: students,
        timestamp: Date.now()
      };
      await chrome.storage.local.set({ [CACHE_KEY]: cacheData });
      console.log('💾 Student data cached successfully');
    } catch (error) {
      console.error('❌ Cache write error:', error);
    }
  }

  async function getStaleCache() {
    try {
      const result = await chrome.storage.local.get([CACHE_KEY]);
      const cached = result[CACHE_KEY];
      if (cached && cached.students && cached.students.length > 0) {
        console.log('📦 Using stale cache as fallback');
        return cached;
      }
      return null;
    } catch (error) {
      console.error('❌ Stale cache read error:', error);
      return null;
    }
  }

  async function clearCache() {
    try {
      await chrome.storage.local.remove([CACHE_KEY]);
      console.log('🗑️ Cache cleared');
    } catch (error) {
      console.error('❌ Cache clear error:', error);
    }
  }

  // Debounce timer for search
  let searchDebounceTimer = null;
  const SEARCH_DEBOUNCE_MS = 300;

  // Set up event listeners
  studentSearch.addEventListener('input', () => {
    // Clear previous timer
    clearTimeout(searchDebounceTimer);

    // Set new timer to debounce search
    searchDebounceTimer = setTimeout(() => {
      handleStudentSearch();
    }, SEARCH_DEBOUNCE_MS);
  });

  previewBtn.addEventListener('click', previewChanges);
  executeMmsBtn.addEventListener('click', executeMyMusicStaffOnly);
  executeFullBtn.addEventListener('click', executeFullAutomation);
  copyMessageBtn.addEventListener('click', copyWhatsAppMessage);
  
  // Function to load student database from Google Sheets with caching
  async function loadStudentDatabase() {
    try {
      console.log('🔄 Starting student database load...');

      // Check cache first
      const cachedData = await getCachedStudentData();
      if (cachedData) {
        studentDatabase = cachedData.students;
        const age = Math.round((Date.now() - cachedData.timestamp) / 1000 / 60); // minutes
        console.log(`✅ Loaded ${studentDatabase.length} students from cache (${age} minutes old)`);
        showStatus(`Student database loaded from cache: ${studentDatabase.length} students (${age}min old)`, 'success');
        return;
      }

      // No cache or expired - fetch fresh data
      showStatus('Loading student database from server...', 'info');

      // Replace with your actual Google Apps Script Web App URL
      const GOOGLE_SHEETS_API_URL = 'https://script.google.com/macros/s/AKfycbyVicLCz07cnJ0iTF60-2KlBJ4UaCXUvih6wLwVKzRvHRAf_BXeQLX-vWjR030tMp0RIA/exec';

      console.log('📡 Fetching from:', GOOGLE_SHEETS_API_URL);

      // Fetch real data from Google Sheets via Apps Script
      const response = await fetch(GOOGLE_SHEETS_API_URL, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Accept': 'application/json'
        }
      });

      console.log('📡 Response status:', response.status);
      console.log('📡 Response ok:', response.ok);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('📊 Raw response data:', data);

      if (!data.success) {
        throw new Error(data.message || 'Failed to load student data');
      }

      studentDatabase = data.students;

      // Cache the fresh data
      await cacheStudentData(studentDatabase);

      console.log('✅ Student database loaded:', studentDatabase.length, 'students');
      showStatus(`Student database loaded: ${data.count || studentDatabase.length} students found`, 'success');

    } catch (error) {
      console.error('❌ Error loading student database:', error);

      // Try to use stale cache as fallback
      const staleCache = await getStaleCache();
      if (staleCache) {
        studentDatabase = staleCache.students;
        showStatus(`Using cached data (server unavailable): ${studentDatabase.length} students`, 'error');
        return;
      }

      // Fallback to sample data if everything fails
      showStatus(`Using sample data (Google Sheets failed: ${error.message})`, 'error');

      const sampleData = [
        {
          studentSurname: 'Tone',
          studentForename: 'Jake',
          tutor: 'Arion',
          parentSurname: 'Tone',
          parentForename: 'John',
          email: 'johnsmith@hotmail.com'
        },
        {
          studentSurname: 'Swap',
          studentForename: 'Millie',
          tutor: 'Finn',
          parentSurname: 'Swap',
          parentForename: 'jin',
          email: 'jinswap@yahoo.co.uk'
        }
      ];

      studentDatabase = sampleData;
    }
  }

  // Function to set default dates
  function setDefaultDates() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD

    // Set start date to today
    startDate.value = todayStr;

    // Set end date to one week from today
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];
    endDate.value = nextWeekStr;
  }
  
  // Function to handle student search with fuzzy matching
  function handleStudentSearch() {
    const query = studentSearch.value.trim().toLowerCase();
    
    if (query.length < 2) {
      hideSearchResults();
      return;
    }
    
    // Find matching students using fuzzy search
    const matches = findMatchingStudents(query);
    displaySearchResults(matches);
  }
  
  // Function to find matching students using multiple criteria
  function findMatchingStudents(query) {
    // Filter matching students
    const matches = studentDatabase.filter(student => {
      // Match against various name combinations
      const fullName = `${student.studentForename} ${student.studentSurname}`.toLowerCase();
      const firstNameOnly = student.studentForename.toLowerCase();
      const parentName = `${student.parentForename} ${student.parentSurname}`.toLowerCase();
      const familyName = student.studentSurname.toLowerCase();

      // Check if query matches any of these patterns
      return (
        fullName.includes(query) ||
        firstNameOnly.includes(query) ||
        parentName.includes(query) ||
        familyName.includes(query) ||
        // Handle "Jake's mum" type searches
        (query.includes("'s") && firstNameOnly.includes(query.split("'s")[0]))
      );
    });

    // Sort results: prioritize matches that start with the query
    matches.sort((a, b) => {
      const aFirstName = a.studentForename.toLowerCase();
      const bFirstName = b.studentForename.toLowerCase();
      const aLastName = a.studentSurname.toLowerCase();
      const bLastName = b.studentSurname.toLowerCase();
      const aFullName = `${aFirstName} ${aLastName}`;
      const bFullName = `${bFirstName} ${bLastName}`;

      // Priority 1: First name starts with query (e.g., "al" → "Alex")
      const aFirstStarts = aFirstName.startsWith(query);
      const bFirstStarts = bFirstName.startsWith(query);
      if (aFirstStarts && !bFirstStarts) return -1;
      if (!aFirstStarts && bFirstStarts) return 1;

      // Priority 2: Last name starts with query
      const aLastStarts = aLastName.startsWith(query);
      const bLastStarts = bLastName.startsWith(query);
      if (aLastStarts && !bLastStarts) return -1;
      if (!aLastStarts && bLastStarts) return 1;

      // Priority 3: Full name starts with query
      const aFullStarts = aFullName.startsWith(query);
      const bFullStarts = bFullName.startsWith(query);
      if (aFullStarts && !bFullStarts) return -1;
      if (!aFullStarts && bFullStarts) return 1;

      // Default: alphabetical by first name
      return aFirstName.localeCompare(bFirstName);
    });

    return matches.slice(0, 5); // Limit to 5 results
  }
  
  // Function to display search results
  function displaySearchResults(matches) {
    if (matches.length === 0) {
      hideSearchResults();
      return;
    }
    
    searchResults.innerHTML = '';
    
    matches.forEach(student => {
      const resultDiv = document.createElement('div');
      resultDiv.className = 'search-result';
      resultDiv.innerHTML = `
        <strong>${student.studentForename} ${student.studentSurname}</strong><br>
        <small>Parent: ${student.parentForename} ${student.parentSurname} | Tutor: ${student.tutor}</small>
      `;
      
      resultDiv.addEventListener('click', () => selectStudent(student));
      searchResults.appendChild(resultDiv);
    });
    
    searchResults.style.display = 'block';
  }
  
  // Function to hide search results
  function hideSearchResults() {
    searchResults.style.display = 'none';
  }
  
  // Function to select a student
  function selectStudent(student) {
    currentStudent = student;
    
    // Update UI
    studentSearch.value = `${student.studentForename} ${student.studentSurname}`;
    hideSearchResults();
    
    // Show selected student info
    selectedStudent.innerHTML = `
      <strong>Selected:</strong> ${student.studentForename} ${student.studentSurname}<br>
      <strong>Parent:</strong> ${student.parentForename} ${student.parentSurname}<br>
      <strong>Email:</strong> ${student.email}<br>
      <strong>Tutor:</strong> ${student.tutor}
    `;
    selectedStudent.style.display = 'block';
    
    // Enable preview if dates are also set
    checkPreviewReadiness();
  }
  
  // Function to check if preview can be enabled
  function checkPreviewReadiness() {
    const hasStudent = currentStudent !== null;
    const hasStartDate = startDate.value !== '';
    const hasEndDate = endDate.value !== '';
    
    const isReady = hasStudent && hasStartDate && hasEndDate;
    previewBtn.disabled = !isReady;
    executeMmsBtn.disabled = !isReady;
    executeFullBtn.disabled = !isReady;
  }
  
  // Function to preview what changes will be made
  async function previewChanges() {
    if (!currentStudent || !startDate.value || !endDate.value) {
      showStatus('Please select a student and enter holiday dates', 'error');
      return;
    }
    
    showStatus('Generating preview...', 'info');
    
    try {
      // Calculate affected payment dates
      const affectedPayments = calculateAffectedPayments(startDate.value, endDate.value);
     const reasonText = pauseReason ? pauseReason.options[pauseReason.selectedIndex].text : 'Student Holiday';
      // Generate preview message
      const previewMessage = generateWhatsAppMessage(currentStudent, startDate.value, endDate.value);
      
      // Check if pause is immediate or future-dated
      const isFuture = isFuturePause(startDate.value);
      const pauseTypeLabel = isFuture
        ? `📅 <strong>SCHEDULED PAUSE</strong> (starts ${formatDate(startDate.value)})`
        : `⚡ <strong>IMMEDIATE PAUSE</strong> (starts today)`;

      // Generate preview content
      previewContent.innerHTML = `
        <div class="preview-item" style="background: ${isFuture ? '#e3f2fd' : '#fff3e0'}; padding: 10px; border-radius: 5px; margin-bottom: 10px;">
          ${pauseTypeLabel}
        </div>
        <div class="preview-item">
          <strong>Student:</strong> ${currentStudent.studentForename} ${currentStudent.studentSurname}
        </div>
        <div class="preview-item">
          <strong>Parent:</strong> ${currentStudent.parentForename} ${currentStudent.parentSurname}
        </div>
        <div class="preview-item">
          <strong>Pause Reason:</strong> ${reasonText}
        </div>
        <div class="preview-item">
          <strong>Holiday Period:</strong> ${formatDate(startDate.value)} to ${formatDate(endDate.value)}
        </div>
        <div class="preview-item">
          <strong>Payments to Pause:</strong> ${affectedPayments.join(', ')}
        </div>
        <div class="preview-item">
          <strong>Stripe Action:</strong> ${isFuture ? 'Schedule subscription pause (3-phase plan)' : 'Pause subscription immediately'} for ${currentStudent.email}
        </div>
        <div class="preview-item">
          <strong>MyMusicStaff:</strong> Create calendar blocks for pause period
        </div>
        <div class="preview-item" style="background: #e8f5e8; padding: 10px; border-radius: 5px; margin-top: 10px;">
          <strong>WhatsApp Message Preview:</strong><br>
          <em>"${previewMessage}"</em>
        </div>
      `;
      
      previewPanel.style.display = 'block';
      executeMmsBtn.disabled = false;
      executeFullBtn.disabled = false;
      showStatus('Preview generated successfully', 'success');
      
    } catch (error) {
      showStatus('Error generating preview: ' + error.message, 'error');
    }
  }
  
  // Function to calculate which payments will be affected
  function calculateAffectedPayments(startDateStr, endDateStr) {
    // Simple calculation - in real implementation, this would check actual payment schedule
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const dates = [];
    
    // Generate weekly payment dates that fall within the holiday period
    const current = new Date(start);
    while (current <= end) {
      dates.push(formatDate(current.toISOString().split('T')[0]));
      current.setDate(current.getDate() + 7);
    }
    
    return dates.length > 0 ? dates : ['No payments during this period'];
  }

async function findMyMusicStaffStudentId(student) {
  try {
    // Find MyMusicStaff tab
    const tabs = await chrome.tabs.query({url: "https://app.mymusicstaff.com/*"});
    
    if (tabs.length === 0) {
      throw new Error('Please open MyMusicStaff in a browser tab and log in');
    }
    
    // Send message to content script in MyMusicStaff tab
    const response = await chrome.tabs.sendMessage(tabs[0].id, {
      action: 'findStudent',
      data: student
    });
    
    if (response && response.success) {
      return response.data;
    } else {
      throw new Error(response?.error || 'Student search failed');
    }
  } catch (error) {
    if (error.message.includes('Could not establish connection') || 
        error.message.includes('Receiving end does not exist')) {
      throw new Error('Content script not loaded. Please refresh the MyMusicStaff page and try again.');
    }
    throw new Error('MyMusicStaff communication failed: ' + error.message);
  }
}

async function searchStudentLessons(studentId, startDate, endDate) {
  try {
    const tabs = await chrome.tabs.query({url: "https://app.mymusicstaff.com/*"});
    
    if (tabs.length === 0) {
      throw new Error('Please open MyMusicStaff in a browser tab');
    }
    
    const response = await chrome.tabs.sendMessage(tabs[0].id, {
      action: 'searchLessons',
      data: { studentId, startDate, endDate }
    });
    
    if (response && response.success) {
      return response.data;
    } else {
      throw new Error(response?.error || 'Lesson search failed');
    }
  } catch (error) {
    if (error.message.includes('Could not establish connection') || 
        error.message.includes('Receiving end does not exist')) {
      throw new Error('Content script not loaded. Please refresh the MyMusicStaff page and try again.');
    }
    throw new Error('Failed to search lessons: ' + error.message);
  }
}

async function updateAttendanceToAbsent(eventId, attendanceId, originalPrice) {
  try {
    const tabs = await chrome.tabs.query({url: "https://app.mymusicstaff.com/*"});
    
    if (tabs.length === 0) {
      throw new Error('Please open MyMusicStaff in a browser tab');
    }
    
    const response = await chrome.tabs.sendMessage(tabs[0].id, {
      action: 'updateAttendance',
      data: { eventId, attendanceId, originalPrice }
    });
    
    if (response.success) {
      return response.data;
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    throw new Error('Failed to update attendance: ' + error.message);
  }
}

  // Function to execute MyMusicStaff-only automation
async function executeMyMusicStaffOnly() {
  if (!currentStudent) {
    showStatus('No student selected', 'error');
    return;
  }

  showStatus('Executing MyMusicStaff automation...', 'info');

  try {
    // Execute MyMusicStaff automation (mark lessons absent)
    showStatus('Updating MyMusicStaff calendar...', 'info');
    const mmsResult = await executeMyMusicStaffAutomation(currentStudent, startDate.value, endDate.value);
    
    // Generate WhatsApp message
    const message = generateWhatsAppMessage(currentStudent, startDate.value, endDate.value);
    
    // Show success with lesson count
    const lessonText = mmsResult.lessonCount === 1 ? 'lesson' : 'lessons';
    showStatus(`MyMusicStaff automation completed! ${mmsResult.lessonCount} ${lessonText} marked absent.`, 'success');
    
    // Show confirmation message
    whatsappMessage.textContent = message;
    confirmationMessage.style.display = 'block';
    
  } catch (error) {
    console.error('MyMusicStaff automation error:', error);
    showStatus('MyMusicStaff automation failed: ' + error.message, 'error');
  }
}

// Function to execute full automation (MyMusicStaff + Stripe)
async function executeFullAutomation() {
  if (!currentStudent) {
    showStatus('No student selected', 'error');
    return;
  }

  showStatus('Executing full automation...', 'info');

  try {
    // Step 1: Execute MyMusicStaff automation (mark lessons absent)
    showStatus('Updating MyMusicStaff calendar...', 'info');
    const mmsResult = await executeMyMusicStaffAutomation(currentStudent, startDate.value, endDate.value);
    
    // Step 2: Pause Stripe subscription
    showStatus('Pausing Stripe subscription...', 'info');
    await pauseStripeSubscriptionForStudent(currentStudent, startDate.value, endDate.value);
    
    // Step 3: Generate WhatsApp message
    const message = generateWhatsAppMessage(currentStudent, startDate.value, endDate.value);
    
    // Show success with lesson count
    const lessonText = mmsResult.lessonCount === 1 ? 'lesson' : 'lessons';
    showStatus(`Full automation completed! ${mmsResult.lessonCount} ${lessonText} marked absent and Stripe subscription paused.`, 'success');
    
    // Show confirmation message
    whatsappMessage.textContent = message;
    confirmationMessage.style.display = 'block';
    
  } catch (error) {
    console.error('Full automation error:', error);
    showStatus('Full automation failed: ' + error.message, 'error');
  }
}

// Function to pause Stripe subscription for a student
async function pauseStripeSubscriptionForStudent(student, startDate, endDate) {
  try {
    // Find MyMusicStaff tab
    const tabs = await chrome.tabs.query({url: "https://app.mymusicstaff.com/*"});
    
    if (tabs.length === 0) {
      throw new Error('Please open MyMusicStaff in a browser tab and log in');
    }
    
    // Send message to content script in MyMusicStaff tab
    const response = await chrome.tabs.sendMessage(tabs[0].id, {
      action: 'pauseStripeSubscription',
      data: {
        email: student.email,
        startDate: startDate,
        endDate: endDate
      }
    });
    
    if (response.success) {
      console.log('Stripe subscription paused successfully:', response.data);
      return response.data;
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    throw new Error('Stripe pause failed: ' + error.message);
  }
}

async function executeMyMusicStaffAutomation(student, startDate, endDate) {
  try {
    showStatus('Connecting to MyMusicStaff...', 'info');

    // Step 1: Get student's MyMusicStaff ID
    let studentId;

    if (student.mms_id) {
      // Use MMS ID directly if available (faster, more reliable)
      console.log('✅ Using MMS ID from database:', student.mms_id);
      studentId = student.mms_id;
      showStatus('Using student ID from database...', 'info');
    } else {
      // Fallback: Search by name (slower)
      console.log('⚠️ No MMS ID found, searching by name...');
      showStatus('Finding student in MyMusicStaff...', 'info');
      studentId = await findMyMusicStaffStudentId(student);
    }

    // Step 2: Find student's lessons in the date range
    const lessons = await searchStudentLessons(studentId, startDate, endDate);
    
    if (lessons.length === 0) {
      throw new Error(`No lessons found for ${student.studentForename} ${student.studentSurname} in the selected date range`);
    }
    
    showStatus(`Found ${lessons.length} lesson(s) to mark absent...`, 'info');
    
    // Step 3: Update each lesson to absent
    let successCount = 0;
    for (const lesson of lessons) {
      try {
        await updateAttendanceToAbsent(
          lesson.EventID, 
          lesson.ID, 
          lesson.OriginalChargeAmount
        );
        successCount++;
        showStatus(`Marked lesson ${successCount}/${lessons.length} as absent...`, 'info');
      } catch (error) {
        console.error(`Failed to update lesson ${lesson.ID}:`, error);
      }
    }
    
    if (successCount === lessons.length) {
      showStatus(`Success! Marked ${successCount} lesson(s) as absent in MyMusicStaff`, 'success');
      return { success: true, lessonCount: successCount };
    } else {
      throw new Error(`Only ${successCount}/${lessons.length} lessons were updated successfully`);
    }
    
  } catch (error) {
    console.error('MyMusicStaff automation error:', error);
    showStatus('MyMusicStaff error: ' + error.message, 'error');
    throw error;
  }
}
  
  // Function to generate WhatsApp confirmation message in your style
  function generateWhatsAppMessage(student, startDate, endDate) {
  const parentName = student.parentForename;
  const studentName = student.studentForename;
  const startFormatted = formatDate(startDate);
  const endFormatted = formatDate(endDate);
  const reason = pauseReason ? pauseReason.value : 'holiday';

  // Calculate how many days between start and end
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

  // Check if pause is future-dated
  const isFuture = isFuturePause(startDate);

  // Casual openings in your style
  const openings = [
    "Hey!",
    "Hey hey!",
    "Hi there!",
    "Great stuff!",
    "Nice one!",
    "No problem at all!"
  ];

  // Friendly endings in your style
  const endings = [
    "Have a great day!",
    "Have a lovely summer!",
    "Cheers and have a great day!",
    "Have a wonderful holiday!",
    "Enjoy your break!",
    "Have a great lesson when you're back!"
  ];

  // Pick random opening and ending for variety
  const opening = openings[Math.floor(Math.random() * openings.length)];
  const ending = endings[Math.floor(Math.random() * endings.length)];

  // Generate different messages based on timing and duration
  let messageBody;

  if (isFuture) {
    // Future-dated pause
    if (daysDiff <= 7) {
      messageBody = `Just to let you know ${studentName}'s payment will be paused on ${startFormatted}.`;
    } else {
      messageBody = `Just to let you know ${studentName}'s payments will be paused from ${startFormatted} until ${endFormatted}.`;
    }
  } else {
    // Immediate pause
    if (daysDiff <= 7) {
      messageBody = `Just to confirm ${studentName}'s payment on ${startFormatted} has been paused.`;
    } else {
      messageBody = `Just to confirm ${studentName}'s payments have been paused from ${startFormatted} until ${endFormatted}.`;
    }
  }

  return `${opening} ${messageBody} ${ending}`;
}
  
  // Function to copy WhatsApp message to clipboard
  async function copyWhatsAppMessage() {
    try {
      await navigator.clipboard.writeText(whatsappMessage.textContent);
      copyMessageBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyMessageBtn.textContent = 'Copy Message';
      }, 2000);
    } catch (error) {
      showStatus('Could not copy message', 'error');
    }
  }
  
  // Function to show status messages
  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message status-${type}`;
    statusMessage.style.display = 'block';
    
    if (type === 'info') {
      setTimeout(() => {
        statusMessage.style.display = 'none';
      }, 3000);
    }
  }
  
  // Function to format dates nicely
  function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  // Check if pause is future-dated (starts tomorrow or later)
  function isFuturePause(startDateStr) {
    const startDate = new Date(startDateStr);
    const today = new Date();

    // Reset time to midnight for accurate comparison
    today.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);

    return startDate > today;
  }
  
  // Set up date change listeners
  startDate.addEventListener('change', checkPreviewReadiness);
  endDate.addEventListener('change', checkPreviewReadiness);
  pauseReason.addEventListener('change', checkPreviewReadiness);
});