'use client';

import { useState, useEffect } from 'react';
import StudentCard from '@/components/StudentCard';
import NotesPanel from '@/components/NotesPanel';
import QuickLinks from '@/components/QuickLinks';
import SetupWizard from '@/components/SetupWizard';
import AuthStatus from '@/components/AuthStatus';
import { Users, Clock, Search } from 'lucide-react';
import { generateUrls } from '@/lib/config';

// Token interceptor - automatically captures fresh MMS tokens
let capturedToken = null;
const fallbackToken = "mms api key";

function getWorkingToken() {
  return capturedToken || sessionStorage.getItem('mms_token') || fallbackToken;
}

// Set up token interceptor when component loads
if (typeof window !== 'undefined' && !window.mmsInterceptorInstalled) {
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    if (args[0] && typeof args[0] === 'string' && args[0].includes('api.mymusicstaff.com')) {
      const options = args[1] || {};
      const authHeader = options.headers?.['Authorization'] || options.headers?.['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const newToken = authHeader.replace('Bearer ', '');
        if (newToken !== capturedToken) {
          capturedToken = newToken;
          sessionStorage.setItem('mms_token', newToken);
          console.log('🎯 Fresh MMS token captured automatically!');
        }
      }
    }
    return originalFetch.apply(this, args);
  };
  window.mmsInterceptorInstalled = true;
  console.log('🔧 MMS token interceptor installed');
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

  // Fetch students when tutor is selected
  useEffect(() => {
    if (tutor) {
      fetch(`/api/students?tutor=${tutor}`)
        .then(res => res.json())
        .then(data => setStudents(data.students));
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
              <span className="font-medium">Your Students ({filteredStudents.length})</span>
            </div>
            <div className="space-y-3">
              {filteredStudents.map(student => (
                <StudentCard
                  key={student.mms_id}
                  student={student}
                  onClick={setSelectedStudent}
                  isSelected={selectedStudent?.mms_id === student.mms_id}
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
