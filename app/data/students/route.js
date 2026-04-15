// app/data/students/route.js

// Handle GET requests for fetching students
export async function GET() {
  // For now, return some test data to verify the endpoint works
  // Once we figure out the correct MMS API, we'll replace this
  
  const testData = {
    "ItemSubset": [
      {
        "ID": "sdt_test1",
        "FirstName": "Test",
        "LastName": "Student1", 
        "FullName": "Test Student1",
        "Email": {"EmailAddress": "test1@example.com"},
        "Status": "Active",
        "Active": true
      },
      {
        "ID": "sdt_test2", 
        "FirstName": "Test",
        "LastName": "Student2",
        "FullName": "Test Student2", 
        "Email": {"EmailAddress": "test2@example.com"},
        "Status": "Active",
        "Active": true
      }
    ],
    "TotalItemCount": 2
  };
  
  return Response.json(testData);
}

// Handle POST requests from MMS webhooks
export async function POST(request) {
  try {
    const body = await request.json();
    console.log('Webhook received:', body);
    
    // Store the webhook data or trigger an update
    // For now, just log it and return success
    return Response.json({ success: true, message: 'Webhook received' });
  } catch (error) {
    console.error('Webhook error:', error);
    return Response.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
