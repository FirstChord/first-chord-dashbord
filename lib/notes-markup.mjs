/**
 * @fileoverview The note markup contract shared by every practice-note renderer.
 *
 * Practice Chat lets tutors bold, italicise and bullet their notes. The note
 * itself stays plain text: the PWA serialises its editor to lightweight markers
 * before anything is saved or sent, and every consumer converts those markers on
 * the way out. Nothing downstream ever handles HTML authored by a tutor.
 *
 * The wire format is deliberately small:
 *
 *   **bold**      _italic_      "- " at the start of a line for a bullet
 *
 * Two rules make it safe, and both are load-bearing:
 *
 * 1. **Escape first, convert second.** Markers are ASCII that `escapeHtml` does
 *    not touch, so escaping the text and *then* replacing markers keeps the
 *    existing injection guarantee exactly as it was. Doing it the other way
 *    round would let a tutor's `<script>` through.
 * 2. **Analysers see stripped text.** Song matching and the safety check read
 *    the note as prose, so they must use `stripNoteMarkers`. Song titles are
 *    matched exactly and the safety check looks at word boundaries; a stray
 *    `**` inside either would fail silently rather than loudly.
 *
 * Notes written before this existed contain no markers and pass through
 * unchanged, so renderers can ship ahead of the editor.
 */

const BOLD = /\*\*(?!\s)([^\n*]+?)(?<!\s)\*\*/g;
// Underscores only count as italic at word boundaries, so snake_case and
// mid-word underscores in a dictated note are left alone.
const ITALIC = /(^|[^\w*])_(?!\s)([^\n_]+?)(?<!\s)_(?![\w*])/g;

// The grammar, exported so the portal renderer matches on exactly these rules
// rather than keeping its own copy that has to be remembered about.
// `noteEmphasisPattern()` returns a fresh regex because /g carries lastIndex.
export const BULLET_LINE = /^[ \t]*[-*][ \t]+(.*)$/;

// A section heading is a line wrapped *entirely* in `**`. Matching a line that
// merely contains `**` swallowed inline emphasis into a heading, which is what
// the portal used to do.
export const WHOLE_LINE_HEADING = /^\s*\*\*(?!\s)([^\n*]+?)(?<!\s)\*\*:?\s*$/;

export function noteEmphasisPattern() {
  return new RegExp(`${BOLD.source}|${ITALIC.source}`, 'g');
}

// Strips emphasis only. Bullets keep their "- ", because the two callers that
// need stripped text are the plain-text half of the parent email (where a dash
// list reads exactly as intended) and the note analysers (where a leading dash
// is harmless but a stray ** is not).
export function stripNoteMarkers(value = '') {
  return `${value || ''}`
    .replace(BOLD, '$1')
    .replace(ITALIC, '$1$2');
}

export function inlineMarkersToHtml(escapedLine = '') {
  return `${escapedLine || ''}`
    .replace(BOLD, '<strong>$1</strong>')
    .replace(ITALIC, '$1<em>$2</em>');
}

// One paragraph becomes one <p>, except where consecutive lines are bullets —
// those become a <ul> so the practice goals read as a list rather than a run-on
// paragraph with dashes in it.
function paragraphToHtml(paragraph, escape, renderHeading) {
  const lines = paragraph.split(/\r?\n/u);
  const blocks = [];
  let run = null;

  for (const line of lines) {
    // A whole-line heading becomes its own block rather than being joined into
    // the body with a <br>. Without this the parent email arrived as one
    // paragraph per section — Gmail had no block boundary to put space around,
    // so the heading read as the first line of the text under it.
    if (renderHeading) {
      const heading = line.match(WHOLE_LINE_HEADING);
      if (heading && !line.includes('***')) {
        blocks.push({ type: 'heading', items: [heading[1].replace(/:$/, '')] });
        run = null;
        continue;
      }
    }

    const bullet = line.match(BULLET_LINE);
    if (bullet) {
      if (run?.type !== 'ul') {
        run = { type: 'ul', items: [] };
        blocks.push(run);
      }
      run.items.push(bullet[1]);
      continue;
    }
    if (run?.type !== 'p') {
      run = { type: 'p', items: [] };
      blocks.push(run);
    }
    run.items.push(line);
  }

  return blocks
    .map((block) => {
      if (block.type === 'heading') return renderHeading(escape(block.items[0]));
      const rendered = block.items.map((item) => inlineMarkersToHtml(escape(item)));
      if (block.type === 'ul') {
        return `<ul>${rendered.map((item) => `<li>${item}</li>`).join('')}</ul>`;
      }
      const body = rendered.join('<br>');
      return body.trim() ? `<p>${body}</p>` : '';
    })
    .filter(Boolean)
    .join('');
}

/**
 * Convert a raw note into HTML.
 *
 * `escape` is injected rather than imported so each caller keeps using the
 * escaper its own tests already pin. `join` exists for the same reason: the MMS
 * payload concatenates paragraphs and the email separates them with a newline,
 * and both are pinned by existing assertions.
 *
 * `renderHeading` is opt-in: it takes the escaped heading text and returns the
 * block for it. Callers that omit it keep the previous behaviour exactly, which
 * is why the MMS payload is unaffected — MMS applies its own styling, whereas
 * Gmail renders what it is given and needs the block spacing inline.
 */
export function noteMarkupToHtml(rawNoteText = '', { escape, join = '', renderHeading } = {}) {
  if (typeof escape !== 'function') {
    throw new TypeError('noteMarkupToHtml requires an escape function');
  }

  return `${rawNoteText || ''}`
    .trim()
    .split(/\n{2,}/u)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => paragraphToHtml(paragraph, escape, renderHeading))
    .filter(Boolean)
    .join(join);
}
