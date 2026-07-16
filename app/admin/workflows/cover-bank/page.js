import AdminCoverBankPageClient from '@/components/admin/AdminCoverBankPageClient';
import { getCoverBankWorkflow } from '@/lib/admin/cover-bank';

export default async function AdminCoverBankWorkflowPage() {
  const workflow = await getCoverBankWorkflow();

  return <AdminCoverBankPageClient initialWorkflow={workflow} />;
}
