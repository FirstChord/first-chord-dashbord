'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import StudentCard from '@/components/student/StudentCard';
import NotesPanel from '@/components/student/NotesPanel';
import QuickLinks from '@/components/navigation/QuickLinks';
import TutorSchedulePanel from '@/components/tutor-dashboard/TutorSchedulePanel';
import { Users, Clock, Search } from 'lucide-react';
import { cache } from '@/lib/cache';
import {
  filterTutorStudentsBySearch,
  getTutorDashboardOptionNames,
} from '@/lib/tutor-dashboard-helpers.mjs';

const TUTOR_OPTIONS = getTutorDashboardOptionNames();

function notesUrlForStudent(student = {}) {
  const studentId = student.mms_id || student.ID || '';
  const token = student.noteAccessToken || student.note_access_token || '';
  const params = new URLSearchParams();
  if (token) params.set('token', token);
  return `/api/notes/${encodeURIComponent(studentId)}${params.toString() ? `?${params.toString()}` : ''}`;
}

export default function DashboardClient() {
  const [tutor, setTutor] = useState('');
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [lastNotes, setLastNotes] = useState(null);
  const [notesSource, setNotesSource] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [practiceChatPanel, setPracticeChatPanel] = useState(null);
  // const [isAuthenticated, setIsAuthenticated] = useState(true); // Always authenticated with hardcoded token

  // Fun loading messages
  const loadingMessages = [
    "The First Chord Dashboard is just taking a sec to learn ancient Greek, bear with it...",
    "The First Chord Dashboard is choosing between two lovely patterned shirts, please hold...",
    "The First Chord Dashboard is emotionally processing being a dashboard, please hold...",
    "The First Chord Dashboard is just round the corner, please hold...",
    "The First Chord Dashboard is exploring quantum physics, please hold...",
    "The First Chord Dashboard is just finishing the last of its lunch, please hold...",
    "The First Chord Dashboard is chatting with Vince, please hold...",
    "The First Chord Dashboard is pretending to be an ironing board, please hold...",
    "The First Chord Dashboard is tuning its guitar, please hold...",
    "The First Chord Dashboard is advising a chicken on road safety, please hold..."
  ];


  // Sync students from MMS
  const syncStudentsFromMMS = async (forcedTutor = null, forceSync = false) => {
    const targetTutor = forcedTutor || tutor;
    if (!targetTutor) return;

    // Check cache first (unless force sync is requested)
    if (!forceSync) {
      const cachedStudents = cache.getStudents(targetTutor);
      if (cachedStudents) {
        setStudents(cachedStudents);
        console.log(`📦 Using cached data for ${targetTutor} (${cachedStudents.length} students)`);
        return;
      }
    }

    // Show fun loading message
    const randomMessage = loadingMessages[Math.floor(Math.random() * loadingMessages.length)];
    setLoadingMessage(randomMessage);
    setIsLoading(true);

    console.log(`🔄 ${forceSync ? 'Force syncing' : 'Syncing'} students from MMS...`);

    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          tutor: targetTutor,
          forceSync: true 
        })
      });

      const data = await response.json();
      
      if (data.success && data.source === 'mms') {
        setStudents(data.students || []);
        
        // Cache the fresh data
        cache.setStudents(targetTutor, data.students || []);
        
        console.log(`✅ Synced ${data.count} students from MMS`);
      } else {
        console.log('❌ MMS sync failed, using local data');
        
        // Fallback to local data
        fetch(`/api/students?tutor=${targetTutor}`)
          .then(res => res.json())
          .then(data => setStudents(data.students || []));
      }
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      // Hide loading message
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  // Fetch students when tutor is selected
  useEffect(() => {
    if (tutor) {
      // Debug: Show cache info
      console.log('🔍 Cache info:', cache.getInfo());
      
      // Try cache first, then MMS sync, then fallback to local
      syncStudentsFromMMS(tutor, false); // false = allow cache usage
    }
  }, [tutor]); // Removed syncStudentsFromMMS from dependencies to prevent infinite loop

  useEffect(() => {
    if (!practiceChatPanel) return undefined;
    function onKey(event) {
      if (event.key === 'Escape') {
        setPracticeChatPanel(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [practiceChatPanel]);

  // Fetch notes when student is selected
  useEffect(() => {
    if (selectedStudent) {
      setLoading(true);
      
      fetch(notesUrlForStudent(selectedStudent))
        .then(res => res.json())
        .then(data => {
          if (!data.success && data.code === 'notes_token_required' && tutor) {
            cache.clearStudents(tutor);
            syncStudentsFromMMS(tutor, true);
          }
          setLastNotes(data.notes);
          setNotesSource(data.source);
          setLoading(false);
          
          if (data.success) {
            console.log('✅ Using live MMS notes data');
          } else {
            console.log('⚠️ Failed to fetch notes from MMS.');
          }
        })
        .catch(error => {
          console.error('Error fetching notes:', error);
          setLoading(false);
        });
    }
  }, [selectedStudent]);

  // Filter students by search
  const filteredStudents = filterTutorStudentsBySearch(students, searchTerm);

  // Debug logging (only when needed)
  // console.log('🔍 Dashboard state:', { tutor, tutorLength: tutor.length, tutorType: typeof tutor, isEmpty: !tutor });

  // Show loading screen if loading
  if (isLoading) {
    return (
      <>
        <style jsx>{`
          .loading-cloud {
            animation: gentle-float 3s ease-in-out infinite;
          }
          
          .loading-dots::after {
            content: '';
            animation: loading-dots 2s linear infinite;
          }
          
          @keyframes gentle-float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-8px); }
          }
          
          @keyframes loading-dots {
            0% { content: ''; }
            25% { content: '.'; }
            50% { content: '..'; }
            75% { content: '...'; }
            100% { content: ''; }
          }
        `}</style>
        <div className="min-h-screen bg-gradient-to-t from-green-100 to-blue-100 flex items-center justify-center relative overflow-hidden">
          {/* Cloud */}
          <div className="absolute inset-0 pointer-events-none">
            <Image
              src="/cloud.png"
              alt=""
              width={192}
              height={128}
              className="absolute top-16 right-8 opacity-90 transform -rotate-12"
            />
          </div>
          
          <div className="text-center relative z-10">
            <div className="mb-8">
              <div className="inline-flex items-center justify-center w-24 h-24 mb-6">
                {/* Floating Cloud */}
                <div className="loading-cloud">
                  <Image
                    src="/cloud.png"
                    alt="Loading cloud"
                    width={80}
                    height={53}
                    className="object-contain opacity-70"
                  />
                </div>
              </div>
              <h2 className="text-xl font-bold italic text-gray-800 max-w-md mx-auto leading-relaxed loading-dots" style={{ fontFamily: '"Cooper Hewitt", "Nimbus Sans L", "Arial", sans-serif' }}>
                {loadingMessage.replace(/\.\.\.$/, '')}
              </h2>
            </div>
          </div>
        </div>
      </>
    );
  }

  // If no tutor selected, show tutor selection
  if (!tutor) {
    return (
      <div className="min-h-screen bg-gradient-to-t from-green-100 to-blue-100 flex items-center justify-center relative overflow-hidden">
        {/* Cloud */}
        <div className="absolute inset-0 pointer-events-none">
          <Image
            src="/cloud.png"
            alt=""
            width={192}
            height={128}
            className="absolute top-16 right-8 opacity-90 transform -rotate-12"
          />
        </div>
        
        <div className="bg-white p-12 rounded-xl shadow-lg max-w-4xl w-full mx-8 relative z-10">
          <h1 className="text-2xl font-bold mb-8 text-center">Select Your Profile</h1>
          <div className="grid grid-cols-4 gap-8">
            {TUTOR_OPTIONS.map(tutorName => (
              <button
                key={tutorName}
                onClick={() => setTutor(tutorName)}
                className="px-8 py-4 text-white rounded-lg transition-colors text-center font-medium text-xl min-h-[60px] min-w-[140px] flex items-center justify-center"
                style={{ 
                  backgroundColor: '#2F6B3D',
                  '&:hover': { backgroundColor: '#245230' }
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#245230'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#2F6B3D'}
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
    <div className="min-h-screen bg-gradient-to-t from-green-100 to-blue-100 relative overflow-hidden">
      {/* Cloud */}
      <div className="absolute inset-0 pointer-events-none">
        <Image
          src="/cloud.png"
          alt=""
          width={192}
          height={128}
          className="absolute top-16 right-8 opacity-90 transform -rotate-12"
        />
      </div>
      
      {/* Header */}
      <header className="bg-blue-100 shadow-sm border-b border-blue-100/30">
        <div className="px-6 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 uppercase tracking-wide" style={{ fontFamily: '"Cooper Hewitt", "Nimbus Sans L", "Arial", sans-serif' }}>FIRST CHORD DASHBOARD</h1>
            <p className="text-gray-600">Welcome back, {tutor}!</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-gray-600">
              <Clock className="w-5 h-5" />
              <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
            </div>
            <button
              onClick={() => {
                setTutor('');
                setSelectedStudent(null);
                setLastNotes(null);
                setPracticeChatPanel(null);
              }}
              className="px-4 py-2 text-white rounded-lg transition-colors"
              style={{ backgroundColor: '#2F6B3D' }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#245230'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#2F6B3D'}
            >
              Switch Tutor
            </button>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Student List Sidebar */}
        <aside className="w-80 bg-gradient-radial from-yellow-100 via-yellow-50 to-transparent border-r overflow-y-auto" style={{
          background: 'radial-gradient(ellipse at center, rgba(254, 240, 138, 0.4) 0%, rgba(254, 249, 195, 0.3) 30%, rgba(255, 255, 255, 0.1) 70%, transparent 100%)'
        }}>
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
                Your Students ({filteredStudents.length})
              </span>
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
              <TutorSchedulePanel
                tutor={tutor}
                students={students}
                onSelectStudent={setSelectedStudent}
                compact
                defaultCollapsed
                collapseKey={selectedStudent?.mms_id || ''}
              />
              <h2 className="text-3xl font-bold mb-6">{selectedStudent.name}</h2>
              
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
                  <QuickLinks
                    student={selectedStudent}
                    onOpenPracticeChat={(url, name) => setPracticeChatPanel({ url, name })}
                  />
                </div>
              </div>

            </div>
          ) : (
            <div className="flex min-h-full items-center justify-center p-6 text-gray-500">
              <div className="flex w-full max-w-3xl flex-col items-center gap-6">
                <TutorSchedulePanel
                  tutor={tutor}
                  students={students}
                  onSelectStudent={setSelectedStudent}
                />
                <Users className="w-16 h-16 mx-auto mb-4" />
                <p className="text-xl">Select a student to begin</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {practiceChatPanel ? (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-slate-900/25 backdrop-blur-[1px]"
            onClick={() => setPracticeChatPanel(null)}
            aria-hidden
          />
          <aside className="flex h-full w-full max-w-3xl flex-col border-l border-blue-100 bg-white shadow-2xl">
            <header className="flex items-center justify-between gap-3 border-b border-blue-100 bg-gradient-to-r from-blue-50 to-green-50 px-5 py-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Practice Chat</p>
                <p className="text-sm font-bold text-slate-900">{practiceChatPanel.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={practiceChatPanel.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-blue-200 bg-white/90 px-3 py-1.5 text-xs font-bold text-blue-900 transition hover:bg-white"
                >
                  Open full page
                </a>
                <button
                  type="button"
                  onClick={() => setPracticeChatPanel(null)}
                  className="rounded-lg border border-blue-200 bg-white/90 px-3 py-1.5 text-xs font-bold text-blue-900 transition hover:bg-white"
                >
                  Close
                </button>
              </div>
            </header>
            <iframe
              key={practiceChatPanel.url}
              src={practiceChatPanel.url}
              title={`Practice Chat: ${practiceChatPanel.name}`}
              allow="microphone; clipboard-read; clipboard-write"
              className="h-full w-full flex-1 border-0"
            />
          </aside>
        </div>
      ) : null}

      {/* First Chord Logo - Bottom Right Corner */}
      <div className="fixed bottom-4 right-4 z-10">
        <Image
          src="/first-chord-banner.png"
          alt="First Chord Music School - Explore Music Together"
          width={300}
          height={169}
          className="rounded-lg opacity-90 hover:opacity-100 transition-opacity duration-300"
          priority={false}
        />
      </div>
    </div>
  );
}
