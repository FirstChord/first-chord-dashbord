import Image from 'next/image';
import StudentNotes from './StudentNotes';
import StudentLinks from './StudentLinks';

export default function StudentDashboard({ student }) {
  if (!student) {
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
        
        <div className="bg-white rounded-2xl p-8 text-center shadow-xl max-w-md relative z-10">
          <div className="text-6xl mb-4">🎵</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Oops!</h1>
          <p className="text-gray-600">
            We couldn't find your music dashboard. 
            Please check your link or contact your tutor.
          </p>
        </div>

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
        <div className="px-6 py-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 uppercase tracking-wide" style={{ fontFamily: '"Cooper Hewitt", "Nimbus Sans L", "Arial", sans-serif' }}>
              {student.name}'S MUSIC DASHBOARD
            </h1>
            <p className="text-gray-600">Keep practicing and have fun! 🎵</p>
          </div>
        </div>
      </header>

      <div className="p-6 max-w-7xl mx-auto relative z-10">        
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Notes Panel - Left Side (wider) */}
          <div className="lg:col-span-2">
            <StudentNotes 
              notes={student.notes} 
              notesSuccess={student.notesSuccess} 
            />
          </div>
          
          {/* Links Panel - Right Side (narrower) */}
          <div className="lg:col-span-1">
            <StudentLinks student={student} />
          </div>
        </div>

        {/* Encouraging Message */}
        <div className="mt-8 text-center">
          <div className="bg-white/80 backdrop-blur rounded-xl p-4 shadow-sm">
            <p className="text-gray-700 font-medium">
              🌟 Remember: Every great musician started with practice! Keep going! 🌟
            </p>
          </div>
        </div>
      </div>

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