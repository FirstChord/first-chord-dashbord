import AdminIssuesPageClient from '@/components/admin/AdminIssuesPageClient';
import { getAdminIssues } from '@/lib/admin/issues';

function DuplicateMmsIdBanner({ groups = [] }) {
  if (!groups.length) {
    return null;
  }

  return (
    <section className="rounded-[1.2rem] border border-red-200 bg-red-50 p-5 shadow-[0_12px_36px_rgba(15,23,42,0.06)]">
      <h3 className="text-base font-semibold text-red-900">Duplicate MMS IDs in the Students sheet</h3>
      <p className="mt-1 text-sm text-red-800">
        These MMS IDs are used by more than one student row. Profiles for a shared ID resolve to the first
        matching row only, so clicking one student can show another. Fix the MMS ID in the Students sheet.
      </p>
      <ul className="mt-3 space-y-1.5 text-sm text-red-900">
        {groups.map((group) => (
          <li key={group.mmsId}>
            <span className="font-mono font-semibold">{group.mmsId}</span>
            {' — '}
            {group.students.join(', ')}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function AdminFlagsPage() {
  const { issues, freshness, duplicateMmsIds } = await getAdminIssues();
  return (
    <div className="space-y-6">
      <DuplicateMmsIdBanner groups={duplicateMmsIds} />
      <AdminIssuesPageClient issues={issues} freshness={freshness} />
    </div>
  );
}
