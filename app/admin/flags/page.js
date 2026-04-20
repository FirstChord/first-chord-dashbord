import AdminIssuesPageClient from '@/components/admin/AdminIssuesPageClient';
import { getAdminIssues } from '@/lib/admin/issues';

export default async function AdminFlagsPage() {
  const issues = await getAdminIssues();
  return <AdminIssuesPageClient issues={issues} />;
}

