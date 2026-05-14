import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import { buildIssueStateChange } from '@/lib/admin/issue-queue';
import { appendEventLogRows, getIssueQueueRows, upsertIssueQueueRows } from '@/lib/admin/sheets';

export async function POST(request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const issueIds = Array.isArray(body?.issueIds)
    ? body.issueIds.map((issueId) => `${issueId || ''}`.trim()).filter(Boolean)
    : [];

  if (!issueIds.length) {
    return Response.json({ error: 'issueIds are required' }, { status: 400 });
  }

  try {
    const queueRows = await getIssueQueueRows();
    const queueById = new Map(queueRows.map((row) => [row.issueId, row]));
    const now = new Date().toISOString();
    const nextRows = [];
    const eventRows = [];
    const resolvedIssues = [];

    for (const issueId of issueIds) {
      const issueRow = queueById.get(issueId);

      if (
        !issueRow ||
        !['open', 'acknowledged'].includes(issueRow.status) ||
        issueRow.sourcePresent === 'true'
      ) {
        continue;
      }

      const { nextRow, eventRow } = buildIssueStateChange({
        issueRow,
        nextStatus: 'resolved',
        note: 'System-cleared issue bulk resolved from dashboard.',
        actorEmail: session.user.email || '',
        now,
      });

      nextRows.push(nextRow);
      eventRows.push(eventRow);
      resolvedIssues.push({
        issueId: nextRow.issueId,
        mmsId: nextRow.mmsId,
        status: nextRow.status,
        sourcePresent: nextRow.sourcePresent === 'true',
        resolutionNote: nextRow.resolutionNote || '',
        updatedAt: nextRow.updatedAt,
      });
    }

    await upsertIssueQueueRows(nextRows);
    await appendEventLogRows(eventRows);

    return Response.json({
      success: true,
      resolvedCount: resolvedIssues.length,
      issues: resolvedIssues,
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Bulk issue update failed' }, { status: 500 });
  }
}
