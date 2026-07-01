import AdminIncomingMessagesPageClient from '@/components/admin/AdminIncomingMessagesPageClient';
import { getIncomingMessageInbox } from '@/lib/admin/incoming-messages';

export default async function AdminIncomingMessagesPage() {
  let inbox = [];
  let error = '';
  try {
    inbox = await getIncomingMessageInbox();
  } catch (caught) {
    error = caught.message || 'Could not load incoming messages';
  }

  return <AdminIncomingMessagesPageClient initialInbox={inbox} error={error} />;
}
