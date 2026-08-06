import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BULLET_LINE,
  WHOLE_LINE_HEADING,
  inlineMarkersToHtml,
  noteEmphasisPattern,
  noteMarkupToHtml,
  stripNoteMarkers,
} from '../lib/notes-markup.mjs';
import { parsePracticeNoteSections } from '../lib/admin/practice-notes-helpers.mjs';
import { buildPracticeNoteEmailContent } from '../lib/admin/practice-notes-email-helpers.mjs';
import { formatPracticeNoteHtml } from '../lib/admin/practice-notes-mms-helpers.mjs';

function escapeHtml(value = '') {
  return `${value || ''}`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const html = (text) => noteMarkupToHtml(text, { escape: escapeHtml });

test('emphasis markers become real HTML', () => {
  assert.equal(html('Play **slowly** and _listen_.'), '<p>Play <strong>slowly</strong> and <em>listen</em>.</p>');
});

test('a tutor cannot inject HTML through a marker', () => {
  // The guarantee that matters: escaping runs first, so the only tags in the
  // output are the ones this module put there.
  assert.equal(
    html('Try **<script>alert(1)</script>** today'),
    '<p>Try <strong>&lt;script&gt;alert(1)&lt;/script&gt;</strong> today</p>',
  );
  assert.equal(html('_<img onerror=x>_'), '<p><em>&lt;img onerror=x&gt;</em></p>');
});

test('consecutive bullet lines become one list', () => {
  assert.equal(
    html('This week:\n- Five minutes of scales\n- First eight bars'),
    '<p>This week:</p><ul><li>Five minutes of scales</li><li>First eight bars</li></ul>',
  );
});

test('bullets carry emphasis and stay escaped', () => {
  assert.equal(
    html('- **Scales** & arpeggios'),
    '<ul><li><strong>Scales</strong> &amp; arpeggios</li></ul>',
  );
});

test('underscores inside words are left alone', () => {
  // Dictated notes and file-ish names should not become italic by accident.
  assert.equal(html('The file lesson_plan_v2 is ready'), '<p>The file lesson_plan_v2 is ready</p>');
});

test('unmarked notes render exactly as they did before markers existed', () => {
  assert.equal(
    formatPracticeNoteHtml('[What we did]\nA <scale> & rhythm.\n\n[Practice Goals]\nPlay "slowly".'),
    '<p>[What we did]<br>A &lt;scale&gt; &amp; rhythm.</p><p>[Practice Goals]<br>Play &quot;slowly&quot;.</p>',
  );
});

test('stripNoteMarkers removes emphasis but keeps bullets readable', () => {
  assert.equal(
    stripNoteMarkers('- Practise **Clocks** _slowly_'),
    '- Practise Clocks slowly',
  );
});

test('stripped text leaves song titles exactly matchable', () => {
  // Song suggestion matches titles exactly, so a bolded title must strip back to
  // the bare title or the suggestion silently disappears.
  assert.ok(stripNoteMarkers('We started **Clocks** today').includes('Clocks'));
  assert.ok(!stripNoteMarkers('We started **Clocks** today').includes('*'));
});

test('the plain-text half of the email carries no markers', () => {
  const { plain, html: htmlBody } = buildPracticeNoteEmailContent({
    studentName: 'Ayla',
    tutorName: 'Dean',
    noteText: 'Play **slowly** and _listen_.',
  });

  assert.ok(!plain.includes('**'));
  assert.ok(!plain.includes('_listen_'));
  assert.ok(plain.includes('Play slowly and listen.'));
  assert.ok(htmlBody.includes('<strong>slowly</strong>'));
});

test('section parsing is unaffected by emphasis inside a section', () => {
  const sections = parsePracticeNoteSections(
    '[What we did]\nStarted **Clocks**.\n\n[Progress & Challenges]\nThe _F to G_ change.\n\n[Practice Goals]\n- Scales',
  );

  assert.equal(sections.whatWeDid, 'Started **Clocks**.');
  assert.equal(sections.progressChallenges, 'The _F to G_ change.');
  assert.equal(sections.practiceGoals, '- Scales');
});

test('a section heading is a whole wrapped line, never a line that merely contains **', () => {
  // The portal used to promote any line containing ** to a small-caps heading,
  // which swallowed a whole sentence when a tutor emphasised a phrase in it.
  assert.ok(WHOLE_LINE_HEADING.test('**What we did:**'));
  assert.ok(WHOLE_LINE_HEADING.test('  **Practice Goals**  '));
  assert.equal(WHOLE_LINE_HEADING.test('Play the **F to G** change slowly'), false);
  assert.equal(WHOLE_LINE_HEADING.test('- **Scales** daily'), false);
});

test('the emphasis pattern is fresh each call', () => {
  // A shared /g literal carries lastIndex, so a second render would start
  // mid-string and silently drop the first emphasis on the line.
  const line = 'a **one** b **two**';
  const first = [...line.matchAll(noteEmphasisPattern())].length;
  const second = [...line.matchAll(noteEmphasisPattern())].length;
  assert.equal(first, 2);
  assert.equal(second, 2);
});

test('bullet detection captures the item text', () => {
  assert.equal('- Five minutes'.match(BULLET_LINE)[1], 'Five minutes');
  assert.equal(BULLET_LINE.test('Not a bullet'), false);
  assert.equal(BULLET_LINE.test('-nospace'), false);
});

test('inlineMarkersToHtml is a pure string transform', () => {
  assert.equal(inlineMarkersToHtml('a **b** c'), 'a <strong>b</strong> c');
  assert.equal(inlineMarkersToHtml('nothing here'), 'nothing here');
});
