import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import { getPlanningDashboard, savePlanningItem } from '@/lib/admin/planning';
import { getTutorAbsenceWorkflow } from '@/lib/admin/tutor-absence';
import {
  buildTutorAbsencePlanningId,
  buildTutorAbsencePlanningItem,
} from '@/lib/admin/planning-helpers.mjs';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const MAX_DATES = 7;

export async function POST(request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const tutorShortName = `${body?.tutorShortName || ''}`.trim();
  const dates = Array.isArray(body?.dates)
    ? [...new Set(body.dates.map((value) => `${value || ''}`.trim()).filter(Boolean))]
    : [];

  if (!tutorShortName) {
    return Response.json({ error: 'tutorShortName is required' }, { status: 400 });
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
