import {
  executePracticeNoteMmsTestWrite,
  previewPracticeNoteMmsTestWrite,
} from '@/lib/admin/mms';
import {
  isPracticeNotesLevel2PilotStudent,
  normalisePracticeNoteAttendanceStatus,
} from '@/lib/admin/practice-notes-mms-helpers.mjs';
import {
  buildPracticeNoteDeliveryKey,
  findPracticeNoteDeliveryRecord,
  isPracticeNoteDeliveryEmailSent,
  isPracticeNoteDeliveryInProgress,
  normalisePracticeNotePayload,
} from '@/lib/admin/practice-notes-helpers.mjs';
import { assertPracticeNotesEmailConfigured, sendPracticeNoteEmail } from '@/lib/admin/practice-notes-email';
import { getPracticeNoteLogRows, upsertPracticeNoteLogRow } from '@/lib/admin/sheets';
import { authenticatePracticeChatRequest, corsHeaders } from '@/lib/admin/practice-chat-auth.mjs';
import { getAdminStudentByMmsId } from '@/lib/admin/students';

export async function OPTIONS(request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request.headers.get('origin') || ''),
  });
}

export async function POST(request) {
  const origin = request.headers.get('origin') || '';
  const headers = corsHeaders(origin);
  const auth = authenticatePracticeChatRequest(request);

  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers });
  }

  try {
    const body = await request.json();
    const studentId = `${body.studentMmsId || body.studentId || ''}`.trim();
    const noteText = `${body.rawNoteText || body.noteText || ''}`.trim();
    const mode = body.mode === 'execute' ? 'execute' : 'dry_run';
    const targetAttendanceId = `${body.targetAttendanceId || ''}`.trim();
    const attendanceStatus = normalisePracticeNoteAttendanceStatus(body.attendanceStatus);
    const isAbsentNoMakeup = attendanceStatus === 'AbsentNoMakeup';
    const effectiveNoteText = noteText || (isAbsentNoMakeup
      ? 'Student marked absent with no makeup from Practice Chat. No practice note email sent.'
      : '');

    const pilotStudent = await getAdminStudentByMmsId(studentId);
    if (!pilotStudent) {
      return Response.json({
        error: 'Student was not found in the dashboard Students sheet.',
      }, { status: 404, headers });
    }

    const isPilotStudent = isPracticeNotesLevel2PilotStudent(pilotStudent);

    if (!isPilotStudent) {
      return Response.json({
        error: 'Practice Chat Level 2 is currently limited to Finn, Tom, and Fennella pilot students.',
        pilotTutors: ['Finn', 'Tom', 'Fennella'],
      }, { status: 403, headers });
    }

    if (!effectiveNoteText) {
      return Response.json({ error: 'noteText is required' }, { status: 400, headers });
    }

    if (mode === 'execute' && body.confirmLevel2Pilot !== true && body.confirmTestStudent !== true) {
      return Response.json({
        error: 'confirmLevel2Pilot must be true to write attendance in MMS and send the First Chord lesson-note email.',
      }, { status: 400, headers });
    }

    const preview = await previewPracticeNoteMmsTestWrite({
      studentId,
      noteText: effectiveNoteText,
      targetAttendanceId,
      attendanceStatus,
    });

    if (mode !== 'execute') {
      return Response.json({
        success: true,
        mode,
        practiceNoteLog: null,
        ...preview,
      }, { headers });
    }

    const target = preview.targetAttendance || {};
    const selection = preview.targetSelection || {};
    const recipient = preview.recipients?.[0] || {};
    const snapshot = body.noteSnapshot || {};
    const deliveryKey = buildPracticeNoteDeliveryKey({
      studentMmsId: studentId,
      mmsAttendanceId: target.attendanceId || targetAttendanceId,
      rawNoteText: effectiveNoteText,
    });
    const existingRows = await getPracticeNoteLogRows(studentId);
    const existingDelivery = findPracticeNoteDeliveryRecord(existingRows, deliveryKey);
    const noteCreatedAt = existingDelivery?.createdAt || snapshot.createdAt || new Date().toISOString();
    const baseNotePayload = {
      ...snapshot,
      noteId: existingDelivery?.noteId || snapshot.noteId || '',
      deliveryKey,
      studentMmsId: studentId,
      studentName: preview.student?.name || snapshot.studentName || '',
      tutorName: target.teacherName || snapshot.tutorName || snapshot.tutor || '',
      lessonDate: target.eventStartDate || snapshot.lessonDate || '',
      rawNoteText: effectiveNoteText,
      copiedToClipboard: false,
      attendanceStepOpened: true,
      mmsEventId: target.eventId || '',
      mmsAttendanceId: target.attendanceId || targetAttendanceId,
      mmsAttendanceStatus: existingDelivery?.mmsAttendanceStatus || attendanceStatus,
      targetSelectionReason: selection.reason || '',
      targetSelectionLabel: selection.label || '',
      recipientProfileId: recipient.recipientProfileId || existingDelivery?.recipientProfileId || '',
      recipientName: recipient.name || existingDelivery?.recipientName || '',
      recipientEmail: recipient.email || existingDelivery?.recipientEmail || '',
      emailChannel: existingDelivery?.emailChannel || 'gmail',
      source: 'practice_chat_pwa_level_2_test',
      createdAt: noteCreatedAt,
      userAgent: request.headers.get('user-agent') || snapshot.userAgent || '',
    };

    const alreadyCompleted = isAbsentNoMakeup
      ? existingDelivery?.mmsAttendanceSaved && existingDelivery?.mmsAttendanceStatus === 'AbsentNoMakeup'
      : existingDelivery && isPracticeNoteDeliveryEmailSent(existingDelivery);

    if (existingDelivery && alreadyCompleted) {
      return Response.json({
        success: true,
        mode,
        duplicateSkipped: true,
        idempotency: {
          status: 'already_completed',
          deliveryKey,
          message: isAbsentNoMakeup
            ? 'This selected lesson has already been marked absent with no makeup.'
            : 'This exact note has already been emailed for the selected lesson.',
        },
        practiceNoteLog: {
          ok: true,
          skipped: true,
          reason: 'already_completed',
          deliveryKey,
          noteId: existingDelivery.noteId,
          existing: existingDelivery,
        },
        ...preview,
        dryRun: false,
        attendanceSave: {
          ok: true,
          skipped: true,
          reason: 'already_saved_for_delivery_key',
        },
        practiceNoteEmail: {
          ok: true,
          skipped: true,
          channel: isAbsentNoMakeup ? 'none' : existingDelivery.emailChannel || 'gmail',
          reason: isAbsentNoMakeup ? 'student_absent_no_makeup' : '',
          toEmail: existingDelivery.recipientEmail || '',
          gmailMessageId: existingDelivery.gmailMessageId || '',
          gmailThreadId: existingDelivery.gmailThreadId || '',
          sentAt: existingDelivery.emailSentAt || '',
        },
        emailNotes: {
          ok: true,
          skipped: true,
          channel: isAbsentNoMakeup ? 'none' : existingDelivery.emailChannel || 'gmail',
          reason: isAbsentNoMakeup ? 'student_absent_no_makeup' : '',
          toEmail: existingDelivery.recipientEmail || '',
          gmailMessageId: existingDelivery.gmailMessageId || '',
          gmailThreadId: existingDelivery.gmailThreadId || '',
          sentAt: existingDelivery.emailSentAt || '',
        },
        partialSuccess: false,
      }, { headers });
    }

    if (existingDelivery && isPracticeNoteDeliveryInProgress(existingDelivery)) {
      return Response.json({
        success: true,
        mode,
        inProgress: true,
        idempotency: {
          status: 'in_progress',
          deliveryKey,
          message: 'This lesson note delivery is already being processed.',
        },
        practiceNoteLog: {
          ok: true,
          skipped: true,
          reason: 'in_progress',
          deliveryKey,
          noteId: existingDelivery.noteId,
          existing: existingDelivery,
        },
        ...preview,
        dryRun: false,
      }, { headers });
    }

    const claimNote = normalisePracticeNotePayload({
      ...baseNotePayload,
      mmsAttendanceSaved: Boolean(existingDelivery?.mmsAttendanceSaved),
      emailSendStatus: existingDelivery?.emailSendStatus || '',
      emailSentAt: existingDelivery?.emailSentAt || '',
      gmailMessageId: existingDelivery?.gmailMessageId || '',
      gmailThreadId: existingDelivery?.gmailThreadId || '',
      emailError: existingDelivery?.emailError || '',
      manualFollowUpNeeded: Boolean(existingDelivery?.manualFollowUpNeeded),
      operationStatus: existingDelivery?.mmsAttendanceSaved ? 'retrying_email' : 'in_progress',
      completedAt: existingDelivery?.completedAt || '',
    });

    if (claimNote.errors.length) {
      return Response.json({ error: claimNote.errors.join(', ') }, { status: 400, headers });
    }

    let practiceNoteLog = null;
    try {
      const claimResult = await upsertPracticeNoteLogRow(claimNote);
      practiceNoteLog = {
        ok: !claimResult?.error,
        ...claimResult,
      };
    } catch (error) {
      practiceNoteLog = {
        ok: false,
        error: error.message || 'Practice note delivery claim save failed',
      };
    }

    const result = existingDelivery?.mmsAttendanceSaved
      ? await executePracticeNoteEmailRetry({
          preview,
          noteText: effectiveNoteText,
          existingDelivery,
        })
      : await executePracticeNoteMmsTestWrite({
          studentId,
          noteText: effectiveNoteText,
          targetAttendanceId,
          attendanceStatus,
        });

    const email = result.practiceNoteEmail || result.emailNotes || {};
    const completedAt = new Date().toISOString();
    const finalNote = normalisePracticeNotePayload({
      ...baseNotePayload,
      recipientEmail: recipient.email || email.toEmail || existingDelivery?.recipientEmail || '',
      emailChannel: isAbsentNoMakeup ? 'none' : email.channel || 'gmail',
      emailSendStatus: isAbsentNoMakeup ? 'not_sent_absent' : email.ok === false ? 'failed' : 'sent',
      emailSentAt: isAbsentNoMakeup || email.ok === false ? '' : completedAt,
      gmailMessageId: email.gmailMessageId || '',
      gmailThreadId: email.gmailThreadId || '',
      emailError: email.error || '',
      manualFollowUpNeeded: email.ok === false,
      mmsAttendanceSaved: Boolean(result.attendanceSave?.ok || existingDelivery?.mmsAttendanceSaved),
      mmsAttendanceStatus: attendanceStatus,
      operationStatus: isAbsentNoMakeup ? 'attendance_only_completed' : email.ok === false ? 'email_failed' : 'completed',
      completedAt: email.ok === false ? '' : completedAt,
    });

    try {
      const logResult = finalNote.errors.length
        ? { ok: false, error: finalNote.errors.join(', ') }
        : await upsertPracticeNoteLogRow(finalNote);
      practiceNoteLog = {
        ok: !logResult?.error,
        ...logResult,
      };
    } catch (error) {
      practiceNoteLog = {
        ok: false,
        error: error.message || 'Practice note log save failed',
      };
    }

    return Response.json({
      success: true,
      mode,
      idempotency: {
        status: existingDelivery?.mmsAttendanceSaved ? 'retried_email_only' : 'processed',
        deliveryKey,
      },
      practiceNoteLog,
      ...result,
    }, { headers });
  } catch (error) {
    return Response.json({
      error: error.message || 'MMS Practice Notes test failed',
    }, { status: 500, headers });
  }
}

async function executePracticeNoteEmailRetry({
  preview,
  noteText,
  existingDelivery,
} = {}) {
  const emailConfig = assertPracticeNotesEmailConfigured();
  const targetAttendance = preview.targetAttendance || {};
  let practiceNoteEmail;

  try {
    practiceNoteEmail = await sendPracticeNoteEmail({
      recipient: preview.recipients?.[0] || {},
      studentName: preview.student?.name || existingDelivery?.studentName || '',
      tutorName: targetAttendance.teacherName || existingDelivery?.tutorName || '',
      noteText,
      config: emailConfig,
    });
  } catch (error) {
    practiceNoteEmail = {
      ok: false,
      channel: 'gmail',
      toEmail: preview.recipients?.[0]?.email || existingDelivery?.recipientEmail || '',
      fromEmail: emailConfig.fromEmail,
      error: error.message || 'Practice note email failed.',
    };
  }

  return {
    ...preview,
    dryRun: false,
    attendanceSave: {
      ok: true,
      skipped: true,
      reason: 'already_saved_for_delivery_key',
    },
    practiceNoteEmail,
    emailNotes: practiceNoteEmail,
    partialSuccess: practiceNoteEmail.ok === false,
  };
}
