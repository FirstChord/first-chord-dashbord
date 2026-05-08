import AdminHolidayWorkflowPageClient from '@/components/admin/AdminHolidayWorkflowPageClient';
import { getHolidayWorkflow } from '@/lib/admin/holiday-workflow-data';
import { hydrateHolidayWorkflow } from '@/lib/admin/holiday-workflow';

export default async function AdminHolidaysPage({ searchParams }) {
  const params = await searchParams;
  const workflow = await hydrateHolidayWorkflow(
    getHolidayWorkflow({
      season: params?.season || 'christmas',
      year: params?.year || '2026',
    }),
  );

  return <AdminHolidayWorkflowPageClient workflow={workflow} />;
}
