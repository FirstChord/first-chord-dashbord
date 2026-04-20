import { getAdminStudents } from '@/lib/admin/students';
import { getReviewFlagsRows } from '@/lib/admin/sheets';

export default async function AdminHomePage() {
  const [students, flags] = await Promise.all([getAdminStudents(), getReviewFlagsRows()]);

  const stats = [
    { label: 'Students in Sheets', value: students.length },
    { label: 'Flagged students', value: students.filter((student) => student.hasFlags).length },
    { label: 'Open review flags', value: flags.length },
  ];

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-semibold text-slate-900">Overview</h2>
        <p className="mt-2 text-sm text-slate-600">
          Read-only first slice of the admin surface. Existing tutor and student dashboard routes are unchanged.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">{stat.label}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{stat.value}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
