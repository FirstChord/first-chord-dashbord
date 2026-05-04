import Link from 'next/link';
import { getAdminStudents } from '@/lib/admin/students';

export default async function AdminStudentsPage() {
  const students = await getAdminStudents();

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
          Read-only merged list from the Sheets identity lane plus registry portal lane.
        </p>
      </div>

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
            {students.map((student, index) => (
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
          </tbody>
        </table>
      </div>
    </div>
  );
}
