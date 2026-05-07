import { randomUUID } from 'node:crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import { deleteRegistryEntry } from '@/lib/admin/registry';
import { createRegistryEntryForStudent } from '@/lib/admin/students';
import { appendEventLogRow, getIssueQueueRows, upsertIssueQueueRow } from '@/lib/admin/sheets';

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { issueType, issueId = '' } = await request.json();

  if (issueType !== 'REGISTRY ONLY') {
    return Response.json({ error: 'Delete is only supported for REGISTRY ONLY issues right now.' }, { status: 400 });
  }

  try {
    const result = await deleteRegistryEntry(params.mmsId);
    if (issueId) {
      const queueRows = await getIssueQueueRows();
      const queueRow = queueRows.find((row) => row.issueId === issueId);

      if (queueRow) {
        const now = new Date().toISOString();
        await upsertIssueQueueRow({
          ...queueRow,
          status: 'resolved',
          sourcePresent: 'false',
          updatedAt: now,
          resolvedAt: queueRow.resolvedAt || now,
        });

        await appendEventLogRow({
          eventId: randomUUID(),
          occurredAt: now,
          actorEmail: session.user.email || '',
          entityType: 'issue',
          entityId: issueId,
          eventType: 'registry_deleted',
          mmsId: queueRow.mmsId || params.mmsId,
          studentName: queueRow.studentName || '',
          issueId,
          payloadJson: JSON.stringify({
            previous_status: queueRow.status || 'open',
            next_status: 'resolved',
            source_present_before: queueRow.sourcePresent || 'true',
            source_present_after: 'false',
            action: 'delete_registry_entry',
          }),
        });
      }
    }
    return Response.json({ success: true, result });
  } catch (error) {
    return Response.json({ error: error.message || 'Delete failed' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { issueType, issueId = '', action = '' } = await request.json();

  if (issueType !== 'SHEETS ONLY' || action !== 'create_registry_entry') {
    return Response.json({ error: 'Create registry entry is only supported for SHEETS ONLY issues right now.' }, { status: 400 });
  }

  try {
    const student = await createRegistryEntryForStudent(params.mmsId);
    if (issueId) {
      const queueRows = await getIssueQueueRows();
      const queueRow = queueRows.find((row) => row.issueId === issueId);

      if (queueRow) {
        const now = new Date().toISOString();
        await upsertIssueQueueRow({
          ...queueRow,
          status: 'resolved',
          sourcePresent: 'false',
          updatedAt: now,
          resolvedAt: queueRow.resolvedAt || now,
        });

        await appendEventLogRow({
          eventId: randomUUID(),
          occurredAt: now,
          actorEmail: session.user.email || '',
          entityType: 'issue',
          entityId: issueId,
          eventType: 'registry_created',
          mmsId: queueRow.mmsId || params.mmsId,
          studentName: queueRow.studentName || student?.fullName || '',
          issueId,
          payloadJson: JSON.stringify({
            previous_status: queueRow.status || 'open',
            next_status: 'resolved',
            source_present_before: queueRow.sourcePresent || 'true',
            source_present_after: 'false',
            action: 'create_registry_entry',
          }),
        });
      }
    }

    return Response.json({ success: true, student });
  } catch (error) {
    return Response.json({ error: error.message || 'Create registry entry failed' }, { status: 500 });
  }
}
