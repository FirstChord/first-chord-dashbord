import {
  executePracticeNoteMmsTestWrite,
  previewPracticeNoteMmsTestWrite,
} from '@/lib/admin/mms';
import { TEST_PRACTICE_NOTES_STUDENT_ID } from '@/lib/admin/practice-notes-mms-helpers.mjs';

const ALLOWED_ORIGINS = new Set([
  'https://practice-chat-pwa.web.app',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

function corsHeaders(origin = '') {
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : 'https://practice-chat-pwa.web.app';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

export async function OPTIONS(request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request.headers.get('origin') || ''),
  });
}

export async function POST(request) {
  const origin = request.headers.get('origin') || '';
  const headers = corsHeaders(origin);

  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return Response.json({ error: 'Origin not allowed' }, { status: 403, headers });
  }

  try {
    const body = await request.json();
    const studentId = `${body.studentMmsId || body.studentId || ''}`.trim();
    const noteText = `${body.rawNoteText || body.noteText || ''}`.trim();
    const mode = body.mode === 'execute' ? 'execute' : 'dry_run';

    if (studentId !== TEST_PRACTICE_NOTES_STUDENT_ID) {
      return Response.json({
        error: 'This test route only supports Test Studenty.',
        allowedStudentId: TEST_PRACTICE_NOTES_STUDENT_ID,
      }, { status: 403, headers });
    }

    if (!noteText) {
      return Response.json({ error: 'noteText is required' }, { status: 400, headers });
    }

    if (mode === 'execute' && body.confirmTestStudent !== true) {
      return Response.json({
        error: 'confirmTestStudent must be true to write/email Test Studenty in MMS.',
      }, { status: 400, headers });
    }

    const result = mode === 'execute'
      ? await executePracticeNoteMmsTestWrite({ studentId, noteText })
      : await previewPracticeNoteMmsTestWrite({ studentId, noteText });

    return Response.json({
      success: true,
      mode,
      ...result,
    }, { headers });
  } catch (error) {
    return Response.json({
      error: error.message || 'MMS Practice Notes test failed',
    }, { status: 500, headers });
  }
}
