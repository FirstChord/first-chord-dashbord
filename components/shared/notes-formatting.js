// Shared lesson-notes formatting for the tutor dashboard (NotesPanel) and the
// student portal (StudentNotes): quiet small-caps section labels, tutor-written
// emphasis, and transcript dialogue laid out as dialogue (known speaker names
// bolded, each turn on its own line). Pure functions — safe in server and client
// components.
//
// The marker grammar itself lives in lib/notes-markup.mjs, which is also what
// the parent email and the MMS note render from. One home: a note has to look
// the same wherever it is read.

import { BULLET_LINE, WHOLE_LINE_HEADING, noteEmphasisPattern } from '@/lib/notes-markup.mjs';

function escapeRegExp(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Bold "Name:" speaker markers for known first names only (tutor + student),
// so transcript dialogue scans as dialogue without false-positives on times
// etc. Boundary allows whitespace or punctuation — dictated notes often run
// sentences together ("...about it?Arnav: I think...").
export function renderWithSpeakers(text, speakerNames = []) {
  const names = speakerNames.filter(Boolean);
  if (names.length === 0 || !text) return text;
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

// First names of the people in the room, for speaker bolding
export function speakerNamesFor(tutorName = '', studentName = '') {
  return [
    (tutorName || '').split(' ')[0],
    (studentName || '').split(' ')[0],
  ].filter((name) => name && name.length > 1);
}

function renderInline(text, speakerNames = [], keyPrefix = '') {
  if (!text) return text;

  const nodes = [];
  let lastIndex = 0;
  let match;
  // Fresh regex per call: the shared /g literal carries lastIndex state.
  const emphasis = noteEmphasisPattern();

  while ((match = emphasis.exec(text)) !== null) {
    const [full, boldInner, italicLead, italicInner] = match;
    if (match.index > lastIndex) {
      nodes.push(renderWithSpeakers(text.slice(lastIndex, match.index), speakerNames));
    }
    if (boldInner !== undefined) {
      nodes.push(<strong key={`${keyPrefix}b${match.index}`}>{renderWithSpeakers(boldInner, speakerNames)}</strong>);
    } else {
      if (italicLead) nodes.push(italicLead);
      nodes.push(<em key={`${keyPrefix}i${match.index}`}>{renderWithSpeakers(italicInner, speakerNames)}</em>);
    }
    lastIndex = match.index + full.length;
  }

  if (!nodes.length) return renderWithSpeakers(text, speakerNames);
  if (lastIndex < text.length) nodes.push(renderWithSpeakers(text.slice(lastIndex), speakerNames));
  return nodes;
}

export function formatNotesText(text, speakerNames = []) {
  if (!text) return text;

  const lines = text.split('\n');
  const output = [];
  // Consecutive bullet lines collapse into one list rather than becoming a run
  // of paragraphs that happen to start with a dash.
  let bulletRun = null;

  const flushBullets = () => {
    if (!bulletRun) return;
    output.push(
      <ul key={`ul-${bulletRun.index}`} className="mb-1.5 ml-5 list-disc space-y-1">
        {bulletRun.items.map((item, i) => (
          <li key={i}>{renderInline(item, speakerNames, `${bulletRun.index}-${i}-`)}</li>
        ))}
      </ul>,
    );
    bulletRun = null;
  };

  lines.forEach((line, index) => {
    const bullet = line.match(BULLET_LINE);
    if (bullet) {
      if (!bulletRun) bulletRun = { index, items: [] };
      bulletRun.items.push(bullet[1]);
      return;
    }
    flushBullets();

    // Section headers arrive as **bold** lines — render as quiet small-caps
    // labels so the content stays the loudest thing on the card
    const heading = line.match(WHOLE_LINE_HEADING);
    if (heading && !line.includes('***')) {
      output.push(
        <div key={index} className="mt-5 mb-1.5 text-xs font-bold uppercase tracking-wider text-amber-700/80 first:mt-0">
          {heading[1].replace(/:$/, '')}
        </div>,
      );
      return;
    }

    // ***name:*** markers: bold the name at body size
    if (line.includes('***')) {
      const parts = line.split(/\*\*\*(.*?)\*\*\*/g);
      output.push(
        <div key={index} className="mb-1.5 mt-2">
          {parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : renderWithSpeakers(part, speakerNames)))}
        </div>,
      );
      return;
    }

    // Regular text line
    if (line.trim()) {
      output.push(<div key={index} className="mb-1.5">{renderInline(line, speakerNames, `${index}-`)}</div>);
      return;
    }

    // Empty line for spacing
    output.push(<div key={index} className="h-3"></div>);
  });

  flushBullets();
  return output;
}
