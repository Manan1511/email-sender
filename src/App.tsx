import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { CircleNotch } from '@phosphor-icons/react'
import { getSupabase, hasSupabaseConfig } from './lib/supabase'
import { Welcome } from './components/Welcome'
import { Workspace } from './components/Workspace'
import './App.css'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(!hasSupabaseConfig)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!hasSupabaseConfig) return
    let mounted = true
    const client = getSupabase()
    client.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return
      setSession(data.session); setError(sessionError?.message || ''); setReady(true)
    }).catch((reason: unknown) => { if (mounted) { setError(reason instanceof Error ? reason.message : 'Could not restore sign-in.'); setReady(true) } })
    const { data: listener } = client.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => { mounted = false; listener.subscription.unsubscribe() }
  }, [])

  const signIn = async () => {
    setBusy(true); setError('')
    try { await getSupabase().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin, scopes: 'openid email profile', queryParams: { prompt: 'select_account' } } }) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Google sign-in could not start.') }
    finally { setBusy(false) }
  }

  if (!ready) return <main className="auth-loading"><CircleNotch className="spin" size={18} /> Opening your workspace</main>
  return session ? <Workspace session={session} /> : <Welcome error={error} busy={busy} onSignIn={signIn} />
}

export default App
