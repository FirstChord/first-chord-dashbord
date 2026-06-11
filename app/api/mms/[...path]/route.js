// app/api/mms/[...path]/route.js
import { cookies } from 'next/headers'
import { getMmsBearerToken } from '@/lib/mms-token'

const MMS_BASE_URL = process.env.MMS_API_URL || 'https://api.mymusicstaff.com'

export async function GET(request, { params }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('mms-token')
  const defaultToken = getMmsBearerToken()
  
  // Use stored token or fall back to default token
  const authToken = token?.value || defaultToken
  
  if (!authToken) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }
  
  const path = params.path.join('/')
  const url = new URL(request.url)
  const queryString = url.search
  
  try {
    const response = await fetch(`${MMS_BASE_URL}/${path}${queryString}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    })
    
    const data = await response.json()
    return Response.json(data, { status: response.status })
  } catch (error) {
    return Response.json({ error: 'MMS API request failed' }, { status: 500 })
  }
}

export async function POST(request, { params }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('mms-token')
  const defaultToken = getMmsBearerToken()
  
  // Use stored token or fall back to default token
  const authToken = token?.value || defaultToken
  
  if (!authToken) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }
  
  const body = await request.json()
  const path = params.path.join('/')
  
  try {
    const response = await fetch(`${MMS_BASE_URL}/${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
    
    const data = await response.json()
    return Response.json(data, { status: response.status })
  } catch (error) {
    return Response.json({ error: 'MMS API request failed' }, { status: 500 })
  }
}
