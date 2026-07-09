'use client';

import Link from 'next/link';
import { useState } from 'react';
import { labelCommunicationCategory } from '@/lib/admin/communications-helpers.mjs';

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function MessageBody({ text }) {
  const [expanded, setExpanded] = useState(false);
  const full = `${text || ''}`.trim();
  const lines = full.split(/\r?\n/);
  const isLong = lines.length > 4 || full.length > 320;
  const shown = expanded || !isLong ? full : `${lines.slice(0, 4).join('\n').slice(0, 320)}…`;
  return (
    <div className="mt-2">
      <p className="whitespace-pre-line text-sm leading-6 text-slate-700">{shown}</p>
      {isLong ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-1 text-xs font-semibold text-blue-700 hover:text-blue-900"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      ) : null}
    </div>
  );
}

export default function AdminCommunicationsPageClient({ log = [], error = '' }) {
  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Communication record</p>
        <h2
          className="mt-2 text-3xl font-bold uppercase tracking-wide text-slate-800"
          style={{ fontFamily: '"Cooper Hewitt", "Nimbus Sans L", "Arial", sans-serif' }}
        >
          Messages copied to send
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          A read-only record of parent messages copied to send from the dashboard (e.g. pause confirmations, parent check-ins).
          It confirms the copy action, not delivery, reading, or a parent response.
        </p>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {!error && !log.length ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          No messages recorded yet. When you copy a parent message (e.g. a pause confirmation), it will appear here.
        </div>
      ) : null}

      <div className="space-y-3">
        {log.map((entry) => (
          <article key={entry.messageId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">
                {labelCommunicationCategory(entry.category)}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 capitalize">
                {entry.channel}
              </span>
              <span className="text-xs text-slate-400">{formatDateTime(entry.loggedAt)}</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {entry.mmsId ? (
                <Link href={`/admin/students/${encodeURIComponent(entry.mmsId)}`} className="hover:text-blue-700">
                  {entry.studentName || entry.mmsId}
                </Link>
              ) : (
                entry.studentName || 'Unknown student'
              )}
            </p>
            <MessageBody text={entry.body} />
          </article>
        ))}
      </div>
    </div>
  );
}
