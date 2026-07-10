import { Calendar } from 'lucide-react';
import { formatNotesText, speakerNamesFor } from '@/components/shared/notes-formatting';

export default function StudentNotes({ notes, notesSuccess, studentName = '' }) {
  if (!notesSuccess || !notes) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-md">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Your Recent Lesson Notes
        </h2>
        <p className="text-gray-600">
          No lesson notes available yet.
        </p>
      </div>
    );
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Recent Lesson';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Recent Lesson';

    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  };

  const speakerNames = speakerNamesFor(notes.tutor_name, studentName);

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

        <div className="max-w-[68ch] text-[17px] leading-relaxed text-gray-800">
          {notes.attendance === 'Absent' ? (
            <p className="italic text-gray-500">Student was absent</p>
          ) : (
            <div className="whitespace-pre-wrap">
              {formatNotesText(notes.notes, speakerNames)}
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
    </div>
  );
}
