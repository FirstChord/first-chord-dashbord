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
