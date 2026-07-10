'use client';

import { useState } from 'react';
import { Calendar, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

function escapeRegExp(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Bold "Name:" speaker markers for known first names only (tutor + student),
// so transcript dialogue scans as dialogue without false-positives on times etc.
function renderWithSpeakers(text, speakerNames = []) {
  const names = speakerNames.filter(Boolean);
  if (names.length === 0 || !text) return text;
  // Boundary allows whitespace or punctuation — dictated notes often run
  // sentences together ("...about it?Arnav: I think...")
  const pattern = new RegExp(`(^|[\\s(?.!,)])(${names.map(escapeRegExp).join('|')})(:)`, 'gi');
  const nodes = [];
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const nameStart = match.index + match[1].length;
    if (nameStart > lastIndex) nodes.push(text.slice(lastIndex, nameStart));
    // Each speaker turn starts on its own line
    if (nameStart > 0) nodes.push(<br key={`br-${nameStart}`} />);
    nodes.push(<strong key={nameStart}>{match[2]}:</strong>);
    lastIndex = nameStart + match[2].length + 1;
  }
  if (nodes.length === 0) return text;
  nodes.push(text.slice(lastIndex));
  return nodes;
}

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

  // First names of the people in the room — used to bold speaker markers
  const speakerNames = [
    (notes.tutor_name || '').split(' ')[0],
    (studentName || '').split(' ')[0],
  ].filter((name) => name && name.length > 1);

  const formatNotesText = (text) => {
    if (!text) return text;

    const lines = text.split('\n');

    return lines.map((line, index) => {
      // Section headers arrive as **bold** lines — render as quiet small-caps
      // labels so the content stays the loudest thing on the card
      if (line.includes('**') && !line.includes('***')) {
        const boldText = line.replace(/\*\*(.*?)\*\*/g, '$1').trim();
        if (boldText) {
          return (
            <div key={index} className="mt-5 mb-1.5 text-xs font-bold uppercase tracking-wider text-amber-700/80 first:mt-0">
              {boldText.replace(/:$/, '')}
            </div>
          );
        }
      }

      // ***name:*** markers: bold the name at body size
      if (line.includes('***')) {
        const parts = line.split(/\*\*\*(.*?)\*\*\*/g);
        return (
          <div key={index} className="mb-1.5 mt-2">
            {parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : renderWithSpeakers(part, speakerNames)))}
          </div>
        );
      }

      // Regular text line
      if (line.trim()) {
        return <div key={index} className="mb-1.5">{renderWithSpeakers(line, speakerNames)}</div>;
      }

      // Empty line for spacing
      return <div key={index} className="h-3"></div>;
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
      
      <div className="max-w-[68ch] text-[17px] leading-relaxed text-gray-800">
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
                      {formatNotesText(entry.notes)}
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
