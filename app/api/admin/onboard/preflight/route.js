import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/admin/auth';
import { getOnboardingPreflightState } from '@/lib/admin/onboarding';
import { ADMIN_TUTORS } from '@/lib/admin/tutors';

function buildPreflightSummary({ duplicateState, operationalState, tutorFullName }) {
  return {
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
      status: duplicateState.shouldAppendRegistry ? 'clear' : duplicateState.exactDuplicate ? 'blocked' : 'warning',
      label: 'Registry',
      detail: duplicateState.shouldAppendRegistry
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

  const { duplicateState, operationalState } = await getOnboardingPreflightState({
    mmsId: payload.mmsId,
    tutorFullName: tutor.fullName,
    tutorShortName: payload.tutorShortName,
    teacherId: tutor.teacherId,
    lessonDate: payload.lessonDate || '',
    lessonTime: payload.lessonTime || '',
  });

  return Response.json({
    duplicateState,
    operationalState,
    summary: buildPreflightSummary({
      duplicateState,
      operationalState,
      tutorFullName: tutor.fullName,
    }),
  });
}
