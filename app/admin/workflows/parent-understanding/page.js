import AdminParentUnderstandingPageClient from '@/components/admin/AdminParentUnderstandingPageClient';
import { getParentUnderstandingWorkflow } from '@/lib/admin/parent-understanding';

export default async function AdminParentUnderstandingWorkflowPage() {
  const workflow = await getParentUnderstandingWorkflow();

  return <AdminParentUnderstandingPageClient initialWorkflow={workflow} />;
}
