import { NextResponse } from 'next/server';
import { getStudentPortalAccessRow } from '@/lib/admin/sheets';
import {
  assertStudentNotesSecretConfigured,
  createStudentNotesSession,
  studentNotesCookieName,
  verifyStudentNotesCode,
} from '@/lib/admin/student-notes-access-crypto.mjs';
import { isValidStudentId } from '@/lib/student-helpers';
import {
  clearNotesUnlockFailures,
  clientKeyFromRequest,
  notesUnlockRateLimitState,
  recordNotesUnlockFailure,
} from '@/lib/student-notes-rate-limit.mjs';

const COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

function noStoreJson(body, init = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...(init.headers || {}),
      'Cache-Control': 'private, no-store',
    },
  });
}

export async function POST(request, { params }) {
  const { studentId } = await params;
  if (!isValidStudentId(studentId)) {
    return noStoreJson({ error: 'Unable to unlock notes' }, { status: 404 });
  }
  const clientKey = clientKeyFromRequest(request);
  const rateState = notesUnlockRateLimitState({ studentMmsId: studentId, clientKey });
  if (!rateState.allowed) {
    return noStoreJson(
      { error: 'Too many attempts. Please wait before trying again.' },
      { status: 429, headers: { 'Retry-After': String(rateState.retryAfterSeconds) } },
    );
  }

  let access;
  try {
    assertStudentNotesSecretConfigured();
    access = await getStudentPortalAccessRow(studentId, {
      requireConfigured: true,
      forceRefresh: true,
    });
  } catch {
    return noStoreJson({ error: 'Notes are temporarily unavailable. Please try again shortly.' }, { status: 503 });
  }
  if (!access?.protectionEnabled || !access.activeCodeSalt || !access.activeCodeVerifier) {
    return noStoreJson({ error: 'Unable to unlock notes' }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const valid = verifyStudentNotesCode(body.code, {
    salt: access.activeCodeSalt,
    verifier: access.activeCodeVerifier,
  });
  if (!valid) {
    const nextRateState = recordNotesUnlockFailure({ studentMmsId: studentId, clientKey });
    return noStoreJson(
      {
        error: nextRateState.allowed
          ? 'That code was not recognised. Check the WhatsApp group description and try again.'
          : 'Too many attempts. Please wait before trying again.',
      },
      nextRateState.allowed
        ? { status: 401 }
        : { status: 429, headers: { 'Retry-After': String(nextRateState.retryAfterSeconds) } },
    );
  }

  clearNotesUnlockFailures({ studentMmsId: studentId, clientKey });
  const response = noStoreJson({ success: true });
  response.cookies.set({
    name: studentNotesCookieName(studentId),
    value: createStudentNotesSession({
      studentMmsId: studentId,
      credentialVersion: access.credentialVersion,
    }),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
  return response;
}

export async function DELETE(_request, { params }) {
  const { studentId } = await params;
  const response = noStoreJson({ success: true });
  response.cookies.set({
    name: studentNotesCookieName(studentId),
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
