import { getCommunicationLog } from '@/lib/admin/communications';
import AdminCommunicationsPageClient from '@/components/admin/AdminCommunicationsPageClient';

export default async function AdminCommunicationsPage() {
  let log = [];
  let error = '';
  try {
    log = await getCommunicationLog();
  } catch (caught) {
    error = caught.message || 'Could not load the communication log';
  }
  return <AdminCommunicationsPageClient log={log} error={error} />;
}
