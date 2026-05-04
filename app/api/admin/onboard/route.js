import { getServerSession } from 'next-auth';
import crypto from 'node:crypto';

import { authOptions } from '@/lib/admin/auth';
import {
  buildOnboardingCompletionStatus,
  buildOnboardingRecoveryGuidance,
  createOnboardingSteps,
  getOnboardingDuplicateState,
  markOnboardingStep,
} from '@/lib/admin/onboarding';
import { addStudentSheetRow } from '@/lib/admin/sheets';
import { appendRegistryEntry } from '@/lib/admin/registry';
import { activateStudent, createFirstLesson, ensureBillingProfile, getStudentDetails } from '@/lib/admin/mms';
import { generateFcStudentId, generateFriendlyUrl, normaliseExperienceLevel, normaliseInstrument } from '@/lib/admin/fc';
import { ADMIN_TUTORS } from '@/lib/admin/tutors';

function formatLessonDateForMessage(value) {
  const parsed = new Date(`${value}T12:00:00`);
  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatLessonTimeForMessage(value) {
  const trimmed = `${value || ''}`.trim();
  if (!trimmed) {
    throw new Error('Lesson time is required');
  }

  const match = trimmed.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  if (!match) {
    throw new Error('Lesson time is invalid');
  }

  const [, hours, minutes] = match;
  const parsed = new Date(`2000-01-01T${hours}:${minutes}:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Lesson time is invalid');
  }

  return parsed.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function deriveWeekday(value) {
  const parsed = new Date(`${value}T12:00:00`);
  return parsed.toLocaleDateString('en-GB', {
    weekday: 'long',
  });
}

function firstNameOnly(value, fallback = '') {
  const trimmed = `${value || ''}`.trim();
  if (!trimmed) return fallback;
  return trimmed.split(/\s+/)[0] || fallback;
}

function buildWelcomeMessage(data) {
  const paymentLink = process.env.STRIPE_PAYMENT_LINK || process.env.PAYMENT_LINK || '[ADD PAYMENT LINK]';
  const groupPaymentLink = process.env.GROUP_LESSON_PAYMENT_LINK || 'https://buy.stripe.com/14AdRab7C1b28N79ZM5J60D';
  const handbookUrl = process.env.HANDBOOK_URL || 'https://firstchord.co.uk/handbook';
  const recipientFirstName = data.isAdult
    ? firstNameOnly(data.studentName, data.studentName)
    : firstNameOnly(data.parentName, data.parentName);
  const tutorFirstName = firstNameOnly(data.tutorFullName, data.tutorFullName);
  const resolvedPaymentLink = data.lessonType === 'sibling_group' ? groupPaymentLink : paymentLink;
  const learnerLabel = data.lessonType === 'sibling_group' ? data.studentNamesLabel : data.studentName;

  if (data.isAdult) {
    return `Hey ${recipientFirstName}, we've got you down for ${data.lessonTime} on ${data.lessonDay} ${data.lessonDate} with ${tutorFirstName}. ✨🎶

To give ${tutorFirstName} some context, you're ${data.experienceLevel} and love ${data.interests}!

📍The school is inside CC Music Shop at 33 Otago Street G12 8JJ. Just take a seat on the couch by the door when you arrive and ${tutorFirstName} will come meet you.

Below is the payment link for your lessons, please note that your first payment confirms the lesson slot, for next week.🚨Please let us know when you have done this!

I'll also include a link to our welcome handbook which has more details about our teaching approach, homework, cancellation policies and more. 📖

Feel free to pop down any questions you have and one of us will be sure to get back to you!

Cheers! 😃

${resolvedPaymentLink}

${handbookUrl}`;
  }

  return `Hey ${recipientFirstName}, we've got ${learnerLabel} down for ${data.lessonTime} on ${data.lessonDay} ${data.lessonDate} with ${tutorFirstName}. ✨🎶

To give ${tutorFirstName} some context, ${learnerLabel} ${data.lessonType === 'sibling_group' ? 'are' : 'is'} ${data.age || '—'} and ${data.experienceLevel}. They love ${data.interests}!

📍The school is inside CC Music Shop at 33 Otago Street G12 8JJ. Just take a seat on the couch by the door when you arrive and ${tutorFirstName} will come meet you.

Below is the payment link for your lessons, please note that your first payment confirms the lesson slot, for next week.🚨Please let us know when you have done this!

I'll also include a link to our welcome handbook which has more details about our teaching approach, homework, cancellation policies and more. 📖

Feel free to pop down any questions you have and one of us will be sure to get back to you!

Cheers! 😃

${resolvedPaymentLink}

${handbookUrl}`;
}

function buildSoundsliceFollowup({ soundsliceCode, studentName, tutorFullName }) {
  const tutorFirstName = firstNameOnly(tutorFullName, tutorFullName);
  return `Oo one last important thing to do. If you could head to soundslice.com and make a free account, then head to soundslice.com/coursecode and pop in this code *${soundsliceCode}* that will make a folder that ${studentName} can access and ${tutorFirstName} can put in all the songs they are learning 💥`;
}

function generateBillingGroupId(mmsIds = []) {
  const seed = [...mmsIds].filter(Boolean).sort().join(':');
  return `bg_${crypto.createHash('sha256').update(seed).digest('hex').slice(0, 8)}`;
}

async function appendCanonicalStudent({
  student,
  tutor,
  parentEmail,
  lessonLength,
  instrument,
  billingGroupId = '',
  groupPartnerMmsId = '',
  lessonType = 'individual',
}) {
  const fcStudentId = generateFcStudentId(student.firstName, student.lastName, parentEmail);
  const friendlyUrl = await generateFriendlyUrl(student.firstName, student.lastName);
  const thetaUsername = student.thetaUsername || `${student.firstName}${student.lastName}fc`.toLowerCase().replace(/[^a-z0-9]/g, '');
  const duplicateState = await getOnboardingDuplicateState({
    mmsId: student.mmsId,
    tutorFullName: tutor.fullName,
    tutorShortName: tutor.shortName,
  });

  if (duplicateState.exactDuplicate) {
    throw new Error(duplicateState.blockingReasons.join(' '));
  }

  const sheetInsert = await addStudentSheetRow({
    'Student Surname': student.lastName,
    'Student forename': student.firstName,
    Tutor: tutor.fullName,
    'Parent surname': student.parentLastName,
    'Parent forename': student.parentFirstName,
    Email: parentEmail,
    mms_id: student.mmsId,
    'Lesson length': String(lessonLength || 30),
    'Contact Number': student.contactNumber || '',
    Soundslice: student.soundsliceUrl || '',
    Instrument: instrument,
    'FC Student ID': fcStudentId,
    'Theta Username': thetaUsername,
    Theta: thetaUsername,
    lesson_type: lessonType,
    billing_group_id: billingGroupId,
    group_partner_mms_id: groupPartnerMmsId,
  });

  let registryAction = 'kept_existing';
  if (duplicateState.shouldAppendRegistry) {
    await appendRegistryEntry({
      mmsId: student.mmsId,
      firstName: student.firstName,
      lastName: student.lastName,
      friendlyUrl,
      tutor: tutor.shortName,
      instrument,
      soundsliceUrl: student.soundsliceUrl || '',
      thetaUsername,
      fcStudentId,
    });
    registryAction = 'appended';
  }

  return {
    sheetInsert,
    registryAction,
    duplicateState,
    fcStudentId,
    friendlyUrl,
    thetaUsername,
  };
}

export async function POST(request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await request.json();
  const tutor = ADMIN_TUTORS[payload.tutorShortName];

  if (!tutor) {
    return Response.json({ error: 'Tutor is required' }, { status: 400 });
  }

  const instrument = normaliseInstrument(payload.instrument);
  const isAdult = Boolean(payload.isAdult);
  const lessonType = payload.lessonType === 'sibling_group' ? 'sibling_group' : 'individual';
  const resolvedLessonLength = lessonType === 'sibling_group' ? 45 : Number(payload.lessonLength || 30);
  const parentEmail = payload.parentEmail || payload.studentEmail || '';
  const experienceLevel = normaliseExperienceLevel(payload.experienceLevel);
  const lessonDay = deriveWeekday(payload.lessonDate);
  const lessonDateLabel = formatLessonDateForMessage(payload.lessonDate);
  const lessonTimeLabel = formatLessonTimeForMessage(payload.lessonTime);
  const studentName = `${payload.studentFirstName} ${payload.studentLastName}`.trim();
  const parentName = `${payload.parentFirstName || ''} ${payload.parentLastName || ''}`.trim() || payload.studentFirstName;
  const secondStudentRequired = lessonType === 'sibling_group';
  if (secondStudentRequired && !payload.secondStudentMmsId) {
    return Response.json({ error: 'Second student is required for a sibling group lesson' }, { status: 400 });
  }

  const secondStudentDetails = secondStudentRequired ? await getStudentDetails(payload.secondStudentMmsId) : null;
  const studentIds = [payload.mmsId];
  if (secondStudentDetails?.mmsId) {
    studentIds.push(secondStudentDetails.mmsId);
  }
  const billingGroupId = secondStudentRequired ? generateBillingGroupId(studentIds) : '';
  const secondStudentName = secondStudentDetails?.fullName || '';
  const studentNamesLabel = secondStudentRequired && secondStudentName ? `${studentName} and ${secondStudentName}` : studentName;
  const duplicateState = await getOnboardingDuplicateState({
    mmsId: payload.mmsId,
    tutorFullName: tutor.fullName,
    tutorShortName: payload.tutorShortName,
  });
  let steps = createOnboardingSteps();

  if (duplicateState.exactDuplicate) {
    steps = markOnboardingStep(
      steps,
      'duplicateCheck',
      'failed',
      duplicateState.blockingReasons.join(' '),
    );
    steps = markOnboardingStep(steps, 'sheetsWrite', 'skipped', 'Skipped because an exact duplicate already exists.');
    steps = markOnboardingStep(steps, 'registryWrite', 'skipped', 'Skipped because an exact duplicate already exists.');
    steps = markOnboardingStep(steps, 'mmsActivation', 'skipped', 'Skipped because an exact duplicate already exists.');
    steps = markOnboardingStep(steps, 'mmsBillingProfile', 'skipped', 'Skipped because an exact duplicate already exists.');
    steps = markOnboardingStep(steps, 'mmsFirstLesson', 'skipped', 'Skipped because an exact duplicate already exists.');

    return Response.json(
      {
        error: duplicateState.blockingReasons.join(' '),
        duplicateWarnings: duplicateState.warnings,
        steps,
        recoveryGuidance: buildOnboardingRecoveryGuidance({ steps, duplicateState }),
      },
      { status: 409 },
    );
  }

  try {
    steps = markOnboardingStep(steps, 'duplicateCheck', 'succeeded', duplicateState.warnings.length ? duplicateState.warnings.join(' ') : 'No blocking duplicate found.');

    const primaryRecord = await appendCanonicalStudent({
      student: {
        mmsId: payload.mmsId,
        firstName: payload.studentFirstName,
        lastName: payload.studentLastName,
        parentFirstName: payload.parentFirstName,
        parentLastName: payload.parentLastName,
        contactNumber: payload.contactNumber,
        soundsliceUrl: payload.soundsliceUrl || '',
        thetaUsername: payload.thetaUsername || '',
      },
      tutor: { fullName: tutor.fullName, shortName: payload.tutorShortName },
      parentEmail,
      lessonLength: resolvedLessonLength,
      instrument,
      billingGroupId,
      groupPartnerMmsId: secondStudentDetails?.mmsId || '',
      lessonType,
    });

    let secondaryRecord = null;
    if (secondStudentDetails) {
      secondaryRecord = await appendCanonicalStudent({
        student: {
          mmsId: secondStudentDetails.mmsId,
          firstName: secondStudentDetails.firstName,
          lastName: secondStudentDetails.lastName,
          parentFirstName: secondStudentDetails.parentFirstName || payload.parentFirstName,
          parentLastName: secondStudentDetails.parentLastName || payload.parentLastName,
          contactNumber: secondStudentDetails.studentTelephone || secondStudentDetails.parentTelephone || payload.contactNumber,
          soundsliceUrl: payload.soundsliceUrl || '',
          thetaUsername: '',
        },
        tutor: { fullName: tutor.fullName, shortName: payload.tutorShortName },
        parentEmail: secondStudentDetails.parentEmail || parentEmail,
        lessonLength: resolvedLessonLength,
        instrument,
        billingGroupId,
        groupPartnerMmsId: payload.mmsId,
        lessonType,
      });
    }

    steps = markOnboardingStep(
      steps,
      'sheetsWrite',
      'succeeded',
      secondStudentDetails
        ? `Inserted both students into the Students sheet (${primaryRecord.sheetInsert.insertedAt}, ${secondaryRecord?.sheetInsert.insertedAt}).`
        : `Inserted into Students sheet at row ${primaryRecord.sheetInsert.insertedAt}.`,
    );

    const registryAction = secondStudentDetails
      ? `${primaryRecord.registryAction}, ${secondaryRecord?.registryAction || 'kept_existing'}`
      : primaryRecord.registryAction;
    if (primaryRecord.registryAction === 'appended' || secondaryRecord?.registryAction === 'appended') {
      steps = markOnboardingStep(steps, 'registryWrite', 'succeeded', secondStudentDetails ? 'Registry entries processed for both students.' : 'Appended new registry entry.');
    } else {
      steps = markOnboardingStep(steps, 'registryWrite', 'skipped', secondStudentDetails ? 'Existing registry entries retained for both students.' : 'Existing registry entry retained.');
    }

    let lesson = null;
    let lessonWarning = '';
    let mmsStatus = {
      activated: false,
      billingProfileReady: false,
    };

    try {
      const activation = await activateStudent({
        studentId: payload.mmsId,
      });
      if (secondStudentDetails?.mmsId) {
        await activateStudent({ studentId: secondStudentDetails.mmsId });
      }
      mmsStatus.activated = true;
      steps = markOnboardingStep(
        steps,
        'mmsActivation',
        activation?.alreadyActive ? 'skipped' : 'succeeded',
        secondStudentDetails
          ? 'Both students are active in MMS or were already active.'
          : activation?.alreadyActive ? 'Student was already active in MMS.' : 'Student activated in MMS.',
      );

      const billingProfile = await ensureBillingProfile({
        studentId: payload.mmsId,
        teacherId: tutor.teacherId,
        lessonDuration: resolvedLessonLength,
      });
      const secondBillingProfile = secondStudentDetails?.mmsId
        ? await ensureBillingProfile({
            studentId: secondStudentDetails.mmsId,
            teacherId: tutor.teacherId,
            lessonDuration: resolvedLessonLength,
          })
        : null;
      mmsStatus.billingProfileReady = true;
      steps = markOnboardingStep(
        steps,
        'mmsBillingProfile',
        billingProfile?.alreadyExists && (!secondBillingProfile || secondBillingProfile.alreadyExists) ? 'skipped' : 'succeeded',
        secondStudentDetails
          ? 'Billing profiles are ready for both students in MMS.'
          : billingProfile?.alreadyExists ? 'Existing billing profile reused in MMS.' : 'Billing profile is ready in MMS.',
      );

      lesson = await createFirstLesson({
        studentIds,
        teacherId: tutor.teacherId,
        lessonDate: payload.lessonDate,
        lessonTime: payload.lessonTime,
        durationMinutes: resolvedLessonLength,
        billingProfile,
        isRecurring: payload.isRecurring !== false,
      });
      steps = markOnboardingStep(
        steps,
        'mmsFirstLesson',
        lesson?.duplicateSkipped ? 'skipped' : 'succeeded',
        lesson?.duplicateSkipped
          ? `Matching ${payload.isRecurring !== false ? secondStudentDetails ? 'group recurring lesson series' : 'recurring lesson series' : secondStudentDetails ? 'group lesson' : 'lesson'} already existed in MMS${lesson?.ID ? ` (${lesson.ID})` : ''}`
          : `${payload.isRecurring !== false ? secondStudentDetails ? 'Created recurring group lesson series' : 'Created recurring lesson series' : secondStudentDetails ? 'Created single group lesson' : 'Created single lesson'}${lesson?.ID ? ` (${lesson.ID})` : ''}`,
      );
    } catch (error) {
      lessonWarning = error.message || 'MMS lesson creation failed';
      if (!mmsStatus.activated) {
        steps = markOnboardingStep(steps, 'mmsActivation', 'failed', lessonWarning);
        steps = markOnboardingStep(steps, 'mmsBillingProfile', 'skipped', 'Skipped because MMS activation did not complete.');
        steps = markOnboardingStep(steps, 'mmsFirstLesson', 'skipped', 'Skipped because MMS activation did not complete.');
      } else if (!mmsStatus.billingProfileReady) {
        steps = markOnboardingStep(steps, 'mmsBillingProfile', 'failed', lessonWarning);
        steps = markOnboardingStep(steps, 'mmsFirstLesson', 'skipped', 'Skipped because MMS billing profile was not ready.');
      } else {
        steps = markOnboardingStep(steps, 'mmsFirstLesson', 'failed', lessonWarning);
      }
    }

    return Response.json({
      success: true,
      steps,
      completionStatus: buildOnboardingCompletionStatus({ steps }),
      recoveryGuidance: buildOnboardingRecoveryGuidance({ steps, duplicateState }),
      lessonId: lesson?.ID || '',
      lessonWarning,
      mmsStatus,
      fcStudentId: primaryRecord.fcStudentId,
      friendlyUrl: primaryRecord.friendlyUrl,
      registryAction,
      duplicateWarnings: duplicateState.warnings,
      siblingGroup: secondStudentDetails
        ? {
            billingGroupId,
            secondStudentMmsId: secondStudentDetails.mmsId,
            secondStudentName,
          }
        : null,
      wgcs: {
        whatsappGroupLabel: `${studentNamesLabel} - WGCS`,
        welcomeMessage: buildWelcomeMessage({
          studentName,
          studentNamesLabel,
          parentName,
          lessonTime: lessonTimeLabel,
          lessonDay,
          lessonDate: lessonDateLabel,
          tutorFullName: tutor.fullName,
          age: payload.age,
          experienceLevel,
          interests: payload.interests || 'music',
          isAdult,
          lessonType,
        }),
        soundsliceFollowup: buildSoundsliceFollowup({
          soundsliceCode: payload.soundsliceCode || '',
          studentName: studentNamesLabel,
          tutorFullName: tutor.fullName,
        }),
      },
    });
  } catch (error) {
    if (steps.duplicateCheck.status === 'pending') {
      steps = markOnboardingStep(steps, 'duplicateCheck', 'succeeded', 'No blocking duplicate found.');
    }
    if (steps.sheetsWrite.status === 'pending') {
      steps = markOnboardingStep(steps, 'sheetsWrite', 'failed', error.message || 'Onboarding failed before the Students sheet write completed.');
      steps = markOnboardingStep(steps, 'registryWrite', 'skipped', 'Skipped because the Students sheet write did not complete.');
      steps = markOnboardingStep(steps, 'mmsActivation', 'skipped', 'Skipped because the Students sheet write did not complete.');
      steps = markOnboardingStep(steps, 'mmsBillingProfile', 'skipped', 'Skipped because the Students sheet write did not complete.');
      steps = markOnboardingStep(steps, 'mmsFirstLesson', 'skipped', 'Skipped because the Students sheet write did not complete.');
    }

    return Response.json(
      {
        error: error.message || 'Onboarding failed',
        steps,
        recoveryGuidance: buildOnboardingRecoveryGuidance({ steps, duplicateState }),
      },
      { status: 500 },
    );
  }
}
