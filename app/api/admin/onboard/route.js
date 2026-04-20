import { getServerSession } from 'next-auth';

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
import { activateStudent, createFirstLesson, ensureBillingProfile } from '@/lib/admin/mms';
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

function deriveWeekday(value) {
  const parsed = new Date(`${value}T12:00:00`);
  return parsed.toLocaleDateString('en-GB', {
    weekday: 'long',
  });
}

function buildWelcomeMessage(data) {
  const paymentLink = process.env.STRIPE_PAYMENT_LINK || '';
  const handbookUrl = process.env.HANDBOOK_URL || '';

  if (data.isAdult) {
    return `Hey ${data.studentName}, we've got you down for ${data.lessonTime} on ${data.lessonDay} ${data.lessonDate} with ${data.tutorFullName}. ✨🎶

To give ${data.tutorFullName} some context, you're ${data.experienceLevel} and love ${data.interests}!

📍The school is inside CC Music Shop at 33 Otago Street G12 8JJ. Just take a seat on the couch by the door when you arrive and ${data.tutorFullName} will come meet you.

Below is the payment link for your lessons, please note that your first payment confirms the lesson slot, for next week.🚨Please let us know when you have done this!

I'll also include a link to our welcome handbook which has more details about our teaching approach, homework, cancellation policies and more. 📖

Feel free to pop down any questions you have and one of us will be sure to get back to you!

Cheers! 😃

${paymentLink}

${handbookUrl}`;
  }

  return `Hey ${data.parentName}, we've got ${data.studentName} down for ${data.lessonTime} on ${data.lessonDay} ${data.lessonDate} with ${data.tutorFullName}. ✨🎶

To give ${data.tutorFullName} some context, ${data.studentName} is ${data.age || '—'} and ${data.experienceLevel}. They love ${data.interests}!

📍The school is inside CC Music Shop at 33 Otago Street G12 8JJ. Just take a seat on the couch by the door when you arrive and ${data.tutorFullName} will come meet you.

Below is the payment link for your lessons, please note that your first payment confirms the lesson slot, for next week.🚨Please let us know when you have done this!

I'll also include a link to our welcome handbook which has more details about our teaching approach, homework, cancellation policies and more. 📖

Feel free to pop down any questions you have and one of us will be sure to get back to you!

Cheers! 😃

${paymentLink}

${handbookUrl}`;
}

function buildSoundsliceFollowup({ soundsliceCode, studentName, tutorFullName }) {
  return `Oo one last important thing to do. If you could head to soundslice.com and make a free account, then head to soundslice.com/coursecode and pop in this code *${soundsliceCode}* that will make a folder that ${studentName} can access and ${tutorFullName} can put in all the songs they are learning 💥`;
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
  const parentEmail = payload.parentEmail || payload.studentEmail || '';
  const fcStudentId = generateFcStudentId(payload.studentFirstName, payload.studentLastName, parentEmail);
  const friendlyUrl = await generateFriendlyUrl(payload.studentFirstName, payload.studentLastName);
  const thetaUsername = payload.thetaUsername || `${payload.studentFirstName}${payload.studentLastName}fc`.toLowerCase().replace(/[^a-z0-9]/g, '');
  const experienceLevel = normaliseExperienceLevel(payload.experienceLevel);
  const lessonDay = deriveWeekday(payload.lessonDate);
  const lessonDateLabel = formatLessonDateForMessage(payload.lessonDate);
  const studentName = `${payload.studentFirstName} ${payload.studentLastName}`.trim();
  const parentName = `${payload.parentFirstName || ''} ${payload.parentLastName || ''}`.trim() || payload.studentFirstName;
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

    const sheetInsert = await addStudentSheetRow({
      'Student Surname': payload.studentLastName,
      'Student forename': payload.studentFirstName,
      Tutor: tutor.fullName,
      'Parent surname': payload.parentLastName,
      'Parent forename': payload.parentFirstName,
      Email: parentEmail,
      mms_id: payload.mmsId,
      'Lesson length': String(payload.lessonLength || 30),
      'Contact Number': payload.contactNumber || '',
      Soundslice: payload.soundsliceUrl || '',
      Instrument: instrument,
      'FC Student ID': fcStudentId,
      'Theta Username': thetaUsername,
      Theta: thetaUsername,
    });
    steps = markOnboardingStep(steps, 'sheetsWrite', 'succeeded', `Inserted into Students sheet at row ${sheetInsert.insertedAt}.`);

    let registryAction = 'Appended new entry';
    if (duplicateState.shouldAppendRegistry) {
      await appendRegistryEntry({
        mmsId: payload.mmsId,
        firstName: payload.studentFirstName,
        lastName: payload.studentLastName,
        friendlyUrl,
        tutor: payload.tutorShortName,
        instrument,
        soundsliceUrl: payload.soundsliceUrl || '',
        thetaUsername,
        fcStudentId,
      });
      steps = markOnboardingStep(steps, 'registryWrite', 'succeeded', 'Appended new registry entry.');
    } else {
      registryAction = 'Kept existing entry';
      steps = markOnboardingStep(steps, 'registryWrite', 'skipped', 'Existing registry entry retained.');
    }

    let lesson = null;
    let lessonWarning = '';
    let mmsStatus = {
      activated: false,
      billingProfileReady: false,
    };

    try {
      await activateStudent({
        studentId: payload.mmsId,
      });
      mmsStatus.activated = true;
      steps = markOnboardingStep(steps, 'mmsActivation', 'succeeded', 'Student activated in MMS.');

      const billingProfile = await ensureBillingProfile({
        studentId: payload.mmsId,
        teacherId: tutor.teacherId,
        lessonDuration: Number(payload.lessonLength || 30),
      });
      mmsStatus.billingProfileReady = true;
      steps = markOnboardingStep(steps, 'mmsBillingProfile', 'succeeded', 'Billing profile is ready in MMS.');

      lesson = await createFirstLesson({
        studentId: payload.mmsId,
        teacherId: tutor.teacherId,
        lessonDate: payload.lessonDate,
        lessonTime: payload.lessonTime,
        durationMinutes: Number(payload.lessonLength || 30),
        billingProfile,
        isRecurring: payload.isRecurring !== false,
      });
      steps = markOnboardingStep(
        steps,
        'mmsFirstLesson',
        'succeeded',
        lesson?.duplicateSkipped
          ? `Matching ${payload.isRecurring !== false ? 'recurring lesson series' : 'lesson'} already existed in MMS${lesson?.ID ? ` (${lesson.ID})` : ''}`
          : `${payload.isRecurring !== false ? 'Created recurring lesson series' : 'Created single lesson'}${lesson?.ID ? ` (${lesson.ID})` : ''}`,
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
      fcStudentId,
      friendlyUrl,
      registryAction,
      duplicateWarnings: duplicateState.warnings,
      wgcs: {
        whatsappGroupLabel: `${studentName} - WGCS`,
        welcomeMessage: buildWelcomeMessage({
          studentName,
          parentName,
          lessonTime: payload.lessonTime,
          lessonDay,
          lessonDate: lessonDateLabel,
          tutorFullName: tutor.fullName,
          age: payload.age,
          experienceLevel,
          interests: payload.interests || 'music',
          isAdult,
        }),
        soundsliceFollowup: buildSoundsliceFollowup({
          soundsliceCode: payload.soundsliceCode || '',
          studentName,
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
