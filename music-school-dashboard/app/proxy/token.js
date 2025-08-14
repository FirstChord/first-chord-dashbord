// app/api/auth/mms/route.js
import { cookies } from 'next/headers'

// Store MMS token in httpOnly cookie
export async function POST(request) {
  try {
    const { token } = await request.json()
    
    if (!token) {
      return Response.json({ error: 'No token provided' }, { status: 400 })
    }
    
    // Store token in httpOnly cookie (secure in production)
    cookies().set('mms-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    })
    
    return Response.json({ success: true })
  } catch (error) {
    return Response.json({ error: 'Failed to store token' }, { status: 500 })
  }
}

// Get current token
export async function GET() {
  const token = cookies().get('mms-token')
  const defaultToken = process.env.MMS_DEFAULT_TOKEN
  
  // Check if we have either a stored token or default token
  if (!token && !defaultToken) {
    return Response.json({ authenticated: false }, { status: 401 })
  }
  
  return Response.json({ authenticated: true })
}
