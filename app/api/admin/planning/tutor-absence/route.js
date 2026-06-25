import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import { getPlanningDashboard, savePlanningItem } from '@/lib/admin/planning';
import { getTutorAbsenceWorkflow } from '@/lib/admin/tutor-absence';
import {
  buildDateInputRange,
  buildTutorAbsencePlanningId,
  buildTutorAbsencePlanningItem,
} from '@/lib/admin/planning-helpers.mjs';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const MAX_DATES = 21;
const MAX_PREVIEW_DAYS = 35;

export async function POST(request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const mode = `${body?.mode || 'create'}`.trim();
  const tutorShortName = `${body?.tutorShortName || ''}`.trim();
  const dates = Array.isArray(body?.dates)
    ? [...new Set(body.dates.map((value) => `${value || ''}`.trim()).filter(Boolean))]
    : [];

  if (!tutorShortName) {
    return Response.json({ error: 'tutorShortName is required' }, { status: 400 });
  }

  if (mode === 'preview_period') {
    const startDate = `${body?.startDate || ''}`.trim();
    const endDate = `${body?.endDate || ''}`.trim();
    const { dates: previewDates, tooLong } = buildDateInputRange(startDate, endDate, { maxDays: MAX_PREVIEW_DAYS });
    if (!previewDates.length) {
      return Response.json({ error: 'Add a valid start and end date for the absence period' }, { status: 400 });
    }
    if (tooLong) {
      return Response.json({ error: `Preview range is too long; use ${MAX_PREVIEW_DAYS} days or fewer` }, { status: 400 });
    }

    try {
      const preview = [];
      let selectedTutor = null;
      // Sequential for MMS safety. The preview is intentionally read-only.
      for (const absenceDate of previewDates) {
        const workflow = await getTutorAbsenceWorkflow({ tutorShortName, absenceDate });
        if (!workflow.selectedTutor) {
          return Response.json({ error: `Unknown tutor: ${tutorShortName}` }, { status: 400 });
        }
        selectedTutor = workflow.selectedTutor;
        preview.push({
          date: absenceDate,
          lessonCount: workflow.lessons.length,
          students: workflow.lessons.map((lesson) => ({
            mmsId: lesson.studentMmsId,
            name: lesson.studentName,
            time: lesson.lessonTime,
          })),
          hasLessons: workflow.lessons.length > 0,
        });
      }

      return Response.json({
        success: true,
        tutor: selectedTutor ? {
          shortName: selectedTutor.shortName,
          fullName: selectedTutor.fullName,
        } : null,
        preview,
        teachingDates: preview.filter((day) => day.hasLessons).map((day) => day.date),
      });
    } catch (error) {
      return Response.json({ error: error.message || 'Tutor absence preview failed' }, { status: 500 });
    }
  }

  const invalidDate = dates.find((date) => !DATE_PATTERN.test(date));
  if (!dates.length || invalidDate) {
    return Response.json(
      { error: invalidDate ? `Invalid date: ${invalidDate}` : 'At least one absence date is required' },
      { status: 400 },
    );
  }

  if (dates.length > MAX_DATES) {
    return Response.json({ error: `A maximum of ${MAX_DATES} dates can be captured at once` }, { status: 400 });
  }

  const actorEmail = session.user.email || '';
  const createdItems = [];

  try {
    // Sequential, not Promise.all: each date hits MMS, so avoid hammering it.
    for (const absenceDate of dates) {
      // getTutorAbsenceWorkflow lazily loads affected lessons from MMS and swallows
      // MMS errors into loadError, so a bad date still yields a card (with no students).
      const workflow = await getTutorAbsenceWorkflow({ tutorShortName, absenceDate });

      if (!workflow.selectedTutor) {
        return Response.json({ error: `Unknown tutor: ${tutorShortName}` }, { status: 400 });
      }

      const item = buildTutorAbsencePlanningItem({
        tutor: workflow.selectedTutor,
        absenceDate,
        lessons: workflow.lessons,
      });

      const saved = await savePlanningItem({
        planningId: buildTutorAbsencePlanningId(workflow.selectedTutor.shortName, absenceDate),
        item,
        actorEmail,
        progressNote: 'Captured via tutor absence planning builder.',
      });

      createdItems.push(saved);
    }

    return Response.json({
      success: true,
      planning: await getPlanningDashboard(),
      createdItems,
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Tutor absence capture failed' }, { status: 500 });
  }
}
