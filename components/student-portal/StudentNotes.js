import { Calendar } from 'lucide-react';

export default function StudentNotes({ notes, notesSuccess }) {
  if (!notesSuccess || !notes) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-md">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Your Recent Lesson Notes
        </h2>
        <p className="text-gray-600">
          No lesson notes available yet. Keep practicing! 🌟
        </p>
      </div>
    );
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Recent Lesson';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Recent Lesson';
    
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatNotesText = (text) => {
    if (!text) return text;
    
    // Split text by lines to process each line
    const lines = text.split('\n');
    
    return lines.map((line, index) => {
      // Check if line contains **bold** text (questions from square brackets)
      if (line.includes('**') && !line.includes('***')) {
        // Extract the bold text and make it a proper header
        const boldText = line.replace(/\*\*(.*?)\*\*/g, '$1').trim();
        if (boldText) {
          return (
            <div key={index} className="font-bold text-gray-800 mt-4 mb-2 text-lg border-b border-gray-200 pb-1">
              {boldText}
            </div>
          );
        }
      }
      
      // Check if line contains ***name:*** text (names with colons)
      if (line.includes('***')) {
        // Process the line to make names bold but keep same text size
        const processedLine = line.replace(/\*\*\*(.*?)\*\*\*/g, '<strong>$1</strong>');
        return (
          <div key={index} className="mb-1 mt-2" dangerouslySetInnerHTML={{ __html: processedLine }} />
        );
      }
      
      // Regular text line
      if (line.trim()) {
        return <div key={index} className="mb-1">{line}</div>;
      }
      
      // Empty line for spacing
      return <div key={index} className="h-2"></div>;
    });
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-md">
      <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
        <Calendar className="w-5 h-5" />
        Your Recent Lesson Notes
      </h2>
      
      <div className="border-l-4 border-blue-500 pl-4">
        <div className="text-sm text-gray-500 mb-2">
          {formatDate(notes.lesson_date)}
        </div>
        
        <div className="text-gray-700 space-y-2">
          {notes.attendance === 'Absent' ? (
            <p className="italic text-gray-500">Student was absent</p>
          ) : (
            <div className="whitespace-pre-wrap">
              {formatNotesText(notes.notes)}
            </div>
          )}
        </div>
        
        {notes.attendance && (
          <div className="mt-3 text-sm">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              ✓ {notes.attendance}
            </span>
          </div>
        )}
        
        {notes.tutor_name && (
          <div className="mt-2 text-sm text-gray-600">
            <strong>Tutor:</strong> {notes.tutor_name}
          </div>
        )}
      </div>
      
      <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
        💡 <strong>Remember:</strong> Regular practice makes perfect! Try to practice a little bit every day.
      </div>
    </div>
  );
}