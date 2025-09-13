import { Calendar, RefreshCw } from 'lucide-react';

export default function NotesPanel({ notes, source }) {
  if (!notes) return null;
  
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
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
    <div className="bg-yellow-50 p-6 rounded-lg border-2 border-yellow-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-yellow-600" />
          <h3 className="font-semibold text-gray-800">
            Previous Lesson - {formatDate(notes.lesson_date)}
          </h3>
        </div>
        {source === 'cache' && (
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            Cached
          </span>
        )}
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
      
      <p className="text-sm text-gray-500 mt-3">
        by {notes.tutor_name}
        {notes.attendance && (
          <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
            {notes.attendance}
          </span>
        )}
      </p>
    </div>
  );
}
