import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { WORKFLOW_DIRECTORY_GROUPS } from '@/lib/admin/workflow-directory.mjs';

function WorkflowLink({ item }) {
  return (
    <Link
      href={item.href}
      className="group flex min-h-16 items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-blue-50/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2F6B3D]/45"
    >
      <div className="min-w-0">
        <h4 className="text-sm font-semibold text-slate-900 group-hover:text-[#2F6B3D]">{item.title}</h4>
        <p className="mt-0.5 text-sm leading-5 text-slate-600">{item.description}</p>
      </div>
      <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[#2F6B3D]" />
    </Link>
  );
}

function WorkflowGroup({ group }) {
  return (
    <section className="overflow-hidden rounded-[1.2rem] border border-blue-100 bg-white/90 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
      <header className="border-b border-blue-100/80 bg-blue-50/35 px-5 py-4">
        <h3 className="text-base font-semibold text-slate-900">{group.title}</h3>
        <p className="mt-1 text-sm text-slate-600">{group.description}</p>
      </header>
      <ul className="divide-y divide-blue-100/80">
        {group.items.map((item) => (
          <li key={item.href}>
            <WorkflowLink item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function AdminWorkflowsPage() {
  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">School operations</p>
        <h2
          className="mt-2 fc-display text-3xl text-slate-900"
        >
          Workflows
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Choose the kind of school work you need to do.
        </p>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        {WORKFLOW_DIRECTORY_GROUPS.map((group) => (
          <WorkflowGroup key={group.title} group={group} />
        ))}
      </div>
    </div>
  );
}
