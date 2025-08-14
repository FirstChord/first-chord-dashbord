'use client';

import { useState, useEffect } from 'react';
import StudentCard from '@/components/StudentCard';
import NotesPanel from '@/components/NotesPanel';
import QuickLinks from '@/components/QuickLinks';
import SetupWizard from '@/components/SetupWizard';
import AuthStatus from '@/components/AuthStatus';
import { Users, Clock, Search, RefreshCw } from 'lucide-react';
import { generateUrls } from '@/lib/config';

// Token interceptor - automatically captures fresh MMS tokens
let capturedToken = null;
const fallbackToken = null; // Remove for production - tokens should come from environment or user input

function getWorkingToken() {
  const sessionToken = sessionStorage.getItem('mms_token');
  const localToken = localStorage.getItem('mms_token');
  const token = capturedToken || sessionToken || localToken || fallbackToken;
  
  console.log('🔍 Token check:', {
    capturedToken: capturedToken ? 'Present' : 'None',
    sessionToken: sessionToken ? `Present (${sessionToken.substring(0, 20)}...)` : 'None',
    localToken: localToken ? `Present (${localToken.substring(0, 20)}...)` : 'None',
    fallbackToken: 'Present',
    usingToken: token ? `Valid (${token.substring(0, 20)}...)` : 'None',
    storageAvailable: typeof Storage !== 'undefined'
  });
  return token;
}

// Set up token interceptor when component loads
if (typeof window !== 'undefined' && !window.mmsInterceptorInstalled) {
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    // Debug all fetch calls
    console.log('🌐 Fetch intercepted:', args[0]);
    
    if (args[0] && typeof args[0] === 'string' && args[0].includes('api.mymusicstaff.com')) {
      console.log('🎯 MMS API call detected!', args[0]);
      const options = args[1] || {};
      const authHeader = options.headers?.['Authorization'] || options.headers?.['authorization'];
      console.log('📝 Auth header:', authHeader ? 'Present' : 'Missing');
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const newToken = authHeader.replace('Bearer ', '');
        console.log('🔍 Token extracted:', newToken.substring(0, 20) + '...');
        
        if (newToken !== capturedToken) {
          capturedToken = newToken;
          sessionStorage.setItem('mms_token', newToken);
          localStorage.setItem('mms_token', newToken);
          console.log('🎯 Fresh MMS token captured and stored for cross-tab access!');
          console.log('💾 Stored in localStorage:', localStorage.getItem('mms_token') ? 'Success' : 'Failed');
        } else {
          console.log('🔄 Token already captured (same as current)');
        }
      }
    }
    return originalFetch.apply(this, args);
  };
  
  // Listen for storage events from other tabs (like MMS tab)
  window.addEventListener('storage', function(e) {
    console.log('📡 Storage event detected:', e.key, e.newValue ? 'Token received' : 'Token cleared');
    if (e.key === 'mms_token' && e.newValue) {
      capturedToken = e.newValue;
      console.log('🔄 Token updated from another tab (MMS)!');
    }
  });
  
  window.mmsInterceptorInstalled = true;
  console.log('🔧 Cross-tab MMS token interceptor installed');
  console.log('🌍 Current domain:', window.location.hostname);
  console.log('🔗 Will intercept calls to: api.mymusicstaff.com');
}

