'use client';

import { useState, useEffect } from 'react';
import StudentCard from '@/components/StudentCard';
import NotesPanel from '@/components/NotesPanel';
import QuickLinks from '@/components/QuickLinks';
import SetupWizard from '@/components/SetupWizard';
import AuthStatus from '@/components/AuthStatus';
import { Users, Clock, Search, RefreshCw } from 'lucide-react';

export default function Dashboard({ initialData }) {
  const [students, setStudents] = useState(initialData?.students || []);
  const [allStudents, setAllStudents] = useState(initialData?.students || []);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [lastNotes, setLastNotes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [tutor, setTutor] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [tokenStatus, setTokenStatus] = useState(initialData?.authenticated ? 'active' : 'inactive');
  const [notesSource, setNotesSource] = useState('cached');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());
  const [isAuthenticated, setIsAuthenticated] = useState(initialData?.authenticated || false);

  // Initialize with server-rendered data
  useEffect(() => {
    if (initialData?.students) {
      setStudents(initialData.students);
      setAllStudents(initialData.students);
      setIsAuthenticated(initialData.authenticated);
      setTokenStatus(initialData.authenticated ? 'active' : 'inactive');
      
      if (initialData.error) {
        console.error('Initial data error:', initialData.error);
      } else {
        console.log(`✅ Loaded ${initialData.students.length} students from server`);
      }
    }
  }, [initialData]);

  const syncStudentsFromMMS = async (targetTutor) => {
    if (!targetTutor) return;

    setSyncStatus('syncing');
    console.log('🔄 Syncing students from MMS...');

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

  // Filter students by search term and tutor
  useEffect(() => {
    let filtered = allStudents;
    
    if (searchTerm) {
      filtered = filtered.filter(student => 
        student.FirstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.LastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.FullName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (tutor) {
      filtered = students; // Use tutor-filtered students from API
    }
    
    setFilteredStudents(filtered);
  }, [searchTerm, students, allStudents, tutor]);

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
      
      fetch(`/api/notes/${selectedStudent.mms_id}`)
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
            console.log('⚠️ Using cached notes.');
          }
        })
        .catch(error => {
          console.error('Error fetching notes:', error);
          setLoading(false);
          setTokenStatus('error');
        });
    }
  }, [selectedStudent]);

  const handleStudentSelect = (student) => {
    if (selectionMode) {
      const newSelectedIds = new Set(selectedStudentIds);
      if (newSelectedIds.has(student.ID)) {
        newSelectedIds.delete(student.ID);
      } else {
        newSelectedIds.add(student.ID);
      }
      setSelectedStudentIds(newSelectedIds);
    } else {
      setSelectedStudent(student);
    }
  };

  const displayStudents = tutor ? students : filteredStudents;
  const activeStudents = displayStudents.filter(s => s.Status === 'Active');
  const totalStudents = displayStudents.length;

  const refreshData = () => {
    if (tutor) {
      syncStudentsFromMMS(tutor);
    } else {
      // Refresh all students data
      window.location.reload();
    }
  };

  const clearSelection = () => {
    setTutor('');
    setStudents(allStudents);
    setSelectionMode(false);
    setSelectedStudentIds(new Set());
  };

  if (initialData?.error && !isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Configuration Error</h2>
          <p className="text-red-700 mb-4">{initialData.error}</p>
          <p className="text-sm text-red-600">
            Please ensure the MMS_DEFAULT_TOKEN environment variable is properly configured.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Music School Dashboard</h1>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>{totalStudents} students</span>
              {tutor && <span className="text-blue-600 font-medium">({tutor})</span>}
            </div>
            <div className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${
                activeStudents.length > 0 ? 'bg-green-500' : 'bg-gray-400'
              }`}></span>
              <span>{activeStudents.length} active</span>
            </div>
            {lastSyncTime && (
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>Last sync: {lastSyncTime.toLocaleTimeString()}</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3 mt-4 lg:mt-0">
          <AuthStatus 
            status={tokenStatus} 
            source={notesSource}
            onRefresh={refreshData}
            syncStatus={syncStatus}
          />
          <button
            onClick={refreshData}
            disabled={syncStatus === 'syncing'}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
            {syncStatus === 'syncing' ? 'Syncing...' : 'Refresh'}
          </button>
          <button
            onClick={() => setShowSetup(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Setup
          </button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search students..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        
        {tutor && (
          <button
            onClick={clearSelection}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Clear Filter ({tutor})
          </button>
        )}
      </div>

      {/* Selection Mode Controls */}
      {selectionMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-blue-800">
                Selection Mode: {selectedStudentIds.size} students selected
              </h3>
              <p className="text-xs text-blue-600">
                Click students to select them for bulk operations
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedStudentIds(new Set())}
                className="px-3 py-1 text-xs font-medium text-blue-700 bg-white border border-blue-300 rounded hover:bg-blue-50"
              >
                Clear Selection
              </button>
              <button
                onClick={() => setSelectionMode(false)}
                className="px-3 py-1 text-xs font-medium text-blue-700 bg-white border border-blue-300 rounded hover:bg-blue-50"
              >
                Exit Selection Mode
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Students List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Students</h2>
            </div>
            <div className="p-6">
              {displayStudents.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No students found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {searchTerm ? 'Try adjusting your search terms.' : 'Start by selecting a tutor or refreshing the data.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {displayStudents.map((student) => (
                    <StudentCard
                      key={student.ID}
                      student={student}
                      isSelected={selectionMode ? selectedStudentIds.has(student.ID) : selectedStudent?.ID === student.ID}
                      onClick={() => handleStudentSelect(student)}
                      selectionMode={selectionMode}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Side Panel */}
        <div className="space-y-6">
          {/* Quick Links */}
          <QuickLinks 
            onTutorSelect={setTutor} 
            selectedTutor={tutor}
            student={selectedStudent}
          />
          
          {/* Notes Panel */}
          {selectedStudent && !selectionMode && (
            <NotesPanel 
              student={selectedStudent}
              notes={lastNotes}
              loading={loading}
              source={notesSource}
            />
          )}
        </div>
      </div>

      {/* Setup Wizard Modal */}
      {showSetup && (
        <SetupWizard onClose={() => setShowSetup(false)} />
      )}
    </div>
  );
}
