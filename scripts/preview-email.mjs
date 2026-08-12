/**
 * Render a parent practice-note email so a human can look at it.
 *
 * This exists because of a fault that shipped for months behind 1,284 passing
 * tests: every assertion on the email path checked that content was *present*
 * and correctly escaped, and none checked that it was *arranged*. Section
 * headings were being emitted inside the body paragraph, so Gmail had no block
 * boundary to space around and the note arrived as a wall of text. Escaping
 * assertions cannot see layout, and no reasonable number of them would have.
 *
 * The only previous way to see a real parent email was to send one to a real
 * family. This prints both MIME alternatives instead, and can write an HTML file
 * to open in a browser.
 *
 *   npm run preview:email
 *   npm run preview:email -- --note path/to/note.txt
 *   npm run preview:email -- --open
 *
 * It sends nothing and touches no provider.
 */
import { writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  buildPracticeNoteEmailContent,
  buildPracticeNoteEmailSubject,
} from '../lib/admin/practice-notes-email-helpers.mjs';

// Deliberately exercises the awkward cases rather than a tidy note: both heading
// layouts Practice Chat produces, a bullet list, inline emphasis, and characters
// that must survive escaping.
const SAMPLE_NOTE = [
  '[What we did]',
  'Warmed up with the C major scale, then worked through **Twinkle Twinkle**.',
  'Sarah & I also looked at <rest> symbols.',
  '',
  '[Progress & Challenges]',
  'Timing is much better this week. The F chord is still tricky — the _third finger_ keeps muting the top string.',
  '',
  '[Practice Goals]',
  '- C major scale, slowly, 5 minutes a day',
  '- F chord changes: count 4 beats between each',
  '- Listen to the backing track once before playing',
].join('\n');

function parseArgs(argv) {
  const args = { open: false, notePath: '' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--open') args.open = true;
    if (argv[i] === '--note') args.notePath = argv[i + 1] || '';
  }
  return args;
}

const { open, notePath } = parseArgs(process.argv.slice(2));

const noteText = notePath
  ? await readFile(path.resolve(notePath), 'utf8')
  : SAMPLE_NOTE;

const studentName = 'Ava Mitchell';
const tutorName = 'Finn';

const subject = buildPracticeNoteEmailSubject({ studentName });
const { plain, html } = buildPracticeNoteEmailContent({ studentName, tutorName, noteText });

const rule = (label) => `\n${'─'.repeat(72)}\n${label}\n${'─'.repeat(72)}`;

console.log(rule(`SUBJECT  ${subject}`));
console.log(`\nSource: ${notePath || 'built-in sample note'}`);
console.log(rule('TEXT/PLAIN  — what a plain-text client shows'));
console.log(plain);
console.log(rule('TEXT/HTML  — what Gmail renders'));
console.log(html);

// Gmail strips <style> blocks and <head>, so a stylesheet here would silently do
// nothing. Anything that must survive has to be an inline style attribute.
const inlineStyled = (html.match(/style="/g) || []).length;
const hasStyleBlock = /<style|<head/i.test(html);
console.log(rule('CHECKS'));
console.log(`  inline style attributes : ${inlineStyled}`);
console.log(`  <style>/<head> present  : ${hasStyleBlock ? 'YES — Gmail will discard these' : 'no'}`);
console.log(`  raw [brackets] left in  : ${/\[[^\]]+\]/.test(html) ? 'YES — parents should not see these' : 'no'}`);

if (open) {
  // Wrapped in a body width close to Gmail's reading column, so the preview is
  // representative rather than full-window.
  const page = `<!doctype html><meta charset="utf-8"><title>${subject}</title>` +
    '<body style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;' +
    'color:#202124;max-width:640px;margin:32px auto;padding:0 16px;">' +
    `${html}</body>`;
  const out = path.join(os.tmpdir(), 'firstchord-practice-note-preview.html');
  writeFileSync(out, page, 'utf8');
  console.log(`\n  Wrote ${out}`);
  console.log('  Open it with:  open ' + out);
}

console.log('');
