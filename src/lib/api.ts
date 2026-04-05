import { supabase } from './supabaseClient'

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || '').trim()

export async function apiCall(path: string, options: RequestInit = {}) {
  const session = supabase
    ? (await supabase.auth.getSession()).data.session
    : null

  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Something went wrong')
  }

  return response.json()
}
