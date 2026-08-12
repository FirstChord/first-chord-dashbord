import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildGmailRawMessage,
  buildPracticeNoteEmailContent,
  buildPracticeNoteEmailSubject,
} from '../../lib/admin/practice-notes-email-helpers.mjs';
import {
  getPracticeNotesEmailConfig,
} from '../../lib/admin/practice-notes-email.js';

test('buildPracticeNoteEmailSubject includes the student name', () => {
  assert.equal(buildPracticeNoteEmailSubject({ studentName: 'Test Studenty' }), 'Practice notes for Test Studenty');
  assert.equal(buildPracticeNoteEmailSubject(), 'Practice notes');
});

test('buildPracticeNoteEmailContent creates plain text and escaped HTML', () => {
  const content = buildPracticeNoteEmailContent({
    studentName: 'Test Studenty',
    tutorName: 'Finn',
    noteText: '[What we did]\nA <scale> & rhythm.',
  });

  assert.match(content.plain, /Test Studenty's lesson with Finn/u);
  assert.match(content.plain, /A <scale> & rhythm/u);
  assert.match(content.html, /Test Studenty&#39;s lesson with Finn/u);
  assert.match(content.html, /A &lt;scale&gt; &amp; rhythm/u);
});

test('buildPracticeNoteEmailContent gives each section heading its own block', () => {
  const content = buildPracticeNoteEmailContent({
    studentName: 'Test Studenty',
    tutorName: 'Finn',
    noteText: [
      '[What we did]',
      'Scales and Twinkle.',
      '',
      '[Progress & Challenges]',
      'F chord still tricky.',
      '',
      '[Practice Goals]',
      '- Scales daily',
    ].join('\n'),
  });

  // Gmail needs a real block boundary: the heading used to share a <p> with the
  // body, separated only by <br>, which left nothing to put space around.
  assert.match(content.html, /<p style="[^"]*font-weight:bold;">What we did<\/p><p>Scales and Twinkle\.<\/p>/u);
  assert.match(content.html, /<p style="[^"]*font-weight:bold;">Progress &amp; Challenges<\/p>/u);
  assert.match(content.html, /<p style="[^"]*font-weight:bold;">Practice Goals<\/p><ul><li>Scales daily<\/li><\/ul>/u);

  // Styling has to be inline; Gmail discards <style> blocks and <head>.
  assert.equal(/<style|<head/u.test(content.html), false);

  // The brackets are an internal marker, not something a parent should read.
  assert.equal(content.html.includes('[What we did]'), false);
  assert.match(content.plain, /^What we did:$/mu);
  assert.equal(content.plain.includes('[What we did]'), false);
});

test('buildGmailRawMessage returns base64url MIME without leaking newlines in headers', () => {
  const raw = buildGmailRawMessage({
    fromEmail: 'musiclessons@firstchord.co.uk',
    fromName: 'First Chord\nMusic School',
    toEmail: 'parent@example.com',
    subject: 'Practice notes\r\nInjected',
    plainText: 'Plain',
    html: '<p>HTML</p>',
  });
  const decoded = Buffer.from(raw.replace(/-/gu, '+').replace(/_/gu, '/'), 'base64').toString('utf8');

  assert.match(decoded, /From: First Chord Music School <musiclessons@firstchord.co.uk>/u);
  assert.match(decoded, /To: parent@example.com/u);
  assert.match(decoded, /Subject: Practice notes Injected/u);
  assert.match(decoded, /Content-Type: multipart\/alternative/u);
});

test('getPracticeNotesEmailConfig reports missing Gmail configuration', () => {
  const config = getPracticeNotesEmailConfig({});
  assert.deepEqual(config.missing, [
    'GMAIL_CLIENT_ID or GOOGLE_CLIENT_ID',
    'GMAIL_CLIENT_SECRET or GOOGLE_CLIENT_SECRET',
    'GMAIL_REFRESH_TOKEN',
  ]);
});

test('getPracticeNotesEmailConfig can reuse the dashboard Google OAuth client', () => {
  const config = getPracticeNotesEmailConfig({
    GOOGLE_CLIENT_ID: 'google-client',
    GOOGLE_CLIENT_SECRET: 'google-secret',
    GMAIL_REFRESH_TOKEN: 'gmail-refresh',
  });

  assert.equal(config.clientId, 'google-client');
  assert.equal(config.clientSecret, 'google-secret');
  assert.equal(config.refreshToken, 'gmail-refresh');
  assert.deepEqual(config.missing, []);
});
