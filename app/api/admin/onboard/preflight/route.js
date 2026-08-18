/** @fileoverview Admin-gated dry run reporting sheet, registry, MMS, and free-slot readiness before a student is onboarded. */
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/admin/auth';
import { getOnboardingPreflightState } from '@/lib/admin/onboarding';
import { getStudentDetails } from '@/lib/admin/mms';
import { ADMIN_TUTORS } from '@/lib/admin/tutors';

function buildPreflightSummary({ duplicateState, operationalState, tutorFullName, freeSlot = null, hasFreeEvent = false }) {
  const summary = {
    sheets: {
      status: duplicateState.exactDuplicate ? 'blocked' : duplicateState.matchingTutorCount > 0 ? 'warning' : 'clear',
      label: 'Students sheet',
      detail: duplicateState.hasSameTutorSheetRow
        ? `A Students row already exists for ${tutorFullName}.`
        : duplicateState.matchingTutorCount > 0
          ? `Existing Students rows found for ${duplicateState.matchingTutors.join(', ')}.`
          : 'No conflicting Students row found.',
    },
    registry: {
      status: duplicateState.partialCanonicalRecord
        ? 'blocked'
        : duplicateState.shouldAppendRegistry
          ? 'clear'
          : duplicateState.exactDuplicate
            ? 'blocked'
            : 'warning',
      label: 'Registry',
      detail: duplicateState.partialCanonicalRecord
        ? 'The Students row exists but the registry entry is missing. Use the SHEETS ONLY recovery action; do not rerun onboarding.'
        : duplicateState.shouldAppendRegistry
          ? 'No existing registry entry found.'
          : duplicateState.registryMatchesTutor
            ? `A registry entry already exists for tutor ${duplicateState.registryTutor}.`
            : 'An existing registry entry will be reused for this multi-lesson student.',
    },
    mmsStudent: {
      status: operationalState.isActive ? 'ready' : 'pending',
      label: 'MMS student status',
      detail: operationalState.isActive
        ? 'Student is already Active in MMS.'
        : `Student is currently ${operationalState.studentStatus || 'not confirmed'} and will need activation.`,
    },
    mmsBillingProfile: {
      status: operationalState.billingProfile ? 'ready' : 'pending',
      label: 'MMS billing profile',
      detail: operationalState.billingProfile
        ? 'Billing profile already exists for the selected tutor.'
        : 'No billing profile exists yet for the selected tutor.',
    },
    mmsLesson: {
      status: operationalState.existingLesson ? 'warning' : 'clear',
      label: 'MMS lesson slot',
      detail: operationalState.existingLesson
        ? `A matching lesson already exists in MMS${operationalState.existingLesson.ID ? ` (${operationalState.existingLesson.ID})` : ''}.`
        : 'No matching lesson found for the selected slot.',
    },
  };

  if (hasFreeEvent) {
    summary.mmsFreeSlot = {
      status: freeSlot ? 'ready' : 'blocked',
      label: 'Selected MMS Free event',
      detail: freeSlot
        ? freeSlot.weekOffset
          ? `Free slot ${freeSlot.eventId} still matches this tutor, time, and lesson length, and is still free ${freeSlot.weekOffset} week${freeSlot.weekOffset === 1 ? '' : 's'} later on ${freeSlot.lessonStartDateTime.slice(0, 10)}. The slot and every week from ${freeSlot.slotDate} onwards will be removed after the lesson is confirmed.`
          : `Free event ${freeSlot.eventId} still matches this tutor, date, time, and lesson length. It will be removed after the lesson is confirmed.`
        : 'The selected Free event could not be confirmed.',
    };
  }

  return summary;
}

export async function POST(request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await request.json();
  const tutor = ADMIN_TUTORS[payload.tutorShortName];

  if (!payload.mmsId || !tutor) {
    return Response.json({ error: 'MMS ID and tutor are required' }, { status: 400 });
  }

  try {
    const { duplicateState, operationalState, freeSlot } = await getOnboardingPreflightState({
      mmsId: payload.mmsId,
      tutorFullName: tutor.fullName,
      tutorShortName: payload.tutorShortName,
      teacherId: tutor.teacherId,
      lessonDate: payload.lessonDate || '',
      lessonTime: payload.lessonTime || '',
      lessonLength: payload.lessonType === 'sibling_group' ? 45 : Number(payload.lessonLength || 30),
      freeEventId: payload.freeEventId || '',
    });

    let secondary = null;
    if (payload.lessonType === 'sibling_group' && payload.secondStudentMmsId) {
      const secondDetails = await getStudentDetails(payload.secondStudentMmsId);
      const secondaryState = await getOnboardingPreflightState({
        mmsId: payload.secondStudentMmsId,
        tutorFullName: tutor.fullName,
        tutorShortName: payload.tutorShortName,
        teacherId: tutor.teacherId,
        lessonDate: payload.lessonDate || '',
        lessonTime: payload.lessonTime || '',
      });

      secondary = {
        mmsId: payload.secondStudentMmsId,
        studentName: secondDetails.fullName || payload.secondStudentMmsId,
        duplicateState: secondaryState.duplicateState,
        operationalState: secondaryState.operationalState,
        summary: buildPreflightSummary({
          duplicateState: secondaryState.duplicateState,
          operationalState: secondaryState.operationalState,
          tutorFullName: tutor.fullName,
          hasFreeEvent: false,
        }),
      };
    }

    return Response.json({
      duplicateState,
      operationalState,
      secondary,
      summary: buildPreflightSummary({
        duplicateState,
        operationalState,
        tutorFullName: tutor.fullName,
        freeSlot,
        hasFreeEvent: Boolean(payload.freeEventId),
      }),
    });
  } catch (error) {
    return Response.json(
      {
        error: error.message || 'Onboarding preflight failed',
      },
      { status: 503 },
    );
  }
}
