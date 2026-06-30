import { getMmsTutorCalendarEventsForDate } from '@/lib/admin/mms';
import {
  buildTutorDaySchedule,
} from '@/lib/tutor-schedule-helpers.mjs';
import {
  getTutorDashboardOptions,
  resolveTutorTeacherId,
} from '@/lib/tutor-dashboard-helpers.mjs';

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const tutor = `${searchParams.get('tutor') || ''}`.trim();
  const date = `${searchParams.get('date') || todayInputValue()}`.trim();
  const refresh = searchParams.get('refresh') === '1';

  if (!tutor) {
    return Response.json({
      success: false,
      message: 'Tutor is required',
      lessons: [],
      summary: buildTutorDaySchedule([]),
    }, { status: 400 });
  }

  const teacherId = resolveTutorTeacherId(tutor);
  if (!teacherId) {
    return Response.json({
      success: false,
      message: `No MMS teacher ID configured for ${tutor}`,
      tutor,
      date,
      lessons: [],
      summary: buildTutorDaySchedule([]),
    }, { status: 404 });
  }

  try {
    const events = await getMmsTutorCalendarEventsForDate({
      teacherId,
      date,
      limit: 100,
    });
    const summary = buildTutorDaySchedule(events);
    const tutorOption = getTutorDashboardOptions().find((entry) => entry.shortName === tutor) || {};

    return Response.json({
      success: true,
      tutor,
      tutorName: tutorOption.fullName || tutor,
      teacherId,
      date,
      refreshedAt: new Date().toISOString(),
      refresh,
      source: 'mms_calendar',
      lessons: summary.lessons,
      summary,
    });
  } catch (error) {
    return Response.json({
      success: false,
      tutor,
      teacherId,
      date,
      lessons: [],
      summary: buildTutorDaySchedule([]),
      source: 'mms_calendar',
      message: error.message || 'Could not load tutor schedule from MMS',
    }, { status: 500 });
  }
}
