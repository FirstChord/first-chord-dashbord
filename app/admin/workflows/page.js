import Link from 'next/link';

const workflowSections = [
  {
    href: '/admin/waiting',
    title: 'Waiting List',
    description: 'Move enquiries from waiting state toward welcome group, placement, and onboarding.',
    status: 'Active workflow',
  },
  {
    href: '/admin/onboard',
    title: 'Onboarding',
    description: 'Create the operational records, registry entry, MMS setup, and first lesson for a new student.',
    status: 'Action flow',
  },
  {
    href: '/admin/showcase',
    title: 'Showcase',
    description: 'Recurring showcase checklist, message copy, assets, and planning state.',
    status: 'Recurring',
  },
  {
    href: '/admin/holidays',
    title: 'Holidays',
    description: 'Seasonal admin checklist for school breaks, pauses, and related communication.',
    status: 'Recurring',
  },
];

function WorkflowCard({ section }) {
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

export default function AdminWorkflowsPage() {
  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Process surfaces</p>
        <h2
          className="mt-2 text-3xl font-bold uppercase tracking-wide text-slate-800"
          style={{ fontFamily: '"Cooper Hewitt", "Nimbus Sans L", "Arial", sans-serif' }}
        >
          Workflows
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Action-led admin areas for moving work from intent to completion. Student detail remains available through issue links, workflow cards, and the header search.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {workflowSections.map((section) => (
          <WorkflowCard key={section.href} section={section} />
        ))}
      </section>
    </div>
  );
}
