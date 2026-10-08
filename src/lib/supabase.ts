import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const hasSupabaseConfig = Boolean(url && key)
let client: SupabaseClient | null = null

export function getSupabase() {
  if (!hasSupabaseConfig || !url || !key) throw new Error('Add your Supabase URL and anonymous key to .env.local first.')
  if (!client) client = createClient(url, key, { auth: { flowType: 'pkce', autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } })
  return client
}
