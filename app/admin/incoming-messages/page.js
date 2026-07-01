import AdminIncomingMessagesPageClient from '@/components/admin/AdminIncomingMessagesPageClient';
import { getIncomingMessageInbox, getWhatsappGroupMap } from '@/lib/admin/incoming-messages';

export default async function AdminIncomingMessagesPage() {
  let inbox = [];
  let groupMap = [];
  let error = '';
  try {
    [inbox, groupMap] = await Promise.all([
      getIncomingMessageInbox(),
      getWhatsappGroupMap(),
    ]);
  } catch (caught) {
    error = caught.message || 'Could not load incoming messages';
  }

  return <AdminIncomingMessagesPageClient initialInbox={inbox} initialGroupMap={groupMap} error={error} />;
}
