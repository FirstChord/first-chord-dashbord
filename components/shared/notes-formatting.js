// Shared lesson-notes formatting for the tutor dashboard (NotesPanel) and the
// student portal (StudentNotes): quiet small-caps section labels, and
// transcript dialogue laid out as dialogue (known speaker names bolded, each
// turn on its own line). Pure functions — safe in server and client components.

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

export function formatNotesText(text, speakerNames = []) {
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
}
