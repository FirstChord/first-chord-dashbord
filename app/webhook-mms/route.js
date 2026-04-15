// app/webhook-mms/route.js
export async function POST(request) {
  try {
    const body = await request.json();
    console.log('MMS Webhook received:', body);
    
    // Store the webhook data or trigger an update
    // For now, just log it and return success
    return Response.json({ 
      success: true, 
      message: 'MMS webhook received successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return Response.json({ 
      error: 'Webhook processing failed',
      details: error.message 
    }, { status: 500 });
  }
}

// Also support GET for testing
export async function GET() {
  return Response.json({ 
    status: 'Webhook endpoint active',
    timestamp: new Date().toISOString()
  });
}
