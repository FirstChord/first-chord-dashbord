import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import { buildPaymentFieldChangeEvent } from '@/lib/admin/payment-audit-helpers.mjs';
import { deleteRegistryEntry } from '@/lib/admin/registry';
import {
  buildStudentArchiveEvent,
  buildStudentExitStepEvent,
  normaliseStudentArchiveNote,
} from '@/lib/admin/student-archive-helpers.mjs';
import { getAdminStudentByMmsId, updateAdminStudent } from '@/lib/admin/students';
import { markStudentInactive } from '@/lib/admin/mms';
import { appendEventLogRows, archiveAndDeleteStudentSheetRow } from '@/lib/admin/sheets';

const VALID_ACTIONS = new Set([
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

  if (!note) {
    return Response.json({ error: 'A short note is required for student exit actions.' }, { status: 400 });
  }

  try {
    const previousStudent = await getAdminStudentByMmsId(mmsId);
    if (!previousStudent) {
      return Response.json({ error: 'Student not found in Sheets' }, { status: 404 });
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
