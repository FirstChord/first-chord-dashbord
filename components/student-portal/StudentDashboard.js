import Image from 'next/image';
import StudentNotes from './StudentNotes';
import StudentLinks from './StudentLinks';
import HeaderGreenery from '@/components/tutor-dashboard/HeaderGreenery';

function possessive(name = '') {
  return name.endsWith('s') ? `${name}’` : `${name}’s`;
}

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
      <header className="relative bg-blue-100 shadow-sm border-b border-blue-100/30">
        <HeaderGreenery />
        <div className="relative px-4 sm:px-6 py-4 sm:py-5 text-center">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900">
            {possessive(student.name.split(' ')[0])} Dashboard
          </h1>
          <p className="mt-1 text-sm sm:text-base text-gray-600">Welcome back!</p>
        </div>
      </header>

      <div className="p-4 sm:p-6 max-w-7xl mx-auto relative z-10">        
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
          {/* Notes Panel - Left Side (wider) */}
          <div className="lg:col-span-2">
            <StudentNotes
              notes={student.notes}
              notesSuccess={student.notesSuccess}
              studentName={student.name}
            />
          </div>
          
          {/* Links Panel - Right Side (narrower) */}
          <div className="lg:col-span-1">
            <StudentLinks student={student} />
          </div>
        </div>

      </div>

      {/* First Chord Logo - Bottom Right Corner */}
      <div className="fixed bottom-2 right-2 sm:bottom-4 sm:right-4 z-10 pointer-events-none">
        <Image
          src="/first-chord-banner.png"
          alt="First Chord Music School - Explore Music Together"
          width={150}
          height={85}
          className="sm:w-[250px] sm:h-[141px] rounded-lg opacity-80 sm:opacity-90 hover:opacity-100 transition-opacity duration-300"
          priority={false}
        />
      </div>
      
      {/* Bottom padding to prevent content overlap with logo */}
      <div className="h-20 sm:h-24"></div>
    </div>
  );
}