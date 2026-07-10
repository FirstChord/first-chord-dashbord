'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

import { formatNotesText, speakerNamesFor } from '@/components/shared/notes-formatting';

export default function NotesPanel({ notes, source, studentName = '', onLoadHistory }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  if (!notes) return null;

  const toggleHistory = async () => {
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    setHistoryOpen(true);
    if (history === null && onLoadHistory) {
      setHistoryLoading(true);
      try {
        const entries = await onLoadHistory();
        setHistory(Array.isArray(entries) ? entries : []);
      } catch {
        setHistory([]);
      } finally {
        setHistoryLoading(false);
      }
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const speakerNames = speakerNamesFor(notes.tutor_name, studentName);


  return (
    <div className="bg-yellow-50 p-6 rounded-lg border-2 border-[#2F6B3D]/35">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800">
          Previous Lesson - {formatDate(notes.lesson_date)}
        </h3>
        {source === 'cache' && (
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            Cached
          </span>
        )}
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
      
      <p className="text-sm text-gray-500 mt-3">
        by {notes.tutor_name}
        {notes.attendance && (
          <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
            {notes.attendance}
          </span>
        )}
      </p>

      {onLoadHistory && (
        <div className="mt-4 border-t border-yellow-200 pt-3">
          <button
            type="button"
            onClick={toggleHistory}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-yellow-800/80 transition-colors hover:text-yellow-900"
          >
            {historyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {historyOpen ? 'Hide earlier lessons' : 'Show earlier lessons'}
          </button>

          {historyOpen && (
            <div className="mt-3 space-y-3">
              {historyLoading && (
                <div className="rounded-lg bg-yellow-100/60 p-4 animate-pulse">
                  <div className="h-3 w-1/3 rounded bg-yellow-200 mb-2" />
                  <div className="h-3 w-full rounded bg-yellow-200 mb-1" />
                  <div className="h-3 w-4/5 rounded bg-yellow-200" />
                </div>
              )}
              {!historyLoading && history && history.filter((entry) => entry.lesson_date !== notes.lesson_date).length === 0 && (
                <p className="text-sm italic text-gray-500">No earlier notes found.</p>
              )}
              {!historyLoading && history && history
                .filter((entry) => entry.lesson_date !== notes.lesson_date)
                .map((entry) => (
                  <div key={entry.lesson_date} className="rounded-lg border border-yellow-200/70 bg-white/60 p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-700">{formatDate(entry.lesson_date)}</span>
                      {entry.attendance && (
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{entry.attendance}</span>
                      )}
                    </div>
                    <div className="max-w-[68ch] whitespace-pre-wrap text-[15px] leading-relaxed text-gray-700">
                      {formatNotesText(entry.notes, speakerNames)}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
