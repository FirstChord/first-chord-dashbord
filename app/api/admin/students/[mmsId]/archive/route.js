import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import { buildPaymentFieldChangeEvent } from '@/lib/admin/payment-audit-helpers.mjs';
import { deleteRegistryEntry } from '@/lib/admin/registry';
import {
  buildStudentArchiveEvent,
  buildStudentExitStepEvent,
  buildStudentLeftEvent,
  formatLeftMonthLabel,
  normaliseLeftMonth,
  normaliseStudentArchiveNote,
} from '@/lib/admin/student-archive-helpers.mjs';
import { getAdminStudentByMmsId, updateAdminStudent } from '@/lib/admin/students';
import { markStudentInactive } from '@/lib/admin/mms';
import { appendEventLogRows, archiveAndDeleteStudentSheetRow } from '@/lib/admin/sheets';

const VALID_ACTIONS = new Set([
  'mark_left',
  'mark_inactive_expectation',
  'delete_registry_entry',
  'mark_mms_inactive',
  'archive_students_sheet_row',
]);

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  const { mmsId } = await params;

  if (!session?.user?.isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const action = payload.action || 'mark_inactive_expectation';
  const note = normaliseStudentArchiveNote(payload.note);

  if (!VALID_ACTIONS.has(action)) {
    return Response.json({ error: 'Unsupported archive action.' }, { status: 400 });
  }

  // The combined "mark left" action uses the chosen month/year as its record, so it
  // doesn't require a free-text note; the individual steps still do.
  if (!note && action !== 'mark_left') {
    return Response.json({ error: 'A short note is required for student exit actions.' }, { status: 400 });
  }

  try {
    const previousStudent = await getAdminStudentByMmsId(mmsId);
    if (!previousStudent) {
      return Response.json({ error: 'Student not found in Sheets' }, { status: 404 });
    }

    if (action === 'mark_left') {
      const leftMonth = normaliseLeftMonth(payload.leftMonth);
      if (!leftMonth) {
        return Response.json({ error: 'Pick the month and year the student left.' }, { status: 400 });
      }
      const now = new Date().toISOString();
      const actorEmail = session.user.email || '';
      const exitNote = note || `Left ${formatLeftMonthLabel(leftMonth)}`;
      const steps = {};

      // Run in order; each part is idempotent so a retry after a mid-failure resumes.
      // The archive (which removes the active row) is last and only runs if the prior
      // steps succeeded — so a failure leaves the page loadable for a clean retry.
      if (previousStudent.paymentExpectation !== 'inactive_or_stopped') {
        await updateAdminStudent({ mmsId, sheetsUpdates: { payment_expectation: 'inactive_or_stopped' } });
        steps.inactiveMarked = true;
      }
      if (previousStudent.registry) {
        await deleteRegistryEntry(mmsId);
        steps.registryDeleted = true;
      }
      const mmsResult = await markStudentInactive({ studentId: mmsId });
      steps.mmsInactive = !mmsResult?.skipped;
      steps.mmsAlreadyInactive = Boolean(mmsResult?.alreadyInactive);

      const archiveResult = await archiveAndDeleteStudentSheetRow({
        mmsId,
        archivedAt: now,
        archivedBy: actorEmail,
        archiveNote: exitNote,
        dateLeft: leftMonth,
      });
      steps.sheetArchived = true;

      await appendEventLogRows([
        buildStudentLeftEvent({ student: previousStudent, actorEmail, occurredAt: now, leftMonth, note: exitNote, steps }),
      ]);

      return Response.json({
        success: true,
        student: null,
        audit: {
          left: true,
          leftMonth,
          leftMonthLabel: formatLeftMonthLabel(leftMonth),
          sourceRow: archiveResult.rowNumber,
          ...steps,
        },
      });
    }

    if (action === 'delete_registry_entry') {
      if (!previousStudent.registry) {
        return Response.json({
          success: true,
          student: previousStudent,
          audit: {
            registryDeleted: false,
            skipped: true,
          },
        });
      }

      await deleteRegistryEntry(mmsId);
      const now = new Date().toISOString();
      const student = await getAdminStudentByMmsId(mmsId);
      await appendEventLogRows([
        buildStudentExitStepEvent({
          student: student || previousStudent,
          actorEmail: session.user.email || '',
          occurredAt: now,
          eventType: 'student_exit_registry_deleted',
          actionLabel: 'Delete registry entry',
          note,
          payload: {
            registry_deleted: true,
          },
        }),
      ]);

      return Response.json({
        success: true,
        student,
        audit: {
          registryDeleted: true,
        },
      });
    }

    if (action === 'mark_mms_inactive') {
      const result = await markStudentInactive({ studentId: mmsId });
      const now = new Date().toISOString();
      await appendEventLogRows([
        buildStudentExitStepEvent({
          student: previousStudent,
          actorEmail: session.user.email || '',
          occurredAt: now,
          eventType: 'student_exit_mms_inactive_marked',
          actionLabel: 'Mark inactive in MMS',
          note,
          payload: {
            mms_changed: !result?.skipped,
            mms_already_inactive: Boolean(result?.alreadyInactive),
            mms_status: result?.Status || 'Inactive',
          },
        }),
      ]);

      return Response.json({
        success: true,
        student: previousStudent,
        audit: {
          mmsInactive: true,
          alreadyInactive: Boolean(result?.alreadyInactive),
        },
      });
    }

    if (action === 'archive_students_sheet_row') {
      const now = new Date().toISOString();
      const result = await archiveAndDeleteStudentSheetRow({
        mmsId,
        archivedAt: now,
        archivedBy: session.user.email || '',
        archiveNote: note,
      });

      await appendEventLogRows([
        buildStudentExitStepEvent({
          student: previousStudent,
          actorEmail: session.user.email || '',
          occurredAt: now,
          eventType: 'student_exit_sheet_row_archived',
          actionLabel: 'Archive and remove Students row',
          note,
          payload: {
            students_sheet_archived: true,
            students_sheet_deleted: true,
            archive_sheet: 'Students_Archive',
            source_row_number: result.rowNumber,
          },
        }),
      ]);

      return Response.json({
        success: true,
        student: null,
        audit: {
          sheetArchived: true,
          sheetDeleted: true,
        },
      });
    }

    const student = await updateAdminStudent({
      mmsId,
      sheetsUpdates: {
        payment_expectation: 'inactive_or_stopped',
      },
    });

    if (!student) {
      return Response.json({ error: 'Student not found after archive update' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const actorEmail = session.user.email || '';
    const eventRows = [];
    const paymentExpectationChanged = previousStudent.paymentExpectation !== student.paymentExpectation;

    if (paymentExpectationChanged) {
      eventRows.push(buildPaymentFieldChangeEvent({
        student,
        previousValue: previousStudent.paymentExpectation || '',
        nextValue: student.paymentExpectation || '',
        fieldName: 'payment_expectation',
        eventType: 'payment_expectation_changed',
        actorEmail,
        occurredAt: now,
        auditContext: {
          source: 'admin_student_archive_workflow',
          actionLabel: 'Mark inactive / stopped',
          note,
        },
      }));
    }

    eventRows.push(buildStudentArchiveEvent({
      previousStudent,
      student,
      actorEmail,
      occurredAt: now,
      note,
    }));

    await appendEventLogRows(eventRows);

    return Response.json({
      student,
      audit: {
        archiveLogged: true,
        paymentExpectationChanged,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Archive failed' }, { status: 500 });
  }
}
