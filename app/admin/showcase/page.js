import AdminShowcasePageClient from '@/components/admin/AdminShowcasePageClient';
import { getShowcaseWorkflow } from '@/lib/admin/showcase-data';
import { hydrateShowcaseWorkflow } from '@/lib/admin/showcase';

export default async function AdminShowcasePage({ searchParams }) {
  const params = await searchParams;
  const workflow = await hydrateShowcaseWorkflow(
    getShowcaseWorkflow({
      season: params?.season || 'summer',
      year: params?.year || '2026',
    }),
  );

  return <AdminShowcasePageClient workflow={workflow} />;
}
