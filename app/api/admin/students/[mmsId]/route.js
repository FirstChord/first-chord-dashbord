import { randomUUID } from 'node:crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import { normaliseInstrument } from '@/lib/admin/fc';
import { normalisePaymentExpectation, normalisePaymentMode } from '@/lib/admin/payments-helpers.mjs';
import { getAdminStudentByMmsId, updateAdminStudent } from '@/lib/admin/students';
import { appendEventLogRows } from '@/lib/admin/sheets';

const SHEETS_FIELD_MAP = {
  firstName: 'Student forename',
  lastName: 'Student Surname',
  tutor: 'Tutor',
  instrument: 'Instrument',
  lessonLength: 'Lesson length',
  parentFirstName: 'Parent forename',
  parentLastName: 'Parent surname',
  email: 'Email',
  contactNumber: 'Contact Number',
  paymentMode: 'payment_mode',
  paymentExpectation: 'payment_expectation',
};

const REGISTRY_FIELD_MAP = {
  registryTutor: 'tutor',
  instrument: 'instrument',
  soundsliceUrl: 'soundsliceUrl',
  thetaUsername: 'thetaUsername',
};

function validatePayload(payload) {
  const errors = [];

  if (!payload || typeof payload !== 'object') {
    return ['Invalid request body'];
  }

  if (payload.thetaUsername && !/^[a-z0-9]+$/.test(payload.thetaUsername)) {
    errors.push('Theta username must be lowercase letters and numbers only');
  }

  if (payload.soundsliceUrl && !/^https:\/\/www\.soundslice\.com\/courses\/.+/.test(payload.soundsliceUrl)) {
    errors.push('Soundslice URL must be a valid Soundslice course URL');
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'paymentMode') && !normalisePaymentMode(payload.paymentMode)) {
    errors.push('Payment mode must be stripe, manual, or unknown');
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, 'paymentExpectation') &&
    payload.paymentExpectation &&
    !normalisePaymentExpectation(payload.paymentExpectation)
  ) {
    errors.push('Payment expectation must be setup_pending, stripe_active_expected, stripe_paused_expected, or inactive_or_stopped');
  }

  return errors;
}

function mapUpdates(payload, mapping) {
  return Object.entries(mapping).reduce((acc, [inputKey, outputKey]) => {
    if (Object.prototype.hasOwnProperty.call(payload, inputKey)) {
      if (inputKey === 'instrument') {
        acc[outputKey] = normaliseInstrument(payload[inputKey]);
      } else if (inputKey === 'paymentMode') {
        acc[outputKey] = normalisePaymentMode(payload[inputKey]);
      } else if (inputKey === 'paymentExpectation') {
        acc[outputKey] = normalisePaymentExpectation(payload[inputKey]);
      } else {
        acc[outputKey] = payload[inputKey];
      }
    }
    return acc;
  }, {});
}

export async function GET(_request, { params }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const student = await getAdminStudentByMmsId(params.mmsId);

  if (!student) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  return Response.json({ student });
}

export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await request.json();
  const errors = validatePayload(payload);

  if (errors.length > 0) {
    return Response.json({ error: errors.join('. ') }, { status: 400 });
  }

  try {
    const previousStudent = await getAdminStudentByMmsId(params.mmsId);
    const student = await updateAdminStudent({
      mmsId: params.mmsId,
      sheetsUpdates: mapUpdates(payload, SHEETS_FIELD_MAP),
      registryUpdates: mapUpdates(payload, REGISTRY_FIELD_MAP),
    });

    if (!student) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    const eventRows = [];
    const now = new Date().toISOString();

    if (previousStudent && Object.prototype.hasOwnProperty.call(payload, 'paymentMode') && previousStudent.paymentMode !== student.paymentMode) {
      eventRows.push({
        eventId: randomUUID(),
        occurredAt: now,
        actorEmail: session.user.email || '',
        entityType: 'student',
        entityId: student.mmsId,
        eventType: 'payment_mode_changed',
        mmsId: student.mmsId,
        studentName: student.fullName || student.mmsId,
        issueId: '',
        payloadJson: JSON.stringify({
          previous_value: previousStudent.paymentMode || '',
          next_value: student.paymentMode || '',
          source: 'admin_student_update',
        }),
      });
    }

    if (
      previousStudent &&
      Object.prototype.hasOwnProperty.call(payload, 'paymentExpectation') &&
      previousStudent.paymentExpectation !== student.paymentExpectation
    ) {
      eventRows.push({
        eventId: randomUUID(),
        occurredAt: now,
        actorEmail: session.user.email || '',
        entityType: 'student',
        entityId: student.mmsId,
        eventType: 'payment_expectation_changed',
        mmsId: student.mmsId,
        studentName: student.fullName || student.mmsId,
        issueId: '',
        payloadJson: JSON.stringify({
          previous_value: previousStudent.paymentExpectation || '',
          next_value: student.paymentExpectation || '',
          source: 'admin_student_update',
        }),
      });
    }

    if (eventRows.length) {
      await appendEventLogRows(eventRows);
    }

    return Response.json({ student });
  } catch (error) {
    return Response.json({ error: error.message || 'Update failed' }, { status: 500 });
  }
}
