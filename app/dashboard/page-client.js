'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import StudentCard from '@/components/student/StudentCard';
import NotesPanel from '@/components/student/NotesPanel';
import QuickLinks from '@/components/navigation/QuickLinks';
import TutorSchedulePanel from '@/components/tutor-dashboard/TutorSchedulePanel';
import HeaderGreenery from '@/components/tutor-dashboard/HeaderGreenery';
import { Search, ChevronLeft } from 'lucide-react';
import { cache } from '@/lib/cache';
import {
  excludeGroupOnlyStudents,
  filterTutorStudentsBySearch,
} from '@/lib/tutor-dashboard-helpers.mjs';

const TUTOR_STORAGE_KEY = 'fc_dashboard_tutor';

function lessonStartMinutes(lesson) {
  const match = `${lesson.lessonTime || ''}`.match(/^(\d{1,2}):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function possessive(name = '') {
  return name.endsWith('s') ? `${name}’` : `${name}’s`;
}

function timeAwareGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function notesUrlForStudent(student = {}, { history = false } = {}) {
  const studentId = student.mms_id || student.ID || '';
  const token = student.noteAccessToken || student.note_access_token || '';
  const params = new URLSearchParams();
  if (token) params.set('token', token);
  if (history) params.set('history', '1');
  return `/api/notes/${encodeURIComponent(studentId)}${params.toString() ? `?${params.toString()}` : ''}`;
}

export default function DashboardClient({ tutorOptions = [] }) {
  const TUTOR_OPTIONS = useMemo(() => tutorOptions.map((entry) => entry.shortName), [tutorOptions]);
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [todayLessons, setTodayLessons] = useState([]);
  const searchInputRef = useRef(null);

  // Selecting a student slides the sidebar away so the view is all about them
  const handleSelectStudent = (student) => {
    setSelectedStudent(student);
    if (student) setSidebarOpen(false);
  };

  const handleSelectTutor = (tutorName) => {
    setTutor(tutorName);
    try {
      localStorage.setItem(TUTOR_STORAGE_KEY, tutorName);
    } catch {}
  };

  // Restore the tutor from the last visit so a reload doesn't ask again
  useEffect(() => {
    try {
      const saved = localStorage.getItem(TUTOR_STORAGE_KEY);
      if (saved && TUTOR_OPTIONS.includes(saved)) {
        setTutor(saved);
      }
    } catch {}
  }, []);
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

  // Today's lessons feed the sidebar time chips and the at-a-glance summary
  useEffect(() => {
    if (!tutor) {
      setTodayLessons([]);
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    fetch(`/api/tutor-schedule?${new URLSearchParams({ tutor, date: today })}`)
      .then((res) => res.json())
      .then((data) => setTodayLessons(data.success ? (data.lessons || []) : []))
      .catch(() => setTodayLessons([]));
  }, [tutor]);

  const todayTimeByStudent = useMemo(() => {
    const map = new Map();
    for (const lesson of todayLessons) {
      for (const studentId of lesson.studentMmsIds || []) {
        if (!map.has(studentId)) map.set(studentId, lesson.lessonTime || '');
      }
    }
    return map;
  }, [todayLessons]);

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

  // Keyboard shortcuts: Esc deselects the current student, "/" jumps to search
  useEffect(() => {
    function onKey(event) {
      const target = event.target;
      const isTyping = target instanceof HTMLElement
        && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (event.key === 'Escape' && !isTyping) {
        setSelectedStudent((current) => (current ? null : current));
        setSidebarOpen(true);
      }

      if (event.key === '/' && !isTyping) {
        event.preventDefault();
        setSidebarOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 0);
      }
    }
    if (practiceChatPanel) return undefined;
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [practiceChatPanel]);

  useEffect(() => {
    if (!practiceChatPanel?.url) return undefined;

    let closeTimer = null;
    let expectedOrigin = '';
    try {
      expectedOrigin = new URL(practiceChatPanel.url).origin;
    } catch {
      expectedOrigin = '';
    }

    function onPracticeChatMessage(event) {
      const message = event.data || {};
      if (message.type !== 'firstchord:practice-chat-complete') return;
      if (expectedOrigin && event.origin !== expectedOrigin) return;

      setPracticeChatPanel((current) => (
        current
          ? {
              ...current,
              completed: true,
              completedStatus: message.status || 'completed',
            }
          : current
      ));

      closeTimer = window.setTimeout(() => {
        setPracticeChatPanel(null);
      }, 1100);
    }

    window.addEventListener('message', onPracticeChatMessage);
    return () => {
      window.removeEventListener('message', onPracticeChatMessage);
      if (closeTimer) window.clearTimeout(closeTimer);
    };
  }, [practiceChatPanel?.url]);

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

  // Filter students by search (group-only students, e.g. Ukulele Orchestra, stay hidden)
  const filteredStudents = filterTutorStudentsBySearch(excludeGroupOnlyStudents(students), searchTerm);

  // Today-at-a-glance summary for the empty state
  const todaySummary = (() => {
    if (todayLessons.length === 0) {
      return { headline: 'No lessons today', hint: 'Enjoy the breather — or pick a student to look something up.' };
    }
    const now = new Date().getHours() * 60 + new Date().getMinutes();
    const current = todayLessons.find((lesson) => {
      const start = lessonStartMinutes(lesson);
      return start != null && start <= now && now < start + (lesson.durationMinutes || 30);
    });
    if (current) {
      return {
        headline: `Now: ${current.studentLabel} (${current.lessonTime})`,
        hint: 'Click their lesson above to open their space.',
      };
    }
    const next = todayLessons.find((lesson) => {
      const start = lessonStartMinutes(lesson);
      return start != null && start > now;
    });
    const count = `${todayLessons.length} lesson${todayLessons.length === 1 ? '' : 's'} today`;
    if (next) {
      return { headline: `${count} — next is ${next.studentLabel} at ${next.lessonTime}`, hint: 'Click a lesson above to open their space.' };
    }
    return { headline: `All ${todayLessons.length} lessons done for today`, hint: 'Nice work — see you next time.' };
  })();

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
              <h2 className="text-xl font-bold italic text-gray-800 max-w-md mx-auto leading-relaxed loading-dots">
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
                onClick={() => handleSelectTutor(tutorName)}
                className="px-8 py-4 text-white rounded-lg text-center font-medium text-xl min-h-[60px] min-w-[140px] flex items-center justify-center bg-[#2F6B3D] hover:bg-[#245230] hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 transition-all duration-150"
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
    <div className="h-screen flex flex-col bg-gradient-to-t from-green-100 to-blue-100 relative overflow-hidden">
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
      <header className="relative shrink-0 bg-blue-100 shadow-sm border-b border-blue-100/30">
        <HeaderGreenery />
        <div className="relative px-6 py-5 text-center">
          <h1 className="text-3xl font-black tracking-tight text-gray-900">
            {possessive(tutor)} Dashboard
          </h1>
          <p className="mt-1 text-gray-600">
            {timeAwareGreeting()}! · {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
          </p>
          <button
            onClick={() => {
              setTutor('');
              setSelectedStudent(null);
              setLastNotes(null);
              setPracticeChatPanel(null);
              setSidebarOpen(true);
              try {
                localStorage.removeItem(TUTOR_STORAGE_KEY);
              } catch {}
            }}
            className="absolute right-6 top-1/2 -translate-y-1/2 px-4 py-2 text-white rounded-lg bg-[#2F6B3D] hover:bg-[#245230] transition-colors"
          >
            Switch Tutor
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Student List Sidebar */}
        <aside
          className={`shrink-0 overflow-y-auto overflow-x-hidden transition-all duration-300 ease-out ${
            sidebarOpen ? 'w-80 border-r' : 'w-0'
          }`}
          style={{
            background: 'radial-gradient(ellipse at center, rgba(254, 240, 138, 0.4) 0%, rgba(254, 249, 195, 0.3) 30%, rgba(255, 255, 255, 0.1) 70%, transparent 100%)'
          }}
        >
          <div className="w-80">
            <div className="sticky top-0 z-10 p-4 border-b bg-white/70 backdrop-blur">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Find your student"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2F6B3D]"
                />
              </div>
            </div>
            <div className="p-4">
              <div className="space-y-3">
                {filteredStudents.map(student => (
                  <StudentCard
                    key={student.mms_id}
                    student={student}
                    onClick={handleSelectStudent}
                    isSelected={selectedStudent?.mms_id === student.mms_id}
                    showTutor={false}
                    todayTime={todayTimeByStudent.get(student.mms_id) || ''}
                  />
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto">
          {selectedStudent ? (
            <div className="p-6 max-w-6xl mx-auto">
              <div className="flex items-start justify-between gap-3">
                {!sidebarOpen && (
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-green-50/80 px-4 py-2 text-sm font-bold text-[#2F6B3D] shadow-sm backdrop-blur transition-colors hover:bg-white/90"
                  >
                    <ChevronLeft className="h-4 w-4 text-[#2F6B3D]" />
                    Students
                  </button>
                )}
                <div className="min-w-0 flex-1">
                  <TutorSchedulePanel
                    tutor={tutor}
                    students={students}
                    onSelectStudent={handleSelectStudent}
                    compact
                    defaultCollapsed
                    collapseKey={selectedStudent?.mms_id || ''}
                  />
                </div>
              </div>
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
                    lastNotes && (
                      <NotesPanel
                        key={selectedStudent.mms_id}
                        notes={lastNotes}
                        source={notesSource}
                        studentName={selectedStudent.name || ''}
                        onLoadHistory={async () => {
                          const res = await fetch(notesUrlForStudent(selectedStudent, { history: true }));
                          const data = await res.json();
                          return data.history || [];
                        }}
                      />
                    )
                  )}
                </div>

                {/* Quick Links */}
                <div>
                  <QuickLinks
                    student={selectedStudent}
                    activeTutor={tutor}
                    onOpenPracticeChat={(url, name) => setPracticeChatPanel({ url, name, completed: false })}
                  />
                </div>
              </div>

            </div>
          ) : (
            <div className="flex min-h-full items-center justify-center p-6">
              <div className="flex w-full max-w-3xl flex-col items-center gap-6">
                <TutorSchedulePanel
                  tutor={tutor}
                  students={students}
                  onSelectStudent={handleSelectStudent}
                />
                <div className="text-center">
                  <p className="text-xl font-semibold text-gray-700">{todaySummary.headline}</p>
                  <p className="mt-1 text-sm text-gray-500">{todaySummary.hint}</p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {practiceChatPanel ? (
        <div className="fixed inset-0 z-50 flex">
          <style jsx>{`
            @keyframes panel-slide-in {
              from { transform: translateX(24px); opacity: 0; }
              to { transform: translateX(0); opacity: 1; }
            }
            @keyframes overlay-fade-in {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            .practice-chat-overlay {
              animation: overlay-fade-in 0.2s ease-out;
            }
            .practice-chat-panel {
              animation: panel-slide-in 0.25s ease-out;
            }
          `}</style>
          <div
            className="practice-chat-overlay flex-1 bg-slate-900/25 backdrop-blur-[1px]"
            onClick={() => setPracticeChatPanel(null)}
            aria-hidden
          />
          <aside className="practice-chat-panel flex h-full w-full max-w-3xl flex-col border-l border-green-100 bg-white shadow-2xl">
            <header className="flex items-center justify-between gap-3 border-b border-green-100 bg-gradient-to-r from-green-50 to-blue-50 px-5 py-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#2F6B3D]">Practice Chat</p>
                <p className="text-sm font-bold text-slate-900">{practiceChatPanel.name}</p>
              </div>
              <div className="flex items-center gap-2">
                {practiceChatPanel.completed ? (
                  <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 shadow-sm">
                    {practiceChatPanel.completedStatus === 'absent_no_makeup' ? 'Attendance saved' : 'Lesson done'} ✓ Closing...
                  </div>
                ) : null}
                <a
                  href={practiceChatPanel.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-green-200 bg-white/90 px-3 py-1.5 text-xs font-bold text-[#2F6B3D] transition hover:bg-white"
                >
                  Open full page
                </a>
                <button
                  type="button"
                  onClick={() => setPracticeChatPanel(null)}
                  className="rounded-lg border border-green-200 bg-white/90 px-3 py-1.5 text-xs font-bold text-[#2F6B3D] transition hover:bg-white"
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

      {/* First Chord Logo - Bottom Right Corner (decorative; never blocks content) */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-0 hidden lg:block">
        <Image
          src="/first-chord-banner.png"
          alt="First Chord Music School - Explore Music Together"
          width={220}
          height={124}
          className="rounded-lg opacity-80"
          priority={false}
        />
      </div>
    </div>
  );
}
