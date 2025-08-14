import Dashboard from '@/components/Dashboard';

async function getInitialData() {
  try {
    const mmsToken = process.env.MMS_DEFAULT_TOKEN;
    
    if (!mmsToken) {
      return {
        error: 'MMS token not configured',
        authenticated: false,
        students: []
      };
    }

    // Fetch students directly from MMS
    const response = await fetch('https://app.mymusicstaff.com/api/StudentAPI/Students', {
      headers: {
        'Authorization': `Bearer ${mmsToken}`,
        'Content-Type': 'application/json'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      return {
        error: 'Failed to fetch students',
        authenticated: true,
        students: []
      };
    }

    const data = await response.json();
    return {
      authenticated: true,
      students: data.ItemSubset || [],
      totalCount: data.TotalItemCount || 0
    };
  } catch (error) {
    console.error('Error fetching initial data:', error);
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
