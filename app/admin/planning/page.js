import Link from 'next/link';

const planningSections = [
  {
    href: '/admin/capacity',
    title: 'Capacity',
    description: 'MMS Free slots, tutor availability, waiting-list placement hints, and schedule-cache health.',
    status: 'Active context',
  },
  {
    href: '/admin/holidays',
    title: 'Holidays',
    description: 'School-break planning, pause follow-up, and seasonal admin preparation.',
    status: 'Seasonal',
  },
  {
    href: '/admin/showcase',
    title: 'Showcase',
    description: 'Event planning context, reusable copy, assets, and checklist state.',
    status: 'Seasonal',
  },
];

const futureLayers = [
  'Schedule hardening and stale-cache review',
  'Future tutor availability and recruitment capacity',
  'Payment value and operational finance context',
];

function PlanningCard({ section }) {
  return (
    <Link
      href={section.href}
      className="block rounded-[1.2rem] border border-blue-100 bg-white/90 p-5 shadow-[0_12px_36px_rgba(15,23,42,0.06)] transition hover:border-blue-200 hover:bg-white hover:shadow-[0_16px_44px_rgba(15,23,42,0.08)]"
    >
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-lg font-semibold text-slate-900">{section.title}</h3>
        <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-slate-600">
          {section.status}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{section.description}</p>
    </Link>
  );
}

export default function AdminPlanningPage() {
  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Capacity and forward view</p>
        <h2
          className="mt-2 text-3xl font-bold uppercase tracking-wide text-slate-800"
          style={{ fontFamily: '"Cooper Hewitt", "Nimbus Sans L", "Arial", sans-serif' }}
        >
          Planning
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Forward-looking context for capacity, schedule reliability, seasonal work, and future operating decisions.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {planningSections.map((section) => (
          <PlanningCard key={section.href} section={section} />
        ))}
      </section>

      <section className="rounded-[1.2rem] border border-blue-100 bg-white/85 p-5 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
        <h3 className="text-base font-semibold text-slate-900">Likely next planning layers</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {futureLayers.map((layer) => (
            <div key={layer} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {layer}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
