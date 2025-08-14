import Dashboard from '@/components/Dashboard';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

async function getInitialData() {
  try {
    // Try to get token from environment
    const mmsToken = process.env.MMS_DEFAULT_TOKEN;
    
    if (!mmsToken) {
      return {
        error: 'MMS token not configured',
        authenticated: false,
        students: []
      };
    }

    // Return basic auth status without trying to fetch students at build time
    return {
      authenticated: true,
      students: [],
      totalCount: 0
    };
  } catch (error) {
    console.error('Error in getInitialData:', error);
    return {
      error: error.message,
      authenticated: false,
      students: []
    };
  }
}

export default async function DashboardPage() {
  const initialData = await getInitialData();
  
  return <Dashboard initialData={initialData} />;
}
