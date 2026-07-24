import DashboardClient from './page-client';
import { getActiveTutorOptions } from '@/lib/admin/tutors';
import { redirect } from 'next/navigation';
import { getTutorDashboardAccess } from '@/lib/tutor-auth';
import { filterTutorOptionsForAccess } from '@/lib/tutor-auth-helpers.mjs';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const access = await getTutorDashboardAccess();
  if (access.enforced && !access.authorized) {
    redirect('/tutor/login');
  }

  const tutorOptions = filterTutorOptionsForAccess(
    await getActiveTutorOptions(),
    access,
  );
  return (
    <DashboardClient
      tutorOptions={tutorOptions}
      authAccess={{
        enforced: access.enforced,
        email: access.email,
        fullAccess: access.fullAccess,
      }}
    />
  );
}
