import { verifyStatementToken } from '@/lib/admin/tutor-statement-helpers.mjs';
import { recordTutorStatementResponse } from '@/lib/admin/tutor-statement';

export const dynamic = 'force-dynamic';

// Public endpoint for a tutor confirming/disputing their statement (Phase 2).
// No login — the signed token IS the identity (it proved "this tutor, this
// reviewed row"). It never moves money; it only records the response so the
// admin sees it on the payroll board before approving the batch.
// (Outside the middleware matcher, so reachable without an admin session.)
export async function POST(request) {
  const secret = process.env.NEXTAUTH_SECRET || '';
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Bad request' }, { status: 400 });
  }

  const payload = verifyStatementToken(`${body?.token || ''}`, secret);
  if (!payload?.pid) {
    return Response.json({ ok: false, error: 'This statement link is not valid or has expired.' }, { status: 401 });
  }

  const result = await recordTutorStatementResponse({
    payrollId: payload.pid,
    response: body?.response,
    note: body?.note,
  });

  if (!result.ok) {
    const message = result.reason === 'already_paid'
      ? 'This pay run has already been settled.'
      : result.reason === 'not_found'
        ? 'We could not find this statement any more.'
        : 'That response could not be recorded.';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }

  return Response.json({ ok: true, response: result.response });
}
