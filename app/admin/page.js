import { getAdminStudents } from '@/lib/admin/students';
import { getReviewFlagsRows } from '@/lib/admin/sheets';
import { getAdminHealthSummary } from '@/lib/admin/health';
import { formatDateTime } from '@/lib/admin/health-helpers.mjs';

function statusClasses(status) {
  if (status === 'Healthy' || status === 'Fresh') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'Running' || status === 'Aging') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (status === 'Failing' || status === 'Stale') return 'border-red-200 bg-red-50 text-red-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

export default async function AdminHomePage() {
  const [students, flags, health] = await Promise.all([getAdminStudents(), getReviewFlagsRows(), getAdminHealthSummary()]);

  const stats = [
    { label: 'Students in Sheets', value: students.length },
    { label: 'Flagged students', value: students.filter((student) => student.hasFlags).length },
    { label: 'Open review flags', value: flags.length },
  ];

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Operational view</p>
        <h2
          className="mt-2 text-3xl font-bold uppercase tracking-wide text-slate-800"
          style={{ fontFamily: '"Cooper Hewitt", "Nimbus Sans L", "Arial", sans-serif' }}
        >
          Overview
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          High-level admin control for onboarding, issues, and system health. Existing tutor and student dashboard routes are unchanged.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-[1.6rem] border border-blue-100 bg-white/90 p-6 shadow-[0_12px_36px_rgba(15,23,42,0.06)] backdrop-blur-sm">
            <p className="text-sm text-slate-500">{stat.label}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{stat.value}</p>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Operational health</h3>
          <p className="mt-1 text-sm text-slate-600">Current status of MMS, dashboard config generation, FC regeneration, and review-flag freshness.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: 'MMS API',
              status: health.mms.status,
              detail: health.mms.detail,
              updatedAt: health.mms.checkedAt,
            },
            {
              label: 'Generate Configs',
              status: health.configWorkflow.status,
              detail: health.configWorkflow.detail,
              updatedAt: health.configWorkflow.updatedAt,
              link: health.configWorkflow.htmlUrl,
            },
            {
              label: 'Regenerate FC IDs',
              status: health.fcWorkflow.status,
              detail: health.fcWorkflow.detail,
              updatedAt: health.fcWorkflow.updatedAt,
              link: health.fcWorkflow.htmlUrl,
            },
            {
              label: 'Review Flags Freshness',
              status: health.flagsFreshness.status,
              detail: health.flagsFreshness.statusDetail,
              updatedAt: health.flagsFreshness.latestGeneratedAt,
            },
          ].map((item) => (
            <div key={item.label} className="rounded-[1.6rem] border border-blue-100 bg-white/90 p-6 shadow-[0_12px_36px_rgba(15,23,42,0.06)] backdrop-blur-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-slate-500">{item.label}</p>
                <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusClasses(item.status)}`}>{item.status}</span>
              </div>
              <p className="mt-3 text-sm text-slate-700">{item.detail}</p>
              <p className="mt-4 text-xs text-slate-500">Last update: {formatDateTime(item.updatedAt)}</p>
              {item.link ? (
                <a href={item.link} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-medium text-slate-900 underline-offset-2 hover:underline">
                  Open workflow run
                </a>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
