export async function GET() {
  return new Response(JSON.stringify({ ok: true, message: "Test API working" }), { 
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}
