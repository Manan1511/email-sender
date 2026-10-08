import { useEffect, useState } from 'react'
import { ArrowRight, Check, Envelope, GoogleLogo, Info, LockKey, Sparkle, WarningCircle } from '@phosphor-icons/react'
import { Button } from '../components/ui/button'
import { hasSupabaseConfig } from '../lib/supabase'

export function Welcome({ error, busy, onSignIn }: { error: string; busy: boolean; onSignIn: () => void }) {
  const [gmailError, setGmailError] = useState('')
  useEffect(() => {
    const query = new URLSearchParams(location.search)
    if (query.get('gmail') === 'error') setGmailError(query.get('message') || 'Gmail could not connect.')
    if (query.has('gmail')) history.replaceState({}, '', location.pathname)
  }, [])
  return <main className="auth-page">
    <section className="auth-story">
      <div className="auth-brand"><span className="brand-mark"><Envelope weight="duotone" /></span><span>Email Sender</span></div>
      <div className="auth-story-copy"><span className="eyebrow light"><i /> CSI VIT · SPONSORSHIP OUTREACH</span><h1>Good partnerships<br />start with a <em>good note.</em></h1><p>Thoughtful, one-to-one sponsor outreach. Prepared in batches, sent from your own Gmail.</p></div>
      <div className="auth-letter" aria-hidden="true"><div className="letter-top"><span className="letter-badge"><Sparkle size={13} weight="fill" /> PERSONALIZED</span><span className="letter-dots"><i /><i /><i /></span></div><div className="letter-to"><span className="letter-avatar">A</span><span><small>TO</small><b>Asha Mehta</b><em>Acme Labs</em></span><span className="letter-check"><Check size={14} weight="bold" /></span></div><div className="letter-lines"><i /><i /><i /><i /><i /><b /></div><div className="letter-footer"><span>ForkThis × Acme Labs</span><span>Ready to review</span></div></div>
      <div className="auth-meta"><span>Private by design</span><span>Built for your team</span><span>Free-tier friendly</span></div>
    </section>
    <section className="auth-panel"><div className="auth-panel-inner"><span className="eyebrow">YOUR OUTREACH DESK</span><h2>Sign in to get started</h2><p>Use your Google account to open your private workspace. Gmail sending is connected separately when you’re ready.</p>
      {!hasSupabaseConfig && <div className="setup-note"><Info size={18} /><div><b>Workspace setup needed</b><span>Add your Supabase keys to <code>.env.local</code>, then restart. Setup steps are in the README.</span></div></div>}
      {(error || gmailError) && <div className="inline-alert error"><WarningCircle size={17} />{gmailError || error}</div>}
      <Button className="google-button" size="lg" disabled={!hasSupabaseConfig || busy} onClick={onSignIn}><GoogleLogo size={19} weight="bold" /> Continue with Google <ArrowRight size={17} /></Button>
      <div className="auth-separator"><span /> SEPARATE SENDER PERMISSION <span /></div>
      <div className="auth-step"><span>1</span><div><b>Sign in to your workspace</b><small>Your private profile, templates, and history.</small></div></div><div className="auth-step"><span>2</span><div><b>Connect the Gmail you send from</b><small>Only send permission. Your address stays read-only.</small></div></div>
      <div className="auth-privacy"><LockKey size={15} /> Connections and recipient lists stay private to your account.</div><div className="auth-links"><a href="/privacy.html">Privacy</a><span>·</span><a href="/terms.html">Terms</a></div>
    </div></section>
  </main>
}
