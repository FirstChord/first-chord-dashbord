import { verifyStatementToken } from '@/lib/admin/tutor-statement-helpers.mjs';
import { loadTutorStatement } from '@/lib/admin/tutor-statement';
import TutorStatementView from '@/components/finance/TutorStatementView';

export const dynamic = 'force-dynamic';

// Public, read-only tutor statement reached via a signed link (no login). The
// token proves "this tutor, this reviewed row"; the page only renders — no
// writes, no money movement. (Phase 2 will add a Confirm button here.)
export default async function PublicStatementPage({ params }) {
  const { token } = await params;
  const secret = process.env.NEXTAUTH_SECRET || '';
  const payload = verifyStatementToken(token, secret);

  const result = payload?.pid ? await loadTutorStatement({ payrollId: payload.pid }) : { notFound: true };
  const ok = payload && result.statement;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-4 py-10">
      {ok ? (
        <>
          <TutorStatementView statement={result.statement} />
          <p className="text-center text-xs text-slate-400">
            Read-only statement from First Chord Music School. Payment is processed separately.
          </p>
        </>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white/90 p-8 text-center text-sm text-slate-500">
          <p className="text-lg font-semibold text-slate-700">This statement link isn’t valid</p>
          <p className="mt-2">It may have expired or been mistyped. Ask First Chord for a fresh link.</p>
        </div>
      )}
    </main>
  );
}