export default function Dashboard() {
  const [tutor, setTutor] = useState('');
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [lastNotes, setLastNotes] = useState(null);
  const [notesSource, setNotesSource] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [tokenStatus, setTokenStatus] = useState('checking');
  const [syncStatus, setSyncStatus] = useState('idle'); // idle, syncing, success, error
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());

  // Sync students from MMS
  const syncStudentsFromMMS = async (forcedTutor = null) => {
    const targetTutor = forcedTutor || tutor;
    if (!targetTutor) return;

    setSyncStatus('syncing');
    console.log('🔄 Syncing students from MMS...');

    try {
      const token = getWorkingToken();
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({ 
          tutor: targetTutor,
          forceSync: true 
        })
      });

      const data = await response.json();
      
      if (data.success && data.source === 'mms') {
        setStudents(data.students);
        setSyncStatus('success');
        setLastSyncTime(new Date());
        console.log(`✅ Synced ${data.count} students from MMS`);
        
        // Don't enable selection mode for teacher-filtered results from MMS
        // Only enable it if we get unfiltered data that needs manual selection
        if (data.count > 50 && !data.filtered) {
          setSelectionMode(true);
        } else {
          setSelectionMode(false); // Make sure selection mode is off for teacher-filtered data
        }
        
        // Show success message briefly
        setTimeout(() => setSyncStatus('idle'), 3000);
      } else {
        setSyncStatus('error');
        console.log('❌ MMS sync failed, using local data');
        
        // Fallback to local data
        fetch(`/api/students?tutor=${targetTutor}`)
          .then(res => res.json())
          .then(data => setStudents(data.students));
          
        setTimeout(() => setSyncStatus('idle'), 5000);
      }
    } catch (error) {
      console.error('Sync error:', error);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 5000);
    }
  };

  // Toggle student selection
  const toggleStudentSelection = (studentId) => {
    const newSelected = new Set(selectedStudentIds);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudentIds(newSelected);
  };

  // Save selected students as "Finn's students"
  const saveSelectedStudents = async () => {
    const selectedStudents = students.filter(s => selectedStudentIds.has(s.mms_id));
    
    // Update the selected students to have Finn as tutor
    const updatedStudents = selectedStudents.map(student => ({
      ...student,
      current_tutor: 'Finn'
    }));

    try {
      // Update local database with selected students
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          students: updatedStudents,
          action: 'save_selection'
        })
      });

      if (response.ok) {
        setStudents(updatedStudents);
        setSelectionMode(false);
        setSelectedStudentIds(new Set());
        console.log(`✅ Saved ${updatedStudents.length} students as Finn's students`);
      }
    } catch (error) {
      console.error('Error saving students:', error);
    }
  };

  // Fetch students when tutor is selected
  useEffect(() => {
    if (tutor) {
      // Try MMS sync first, fallback to local
      syncStudentsFromMMS(tutor);
    }
  }, [tutor]);

  // Fetch notes when student is selected
  useEffect(() => {
    if (selectedStudent) {
      setLoading(true);
      const token = getWorkingToken();
      
      fetch(`/api/notes/${selectedStudent.mms_id}${token ? `?token=${token}` : ''}`)
        .then(res => res.json())
        .then(data => {
          setLastNotes(data.lastNotes);
          setNotesSource(data.source);
          setLoading(false);
          
          // Update token status based on response
          if (data.source === 'live') {
            setTokenStatus('active');
            console.log('✅ Using live MMS data');
          } else {
            setTokenStatus('inactive');
            console.log('⚠️ Using cached notes. Open MMS in another tab for live data.');
          }
        })
        .catch(error => {
          console.error('Error fetching notes:', error);
          setLoading(false);
          setTokenStatus('error');
        });
    }
  }, [selectedStudent]);

  // Filter students by search
  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // If no tutor selected, show tutor selection
  if (!tutor) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-12 rounded-xl shadow-lg max-w-4xl w-full mx-8">
          <h1 className="text-2xl font-bold mb-8 text-center">Select Your Profile</h1>
          <div className="grid grid-cols-3 gap-8">
            {['Arion', 'Dean', 'Eléna', 'Eve', 'Fennella', 'Finn', 'Jungyoun', 'Kim', 'Patrick', 'Robbie', 'Stef', 'Tom'].map(tutorName => (
              <button
                key={tutorName}
                onClick={() => setTutor(tutorName)}
                className="px-8 py-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-center font-medium text-xl min-h-[60px] min-w-[140px] flex items-center justify-center"
              >
                {tutorName}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Music School Dashboard</h1>
            <p className="text-gray-600">Welcome back, {tutor}!</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Token Status Indicator */}
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
              tokenStatus === 'active' ? 'bg-green-100 text-green-700' :
              tokenStatus === 'inactive' ? 'bg-yellow-100 text-yellow-700' :
              tokenStatus === 'error' ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                tokenStatus === 'active' ? 'bg-green-500' :
                tokenStatus === 'inactive' ? 'bg-yellow-500' :
                tokenStatus === 'error' ? 'bg-red-500' :
                'bg-gray-500'
              }`}></div>
              <span>
                {tokenStatus === 'active' ? 'Live Data' :
                 tokenStatus === 'inactive' ? 'Cached Data' :
                 tokenStatus === 'error' ? 'Connection Error' :
                 'Checking...'}
              </span>
            </div>
            
            {/* MMS Sync Button */}
            <button
              onClick={() => syncStudentsFromMMS()}
              disabled={syncStatus === 'syncing'}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                syncStatus === 'syncing' ? 'bg-blue-100 text-blue-600 cursor-not-allowed' :
                syncStatus === 'success' ? 'bg-green-100 text-green-700' :
                syncStatus === 'error' ? 'bg-red-100 text-red-700' :
                'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {syncStatus === 'syncing' ? (
                <>
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  Syncing...
                </>
              ) : syncStatus === 'success' ? (
                <>
                  <div className="w-4 h-4 text-green-600">✓</div>
                  Synced
                </>
              ) : syncStatus === 'error' ? (
                <>
                  <div className="w-4 h-4 text-red-600">⚠</div>
                  Retry
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Sync MMS
                </>
              )}
            </button>

            {/* Debug Token Button */}
            <button
              onClick={() => {
                console.log('🔧 Manual token debug:');
                console.log('Raw localStorage:', localStorage.getItem('mms_token'));
                console.log('Raw sessionStorage:', sessionStorage.getItem('mms_token'));
                console.log('Captured token:', capturedToken);
                const token = getWorkingToken();
                console.log('Final working token:', token ? token.substring(0, 50) + '...' : 'None');
              }}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
            >
              🔧 Test Token
            </button>

            {/* Clear Test Token Button */}
            <button
              onClick={() => {
                localStorage.removeItem('mms_token');
                sessionStorage.removeItem('mms_token');
                capturedToken = null;
                console.log('🧹 Cleared all test tokens - will use fallback token');
                // Trigger a re-sync to test with fallback token
                syncStudentsFromMMS();
              }}
              className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm"
            >
              🧹 Clear Test
            </button>

            {/* Manual Token Input */}
            <button
              onClick={() => {
                const token = prompt('Paste a fresh MMS token here:');
                if (token && token.trim()) {
                  const cleanToken = token.trim();
                  capturedToken = cleanToken;
                  sessionStorage.setItem('mms_token', cleanToken);
                  localStorage.setItem('mms_token', cleanToken);
                  console.log('✅ Fresh token manually added!');
                  // Trigger sync to test
                  syncStudentsFromMMS();
                }
              }}
              className="px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm"
            >
              📝 Add Token
            </button>

            {/* Selection Mode Toggle */}
            {students.length > 0 && (
              <button
                onClick={() => setSelectionMode(!selectionMode)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectionMode 
                    ? 'bg-orange-100 text-orange-700' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {selectionMode ? '✓ Selecting' : '📋 Select Mine'}
              </button>
            )}

            {/* Save Selection Button */}
            {selectionMode && selectedStudentIds.size > 0 && (
              <button
                onClick={saveSelectedStudents}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium"
              >
                Save {selectedStudentIds.size} Students
              </button>
            )}
            
            {lastSyncTime && (
              <div className="text-xs text-gray-500">
                Last sync: {lastSyncTime.toLocaleTimeString()}
              </div>
            )}
            <div className="flex items-center gap-2 text-gray-600">
              <Clock className="w-5 h-5" />
              <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
            </div>
            <button
              onClick={() => setShowSetupWizard(true)}
              className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
            >
              ⚙️ Run Setup Wizard
            </button>
            <button
              onClick={() => {
                setTutor('');
                setSelectedStudent(null);
                setLastNotes(null);
              }}
              className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Switch Tutor
            </button>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Student List Sidebar */}
        <aside className="w-80 bg-white border-r overflow-y-auto">
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-4 text-gray-600">
              <Users className="w-5 h-5" />
              <span className="font-medium">
                {selectionMode ? `All Students (${filteredStudents.length})` : `Your Students (${filteredStudents.length})`}
              </span>
              {selectionMode && selectedStudentIds.size > 0 && (
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                  {selectedStudentIds.size} selected
                </span>
              )}
            </div>
            {selectionMode && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  🎯 <strong>Selection Mode:</strong> Check the boxes to mark which students are yours, then click "Save" to update your roster.
                </p>
              </div>
            )}
            <div className="space-y-3">
              {filteredStudents.map(student => (
                <StudentCard
                  key={student.mms_id}
                  student={student}
                  onClick={setSelectedStudent}
                  isSelected={selectedStudent?.mms_id === student.mms_id}
                  showCheckbox={selectionMode}
                  isChecked={selectedStudentIds.has(student.mms_id)}
                  onToggleCheck={toggleStudentSelection}
                />
              ))}
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto">
          {selectedStudent ? (
            <div className="p-6 max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold mb-6">{selectedStudent.name}</h2>
              
              {/* Auth Status */}
              <AuthStatus student={selectedStudent} tutorName={tutor} />
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Previous Notes */}
                <div>
                  {loading ? (
                    <div className="bg-gray-100 rounded-lg p-6 animate-pulse">
                      <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                      <div className="h-4 bg-gray-300 rounded w-full mb-2"></div>
                      <div className="h-4 bg-gray-300 rounded w-5/6"></div>
                    </div>
                  ) : (
                    lastNotes && <NotesPanel notes={lastNotes} source={notesSource} />
                  )}
                </div>

                {/* Quick Links */}
                <div>
                  <QuickLinks student={selectedStudent} />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-8 flex gap-4">
                <a
                  href={generateUrls.myMusicStaff(selectedStudent.mms_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Open in MyMusicStaff to Add Notes
                </a>
                <button className="px-6 py-3 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors">
                  Start Lesson Timer
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <Users className="w-16 h-16 mx-auto mb-4" />
                <p className="text-xl">Select a student to begin</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Setup Wizard Modal */}
      {showSetupWizard && (
        <SetupWizard 
          tutorName={tutor}
          onComplete={() => setShowSetupWizard(false)}
        />
      )}
    </div>
  );
}
