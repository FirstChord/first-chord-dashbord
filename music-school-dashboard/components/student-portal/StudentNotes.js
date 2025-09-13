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
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  };

  // Clean up HTML from notes for student display
  const cleanNoteText = (htmlText) => {
    if (!htmlText) return '';
    
    // Simple HTML to text conversion for student display
    let text = htmlText
      .replace(/<[^>]+>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
      .replace(/&quot;/g, '"') // Replace quotes
      .replace(/&amp;/g, '&') // Replace ampersands
      .trim();
    
    // Limit length for student display
    if (text.length > 300) {
      text = text.substring(0, 300) + '...';
    }
    
    return text;
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-md">
      <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
        <Calendar className="w-5 h-5" />
        Your Recent Lesson Notes
      </h2>
      
      <div className="border-l-4 border-blue-500 pl-4">
        <div className="text-sm text-gray-500 mb-2">
          {formatDate(notes.date)}
        </div>
        
        <div className="text-gray-700 leading-relaxed">
          {cleanNoteText(notes.text) || 'Great lesson today! Keep practicing! 🎵'}
        </div>
        
        {notes.status && (
          <div className="mt-3 text-sm">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              ✓ {notes.status}
            </span>
          </div>
        )}
      </div>
      
      <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
        💡 <strong>Remember:</strong> Regular practice makes perfect! Try to practice a little bit every day.
      </div>
    </div>
  );
}