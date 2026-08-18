/** @fileoverview Scheduled lesson-mirror endpoint, outside admin middleware and fail-closed behind SCHEDULE_REFRESH_SECRET. */
import { createLessonMirrorPostHandler } from '@/lib/admin/lesson-mirror-endpoint.mjs';

// The route is outside admin-session middleware because GitHub Actions calls it.
// It is fail-closed behind the existing SCHEDULE_REFRESH_SECRET trust boundary.
export const POST = createLessonMirrorPostHandler({
  env: process.env,
});
