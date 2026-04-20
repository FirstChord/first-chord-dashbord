import Link from 'next/link';
import { getWaitingStudents } from '@/lib/admin/mms';

function getAgeBadge(ageInDays) {
  if (ageInDays == null) {
    return { label: 'Unknown age', className: 'bg-slate-100 text-slate-700' };
  }

  if (ageInDays >= 90) {
    return { label: `${ageInDays} days`, className: 'bg-red-100 text-red-900' };
  }

  if (ageInDays >= 60) {
    return { label: `${ageInDays} days`, className: 'bg-amber-100 text-amber-900' };
  }

  return { label: `${ageInDays} days`, className: 'bg-emerald-100 text-emerald-900' };
}

function formatDate(dateString) {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default async function AdminWaitingPage() {
  const students = await getWaitingStudents();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Waiting List</h2>
        <p className="mt-2 text-sm text-slate-600">
          MMS students with status <code>Waiting</code>, newest first, limited to the last 120 days.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {['Student', 'Added', 'Age', 'Parent', 'Email', 'Action'].map((header) => (
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
            {students.map((student) => {
              const ageBadge = getAgeBadge(student.ageInDays);

              return (
                <tr key={student.mmsId} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{student.fullName || student.mmsId}</div>
                    <div className="text-xs text-slate-500">{student.mmsId}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{formatDate(student.dateStarted)}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ageBadge.className}`}>
                      {ageBadge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{student.parentName || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{student.parentEmail || '—'}</td>
                  <td className="px-4 py-3 text-sm">
                    <Link
                      href={`/admin/onboard?mmsId=${encodeURIComponent(student.mmsId)}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      Onboard
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
