import StudentHeader from './StudentHeader';
import StudentNotes from './StudentNotes';
import StudentLinks from './StudentLinks';

export default function StudentDashboard({ student }) {
  if (!student) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-400 via-purple-500 to-pink-400 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center shadow-xl max-w-md">
          <div className="text-6xl mb-4">🎵</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Oops!</h1>
          <p className="text-gray-600">
            We couldn't find your music dashboard. 
            Please check your link or contact your tutor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-400 via-purple-500 to-pink-400 p-4">
      <div className="max-w-4xl mx-auto">
        <StudentHeader student={student} />
        
        <div className="grid gap-6 lg:grid-cols-1">
          <StudentNotes 
            notes={student.notes} 
            notesSuccess={student.notesSuccess} 
          />
          
          <StudentLinks student={student} />
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <div className="bg-white/20 backdrop-blur rounded-xl p-4 text-white">
            <p className="text-sm">
              🎵 Keep practicing and have fun with your music! 🎵
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}