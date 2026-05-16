import Link from 'next/link';
import { getAdminStudents } from '@/lib/admin/students';

function normaliseSearch(value = '') {
  return value.toString().trim().toLowerCase();
}

function getSearchQuery(searchParams = {}) {
  const value = searchParams.q;
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function studentMatchesSearch(student, query) {
  if (!query) return true;

  return [
    student.fullName,
    student.firstName,
    student.lastName,
    student.tutor,
    student.instrument,
    student.email,
    student.parentEmail,
    student.contactNumber,
    student.mmsId,
  ].some((value) => normaliseSearch(value).includes(query));
}

export default async function AdminStudentsPage({ searchParams }) {
  const students = await getAdminStudents();
  const resolvedSearchParams = await searchParams;
  const rawQuery = getSearchQuery(resolvedSearchParams);
  const query = normaliseSearch(rawQuery);
  const visibleStudents = query ? students.filter((student) => studentMatchesSearch(student, query)) : students;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Operational records</p>
        <h2
          className="mt-2 text-3xl font-bold uppercase tracking-wide text-slate-800"
          style={{ fontFamily: '"Cooper Hewitt", "Nimbus Sans L", "Arial", sans-serif' }}
        >
          Students
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Read-only merged list from the Sheets identity lane plus registry portal lane. Use this as a lookup surface rather than a primary workflow.
        </p>
      </div>

      <form action="/admin/students" className="rounded-[1.2rem] border border-blue-100 bg-white/85 p-4 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
        <label htmlFor="student-search" className="text-sm font-medium text-slate-700">Find student</label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            id="student-search"
            type="search"
            name="q"
            defaultValue={rawQuery}
            placeholder="Name, tutor, email, instrument, or MMS ID"
            className="h-10 flex-1 rounded-full border border-blue-200/70 bg-white px-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-300"
          />
          <button
            type="submit"
            className="h-10 rounded-full border border-blue-200/70 bg-white px-5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-blue-300 hover:text-slate-900"
          >
            Search
          </button>
        </div>
        {query ? (
          <p className="mt-3 text-sm text-slate-600">
            Showing {visibleStudents.length} of {students.length} records for "{rawQuery}".
          </p>
        ) : null}
      </form>

      <div className="overflow-hidden rounded-[1.6rem] border border-blue-100 bg-white/90 shadow-[0_12px_36px_rgba(15,23,42,0.06)] backdrop-blur-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-blue-50/70">
            <tr>
              {['Name', 'Tutor', 'Instrument', 'Email', 'Contact', 'MMS ID', 'Flags'].map((header) => (
                <th
                  key={header}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleStudents.map((student, index) => (
              <tr key={`${student.mmsId}-${student.tutor || 'no-tutor'}-${index}`} className="transition hover:bg-blue-50/60">
                <td className="px-4 py-3">
                  <Link href={`/admin/students/${student.mmsId}`} className="font-medium text-slate-900 hover:underline">
                    {student.fullName || student.mmsId}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">{student.tutor || '—'}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{student.instrument || '—'}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{student.email || '—'}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{student.contactNumber || '—'}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{student.mmsId}</td>
                <td className="px-4 py-3 text-sm text-slate-700">
                  {student.hasFlags ? (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">
                      {student.flags.length} flag{student.flags.length === 1 ? '' : 's'}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
            {!visibleStudents.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-sm text-slate-600">
                  No matching student records found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
