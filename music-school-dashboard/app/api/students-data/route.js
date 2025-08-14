export async function GET() {
  try {
    const mmsToken = process.env.MMS_DEFAULT_TOKEN;
    if (!mmsToken) {
      return Response.json({ error: 'MMS token not configured' }, { status: 500 });
    }

    const response = await fetch('https://app.mymusicstaff.com/api/StudentAPI/Students', {
      headers: {
        'Authorization': `Bearer ${mmsToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return Response.json({ error: 'MMS API error' }, { status: response.status });
    }

    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
