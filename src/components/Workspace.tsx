import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Contact, ContactTable } from '../lib/contacts'
import { parseCsv, validateContacts } from '../lib/contacts'
import { personalizeDraft, type SenderProfile } from '../lib/personalize'
import { starterBody, starterSubject } from '../lib/starter'
import { api, downloadBatchCsv } from '../lib/api'
import { getSupabase } from '../lib/supabase'
import { Button } from './ui/button'
import {
  ArrowLeft, ArrowRight, ArrowSquareOut, ArrowsClockwise, CaretDown, CaretRight, ChartBar, Check,
  CheckCircle, CircleNotch, CloudArrowUp, Envelope, FileCsv, FileText, GearSix, GoogleLogo, House,
  Info, LockKey, Paperclip, PaperPlaneTilt, Plus, SignOut, Trash, WarningCircle, X,
} from '@phosphor-icons/react'

const RichEditor = lazy(() => import('./RichEditor').then((module) => ({ default: module.RichEditor })))

type Page = 'workspace' | 'templates' | 'history' | 'account'
type Step = 'contacts' | 'compose' | 'review' | 'results'
type Profile = SenderProfile
type GmailConnection = { email: string; reconnectRequired: boolean; connectedAt?: string } | null
type Template = { id: string; name: string; subject: string; bodyHtml: string; updatedAt: string }
type StoredAttachment = { id: string; name: string; mimeType: string; size: number; createdAt?: string }
type Batch = { id: string; status: string; created_at: string; completed_at?: string | null; total_count: number; success_count: number; failed_count: number; needs_review_count: number; skipped_count: number; subject_template: string; error_message?: string | null }
type BatchRecipient = { id: string; company_name: string; poc_name: string; email: string; source_row: number; status: string; reason?: string | null; attempt_count: number; gmail_message_id?: string | null; updated_at: string }
type PreviewRow = Contact & { personalized: ReturnType<typeof personalizeDraft>; previewStatus: 'ready' | 'skipped'; previewReason?: string }
const stepList: Array<{ id: Step; title: string; subtitle: string }> = [
  { id: 'contacts', title: 'Contacts', subtitle: 'Import and check your list' },
  { id: 'compose', title: 'Compose', subtitle: 'Write and personalize' },
  { id: 'review', title: 'Review', subtitle: 'Preview before sending' },
]
export function Workspace({ session }: { session: Session }) {
  const [page, setPage] = useState<Page>('workspace')
  const [step, setStep] = useState<Step>('contacts')
  const [table, setTable] = useState<ContactTable | null>(null)
  const [sourceName, setSourceName] = useState('')
  const [sheets, setSheets] = useState<Array<{ name: string; table: ContactTable }>>([])
  const [sheetName, setSheetName] = useState('')
  const [emailHeader, setEmailHeader] = useState<string | null>(null)
  const [fileError, setFileError] = useState('')
  const [subject, setSubject] = useState(starterSubject)
  const [bodyHtml, setBodyHtml] = useState(starterBody)
  const [profile, setProfile] = useState<Profile>({ name: '', email: session.user.email || '', phone: '' })
  const [profileSaved, setProfileSaved] = useState(false)
  const [gmail, setGmail] = useState<GmailConnection>(null)
  const [library, setLibrary] = useState<StoredAttachment[]>([])
  const [attachments, setAttachments] = useState<StoredAttachment[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [history, setHistory] = useState<Batch[]>([])
  const [batch, setBatch] = useState<Batch | null>(null)
  const [recipients, setRecipients] = useState<BatchRecipient[]>([])
  const [previewIndex, setPreviewIndex] = useState(0)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [ackRisk, setAckRisk] = useState(false)
  const [notice, setNotice] = useState('')
  const [noticeType, setNoticeType] = useState<'success' | 'error' | 'info'>('info')
  const [busy, setBusy] = useState(false)
  const [savePanel, setSavePanel] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const contactsInput = useRef<HTMLInputElement>(null)
  const attachmentInput = useRef<HTMLInputElement>(null)
  const contactResult = useMemo(() => {
    if (!table) return { contacts: [] as Contact[], error: '' }
    try { return { contacts: validateContacts(table, emailHeader), error: '' } }
    catch (error) { return { contacts: [] as Contact[], error: error instanceof Error ? error.message : 'Could not validate contacts.' } }
  }, [table, emailHeader])
  const contacts = contactResult.contacts
  const sender = useMemo(() => ({ ...profile, email: gmail?.email || profile.email }), [profile, gmail])
  const previews: PreviewRow[] = useMemo(() => contacts.map((contact) => {
    const personalized = personalizeDraft(subject, bodyHtml, contact, sender)
    const missing = personalized.missing.length ? `Missing value for ${personalized.missing.map((name) => `[${name}]`).join(', ')}.` : ''
    const previewStatus = contact.status === 'ready' && !missing ? 'ready' : 'skipped'
    return { ...contact, personalized, previewStatus, previewReason: contact.reason || missing || undefined }
  }), [contacts, subject, bodyHtml, sender])
  const readyCount = previews.filter((item) => item.previewStatus === 'ready').length
  const skippedCount = previews.length - readyCount
  const selectedPreview = previews[Math.min(previewIndex, Math.max(0, previews.length - 1))]
  const currentStep = stepList.findIndex((item) => item.id === step) + 1
  const totalAttachmentSize = attachments.reduce((sum, file) => sum + file.size, 0)
  const placeholderNames = useMemo(() => [...new Set([...(table?.headers || []), 'Company Name', 'POC Name', 'Designation', 'Your Name', 'Your Email', 'Your Phone Number'])], [table])

  const toast = (message: string, type: 'success' | 'error' | 'info' = 'info') => { setNotice(message); setNoticeType(type) }

  const loadData = useCallback(async () => {
    const [account, gmailStatus, templateData, fileData, historyData] = await Promise.all([
      api<{ profile: Profile; gmail: GmailConnection }>('profile'), api<{ connection: GmailConnection }>('gmail-status'),
      api<{ templates: Template[] }>('templates'), api<{ attachments: StoredAttachment[] }>('attachments'), api<{ batches: Batch[] }>('batches'),
    ])
    setProfile(account.profile); setProfileSaved(Boolean(account.profile.name)); setGmail(gmailStatus.connection || account.gmail)
    setTemplates(templateData.templates); setLibrary(fileData.attachments); setHistory(historyData.batches)
  }, [])

  useEffect(() => {
    loadData().catch((error: unknown) => toast(error instanceof Error ? error.message : 'Could not load your workspace.', 'error'))
    const query = new URLSearchParams(location.search)
    if (query.get('gmail') === 'connected') toast('Gmail connected. Your sender address is ready.', 'success')
    if (query.has('gmail')) window.history.replaceState({}, '', location.pathname)
    // Load private workspace data once per signed-in session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadData])

  useEffect(() => {
    if (!batch?.id || !['queued', 'sending'].includes(batch.status)) return
    let mounted = true
    const refresh = async () => {
      try {
        const result = await api<{ batch: Batch; recipients: BatchRecipient[] }>(`batch-status?id=${encodeURIComponent(batch.id)}`)
        if (!mounted) return
        setBatch(result.batch); setRecipients(result.recipients)
        setHistory((items) => [result.batch, ...items.filter((item) => item.id !== result.batch.id)])
      } catch { /* last saved status remains visible while offline */ }
    }
    const interval = window.setInterval(() => void refresh(), 2500)
    void refresh()
    return () => { mounted = false; window.clearInterval(interval) }
  }, [batch?.id, batch?.status])

  const parseContactsFile = async (file?: File) => {
    if (!file) return
    setBusy(true); setFileError('')
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('Contact files must be 5 MB or smaller.')
      const extension = file.name.toLowerCase().split('.').pop()
      let next: ContactTable
      if (extension === 'csv') {
        next = parseCsv(await file.text()); setSheets([]); setSheetName('')
      } else if (extension === 'xlsx') {
        const { readWorkbook } = await import('../lib/spreadsheet')
        const workbook = await readWorkbook(file)
        if (!workbook.length) throw new Error('No worksheets with contact data were found.')
        setSheets(workbook); setSheetName(workbook[0].name); next = workbook[0].table
      } else throw new Error('Choose a .csv or .xlsx contact file.')
      const guessed = next.headers.find((header) => ['email', 'emailid', 'emailaddress', 'recipientemail'].includes(header.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, ''))) || null
      setTable(next); setEmailHeader(guessed); setSourceName(file.name); setPreviewIndex(0)
    } catch (error) { setFileError(error instanceof Error ? error.message : 'Could not read this contact file.') }
    finally { setBusy(false); if (contactsInput.current) contactsInput.current.value = '' }
  }

  const chooseSheet = (name: string) => {
    const selected = sheets.find((item) => item.name === name)
    if (!selected) return
    setSheetName(name); setTable(selected.table); setPreviewIndex(0)
    const guessed = selected.table.headers.find((header) => ['email', 'emailid', 'emailaddress', 'recipientemail'].includes(header.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, ''))) || null
    setEmailHeader(guessed)
  }

  const saveProfile = async () => {
    setBusy(true)
    try { const result = await api<{ profile: Profile }>('profile', { method: 'PUT', body: { name: profile.name, phone: profile.phone } }); setProfile(result.profile); setProfileSaved(true); toast('Sender details saved privately.', 'success') }
    catch (error) { toast(error instanceof Error ? error.message : 'Could not save sender details.', 'error') }
    finally { setBusy(false) }
  }

  const connectGmail = async () => {
    setBusy(true)
    try { const result = await api<{ url: string }>('gmail-connect', { method: 'POST', body: {} }); location.assign(result.url) }
    catch (error) { toast(error instanceof Error ? error.message : 'Could not connect Gmail.', 'error'); setBusy(false) }
  }

  const disconnectGmail = async () => {
    setBusy(true)
    try { await api('gmail-disconnect', { method: 'DELETE' }); setGmail(null); toast('Gmail disconnected.', 'success') }
    catch (error) { toast(error instanceof Error ? error.message : 'Could not disconnect Gmail.', 'error') }
    finally { setBusy(false) }
  }

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    try {
      let size = totalAttachmentSize
      for (const file of Array.from(files)) {
        if (size + file.size > 10 * 1024 * 1024) throw new Error('Attachments for this campaign must total 10 MB or less.')
        const result = await api<{ attachment: { id: string; path: string; token: string; name: string; mimeType: string; size: number } }>('attachments', { method: 'POST', body: { name: file.name, mimeType: file.type || 'application/octet-stream', size: file.size } })
        const { error } = await getSupabase().storage.from('attachments').uploadToSignedUrl(result.attachment.path, result.attachment.token, file, { contentType: file.type || 'application/octet-stream', upsert: false })
        if (error) { await api(`attachments?id=${encodeURIComponent(result.attachment.id)}`, { method: 'DELETE' }); throw new Error(error.message || 'Could not upload this file.') }
        const finalized = await api<{ uploaded: boolean; size: number }>(`attachments?id=${encodeURIComponent(result.attachment.id)}`, { method: 'PUT' })
        const saved = { id: result.attachment.id, name: result.attachment.name, mimeType: result.attachment.mimeType, size: result.attachment.size }
        const actual = { ...saved, size: finalized.size || saved.size }
        setLibrary((items) => [actual, ...items.filter((item) => item.id !== actual.id)])
        setAttachments((items) => [...items, actual]); size += actual.size
      }
      toast('File uploaded to private storage.', 'success')
    } catch (error) { toast(error instanceof Error ? error.message : 'Could not upload attachments.', 'error') }
    finally { setBusy(false); if (attachmentInput.current) attachmentInput.current.value = '' }
  }

  const deleteAttachment = async (file: StoredAttachment) => {
    try { await api(`attachments?id=${encodeURIComponent(file.id)}`, { method: 'DELETE' }); setLibrary((items) => items.filter((item) => item.id !== file.id)); setAttachments((items) => items.filter((item) => item.id !== file.id)); toast('Attachment deleted.', 'success') }
    catch (error) { toast(error instanceof Error ? error.message : 'Could not delete this attachment.', 'error') }
  }

  const saveTemplate = async () => {
    try {
      const result = await api<{ template: Template }>('templates', { method: 'POST', body: { name: templateName, subject, bodyHtml } })
      setTemplates((items) => [result.template, ...items.filter((item) => item.id !== result.template.id)])
      setTemplateName(''); setSavePanel(false); toast('Template saved to your private library.', 'success')
    } catch (error) { toast(error instanceof Error ? error.message : 'Could not save this template.', 'error') }
  }

  const useTemplate = (template: Template) => { setSubject(template.subject); setBodyHtml(template.bodyHtml); setPage('workspace'); setStep('compose'); toast(`Loaded “${template.name}”.`, 'success') }

  const sendTest = async () => {
    if (!selectedPreview || selectedPreview.previewStatus !== 'ready') return
    setBusy(true)
    try { await api('batch-test', { method: 'POST', body: { subject: selectedPreview.personalized.subject, bodyHtml: selectedPreview.personalized.bodyHtml, attachmentIds: attachments.map((file) => file.id) } }); toast(`Test email sent to ${sender.email}.`, 'success') }
    catch (error) { toast(error instanceof Error ? error.message : 'Test email could not be sent.', 'error') }
    finally { setBusy(false) }
  }

  const startBatch = async () => {
    if (!table || !readyCount) return
    setBusy(true); setConfirmOpen(false)
    try {
      const result = await api<{ batchId: string; dispatched: boolean; validCount: number; skippedCount: number }>('batch-start', {
        method: 'POST', body: { table, emailHeader, subject, bodyHtml, attachmentIds: attachments.map((file) => file.id), idempotencyKey: crypto.randomUUID() },
      })
      const summary: Batch = { id: result.batchId, status: 'queued', created_at: new Date().toISOString(), total_count: result.validCount + result.skippedCount, success_count: 0, failed_count: 0, needs_review_count: 0, skipped_count: result.skippedCount, subject_template: subject }
      setBatch(summary); setRecipients([]); setHistory((items) => [summary, ...items.filter((item) => item.id !== summary.id)]); setPage('workspace'); setStep('results'); setSelectedIds([]); setAckRisk(false)
      toast(result.dispatched ? 'Batch accepted. Sending continues if you close this page.' : 'Batch saved. The recovery worker will start it shortly.', 'success')
    } catch (error) { toast(error instanceof Error ? error.message : 'The batch could not be started.', 'error') }
    finally { setBusy(false) }
  }

  const openBatch = async (item: Batch) => {
    setBusy(true)
    try { const result = await api<{ batch: Batch; recipients: BatchRecipient[] }>(`batch-status?id=${encodeURIComponent(item.id)}`); setBatch(result.batch); setRecipients(result.recipients); setPage('workspace'); setStep('results'); setSelectedIds([]) }
    catch (error) { toast(error instanceof Error ? error.message : 'Could not open this batch.', 'error') }
    finally { setBusy(false) }
  }

  const retryBatch = async (includeUncertain: boolean) => {
    if (!batch) return
    const eligible = selectedIds.filter((id) => {
      const row = recipients.find((item) => item.id === id)
      return row?.status === 'failed' || (includeUncertain && row?.status === 'needs_review')
    })
    if (!eligible.length) { toast('Select at least one confirmed failure.', 'info'); return }
    setBusy(true)
    try { await api('batch-retry', { method: 'POST', body: { batchId: batch.id, recipientIds: eligible, acknowledgeDuplicateRisk: includeUncertain } }); setBatch({ ...batch, status: 'queued' }); setSelectedIds([]); setAckRisk(false); toast('Selected recipients were queued for retry.', 'success') }
    catch (error) { toast(error instanceof Error ? error.message : 'Could not retry these recipients.', 'error') }
    finally { setBusy(false) }
  }

  const resumeBatch = async () => {
    if (!batch) return
    setBusy(true)
    try { await api('batch-resume', { method: 'POST', body: { batchId: batch.id } }); setBatch({ ...batch, status: 'queued' }); toast('Batch resumed.', 'success') }
    catch (error) { toast(error instanceof Error ? error.message : 'Could not resume this batch.', 'error') }
    finally { setBusy(false) }
  }

  const exportResults = async () => {
    if (!batch) return
    try { const blob = await downloadBatchCsv(batch.id); const href = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = href; link.download = `email-batch-${batch.id}.csv`; link.click(); URL.revokeObjectURL(href) }
    catch (error) { toast(error instanceof Error ? error.message : 'Could not export these results.', 'error') }
  }

  const removeTemplate = async (template: Template) => {
    try { await api(`templates?id=${encodeURIComponent(template.id)}`, { method: 'DELETE' }); setTemplates((items) => items.filter((item) => item.id !== template.id)); toast('Template deleted.', 'success') }
    catch (error) { toast(error instanceof Error ? error.message : 'Could not delete template.', 'error') }
  }

  const removeBatch = async (item: Batch) => {
    if (!window.confirm(`Delete “${item.subject_template}” and its recipient results?`)) return
    try { await api(`batches?id=${encodeURIComponent(item.id)}`, { method: 'DELETE' }); setHistory((items) => items.filter((batchItem) => batchItem.id !== item.id)); toast('Campaign history deleted.', 'success') }
    catch (error) { toast(error instanceof Error ? error.message : 'Could not delete campaign history.', 'error') }
  }

  const deleteAccount = async () => {
    if (!window.confirm('Delete your account and permanently erase your templates, recipient lists, results, and stored attachments?')) return
    setBusy(true)
    try { await api('account-delete', { method: 'DELETE' }); await getSupabase().auth.signOut({ scope: 'local' }) }
    catch (error) { toast(error instanceof Error ? error.message : 'Could not delete this account.', 'error'); setBusy(false) }
  }

  const signOut = async () => { await getSupabase().auth.signOut() }
  const navPage = (next: Page) => setPage(next)
  const showStep = (next: Step) => { setPage('workspace'); setStep(next) }

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="app-brand" onClick={() => { setPage('workspace'); setStep('contacts') }}><span className="brand-mark small"><Envelope weight="duotone" /></span><span>Email Sender<small>CSI VIT OUTREACH</small></span></button>
      <span className="nav-caption">WORKSPACE</span><nav className="side-nav" aria-label="Workspace">
        <button className={page === 'workspace' && step !== 'results' ? 'selected' : ''} onClick={() => { setPage('workspace'); if (step === 'results') setStep('contacts') }}><House size={18} />New campaign</button>
        <button className={page === 'templates' ? 'selected' : ''} onClick={() => navPage('templates')}><FileText size={18} />Templates <span className="nav-count">{templates.length}</span></button>
        <button className={page === 'history' ? 'selected' : ''} onClick={() => navPage('history')}><ChartBar size={18} />History <span className="nav-count">{history.length}</span></button>
      </nav>
      <div className="sidebar-bottom"><div className={`connection-mini ${gmail ? 'connected' : ''}`}><i /><span><b>{gmail ? 'Gmail connected' : 'Gmail not connected'}</b><small>{gmail?.email || 'Connect before sending'}</small></span></div><button className={`side-account ${page === 'account' ? 'selected' : ''}`} onClick={() => navPage('account')}><span className="user-avatar">{(profile.name || session.user.email || 'U').slice(0, 1).toUpperCase()}</span><span><b>{profile.name || session.user.email?.split('@')[0]}</b><small>Account settings</small></span><CaretRight size={15} /></button></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="breadcrumbs"><span>Workspace</span><CaretRight size={14} /><b>{page === 'workspace' ? step === 'results' ? 'Batch results' : 'New campaign' : titleCase(page)}</b></div><div className="topbar-right"><span className="quota-pill"><i />Free tier · 100 recipients / batch</span><button className="topbar-icon" title="Account settings" onClick={() => navPage('account')}><GearSix size={19} /></button></div></header>
      {notice && <div className={`notice-bar ${noticeType}`} role="status"><span>{noticeType === 'success' ? <CheckCircle size={17} /> : noticeType === 'error' ? <WarningCircle size={17} /> : <Info size={17} />}{notice}</span><button aria-label="Dismiss" onClick={() => setNotice('')}><X size={16} /></button></div>}
      <div className="content-area">
        {page === 'workspace' && step !== 'results' && <><div className="page-heading"><div><span className="eyebrow">CAMPAIGN BUILDER</span><h1>{step === 'contacts' ? 'Start with your people.' : step === 'compose' ? 'Write one message, make it personal.' : 'A final look before it goes.'}</h1><p>{stepList[currentStep - 1].subtitle}. Your list and copy stay private to your account.</p></div><span className="heading-meta"><i /> Draft ready</span></div><Stepper active={step} position={currentStep} onStep={(next) => showStep(next)} />
          {step === 'contacts' && <ContactsPanel table={table} sourceName={sourceName} sheets={sheets} sheetName={sheetName} emailHeader={emailHeader} contacts={contacts} ready={readyCount} skipped={skippedCount} error={contactResult.error || fileError} busy={busy} input={contactsInput} onFile={parseContactsFile} onSheet={chooseSheet} onEmail={setEmailHeader} onBrowse={() => contactsInput.current?.click()} onClear={() => { setTable(null); setSourceName(''); setSheets([]); setSheetName(''); setEmailHeader(null); setFileError('') }} onNext={() => { if (readyCount) setStep('compose') }} />}
          {step === 'compose' && <ComposePanel subject={subject} body={bodyHtml} sender={sender} profile={profile} saved={profileSaved} gmail={gmail} library={library} selected={attachments} totalSize={totalAttachmentSize} busy={busy} input={attachmentInput} placeholders={placeholderNames} savePanel={savePanel} templateName={templateName} onSubject={setSubject} onBody={setBodyHtml} onProfile={(value) => { setProfile(value); setProfileSaved(false) }} onSaveProfile={saveProfile} onConnect={connectGmail} onUpload={uploadFiles} onChooseFile={() => attachmentInput.current?.click()} onAttach={(file) => { if (totalAttachmentSize + file.size <= 10 * 1024 * 1024) setAttachments((items) => items.some((item) => item.id === file.id) ? items : [...items, file]); else toast('Attachments must total 10 MB or less.', 'error') }} onDetach={(file) => setAttachments((items) => items.filter((item) => item.id !== file.id))} onDeleteFile={deleteAttachment} onSavePanel={() => setSavePanel(!savePanel)} onTemplateName={setTemplateName} onSaveTemplate={saveTemplate} onNext={() => setStep('review')} />}
          {step === 'review' && <ReviewPanel rows={previews} selected={selectedPreview} index={previewIndex} sender={sender} attachments={attachments} busy={busy} onIndex={setPreviewIndex} onBack={() => setStep('compose')} onTest={sendTest} onConfirm={() => setConfirmOpen(true)} />}
        </>}
        {page === 'workspace' && step === 'results' && <ResultsPanel batch={batch} rows={recipients} selectedIds={selectedIds} setSelectedIds={setSelectedIds} ackRisk={ackRisk} setAckRisk={setAckRisk} busy={busy} onRetry={() => void retryBatch(false)} onRetryUncertain={() => void retryBatch(true)} onResume={() => void resumeBatch()} onExport={() => void exportResults()} onNew={() => { setBatch(null); setRecipients([]); setStep('contacts') }} />}
        {page === 'templates' && <TemplatesPanel items={templates} onLoad={useTemplate} onDelete={removeTemplate} onNew={() => { setPage('workspace'); setStep('compose') }} />}
        {page === 'history' && <HistoryPanel items={history} busy={busy} onOpen={openBatch} onDelete={removeBatch} onNew={() => { setPage('workspace'); setStep('contacts') }} />}
        {page === 'account' && <AccountPanel session={session} profile={profile} gmail={gmail} saved={profileSaved} busy={busy} onProfile={(value) => { setProfile(value); setProfileSaved(false) }} onSave={saveProfile} onConnect={connectGmail} onDisconnect={disconnectGmail} onSignOut={signOut} onDeleteAccount={deleteAccount} />}
      </div>
      <footer className="app-footer"><span>Messages are sent one at a time from your connected Gmail.</span><a href="/privacy.html">Privacy & data retention <ArrowSquareOut size={13} /></a></footer>
    </main>
    {confirmOpen && <ConfirmSend count={readyCount} skipped={skippedCount} sender={sender.email} fileCount={attachments.length} busy={busy} onClose={() => setConfirmOpen(false)} onSend={() => void startBatch()} />}
  </div>
}

function Stepper({ active, position, onStep }: { active: Step; position: number; onStep: (step: Step) => void }) {
  return <div className="stepper" aria-label="Campaign steps">{stepList.map((item, index) => {
    const done = index + 1 < position
    return <div className={`stepper-item ${item.id === active ? 'active' : ''} ${done ? 'complete' : ''}`} key={item.id}><button disabled={!done && item.id !== active} aria-current={item.id === active ? 'step' : undefined} onClick={() => onStep(item.id)}><span className="stepper-number">{done ? <Check size={15} weight="bold" /> : `0${index + 1}`}</span><span><b>{item.title}</b><small>{item.subtitle}</small></span></button>{index < stepList.length - 1 && <i className="stepper-line" />}</div>
  })}</div>
}

function ContactsPanel(props: {
  table: ContactTable | null; sourceName: string; sheets: Array<{ name: string; table: ContactTable }>; sheetName: string; emailHeader: string | null; contacts: Contact[]; ready: number; skipped: number; error: string; busy: boolean; input: React.RefObject<HTMLInputElement | null>;
  onFile: (file?: File) => void; onSheet: (name: string) => void; onEmail: (header: string | null) => void; onBrowse: () => void; onClear: () => void; onNext: () => void;
}) {
  const { table, sourceName, sheets, sheetName, emailHeader, contacts, ready, skipped, error } = props
  return <section className="step-panel">
    <div className="section-title-row"><div><h2>Import your contact list</h2><p>Start from the CSI VIT sheet or bring your own CSV or Excel file.</p></div><a className="text-link" href="/template.xlsx" download><FileText size={16} /> Download template <ArrowSquareOut size={13} /></a></div>
    <div className={`upload-zone ${table ? 'has-file' : ''}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void props.onFile(event.dataTransfer.files[0]) }}>
      <input ref={props.input} className="visually-hidden" type="file" accept=".csv,.xlsx" onChange={(event) => void props.onFile(event.target.files?.[0])} />
      {props.busy ? <CircleNotch className="spin upload-icon" size={24} /> : <span className="upload-icon-wrap"><CloudArrowUp size={25} weight="duotone" /></span>}
      <div className="upload-copy"><b>{table ? sourceName : 'Drop your contact file here'}</b><span>{table ? `${table.rows.filter((row) => row.values.some((value) => value.trim())).length} rows · ${table.headers.length} columns` : 'CSV or Excel · up to 100 contacts · 5 MB max'}</span></div>
      {table ? <Button variant="outline" onClick={props.onClear}><X size={15} /> Remove</Button> : <Button variant="outline" onClick={props.onBrowse}>Browse files</Button>}
    </div>
    {error && <div className="inline-alert error"><WarningCircle size={17} />{error}</div>}
    {table && <><div className="mapping-row"><label><span className="tiny-label">WORKSHEET</span><span className="mapping-select"><select value={sheetName} disabled={!sheets.length} onChange={(event) => props.onSheet(event.target.value)}>{sheets.length ? sheets.map((sheet) => <option value={sheet.name} key={sheet.name}>{sheet.name}</option>) : <option value="">CSV file</option>}</select><CaretDown size={14} /></span></label><label><span className="tiny-label">RECIPIENT EMAIL COLUMN</span><span className="mapping-select"><select value={emailHeader || ''} onChange={(event) => props.onEmail(event.target.value || null)}><option value="">Auto-detect</option>{table.headers.map((header) => <option value={header} key={header}>{header}</option>)}</select><CaretDown size={14} /></span></label><div className="import-stats"><span className="stat-ready"><CheckCircle size={16} />{ready} ready</span><span className={skipped ? 'stat-skipped' : ''}><WarningCircle size={16} />{skipped} skipped</span></div></div>
      <div className="contact-table-wrap"><table className="contact-table"><thead><tr><th>ROW</th>{table.headers.slice(0, 6).map((header) => <th key={header}>{header}</th>)}<th>CHECK</th></tr></thead><tbody>{contacts.slice(0, 8).map((contact) => <tr key={contact.rowNumber}><td className="row-num">{contact.rowNumber}</td>{table.headers.slice(0, 6).map((header) => <td key={header} title={contact.fields[header]}>{contact.fields[header] || <span className="muted-dash">—</span>}</td>)}<td><span className={`status-pill ${contact.status}`}>{contact.status === 'ready' ? <><Check size={12} /> Ready</> : <><WarningCircle size={12} /> Skip</>}</span></td></tr>)}</tbody></table>{contacts.length > 8 && <div className="table-more">Showing 8 of {contacts.length} non-empty rows</div>}</div>
      <div className="contact-footnote"><Info size={15} /> The first valid occurrence of a duplicate email is kept. Missing message values will be skipped at review.</div></>}
    <div className="step-actions"><span className="step-action-note">{table ? `${ready} recipients are ready to personalize` : 'Your file is only used to prepare this campaign'}</span><Button className="primary-button" disabled={!table || !ready} onClick={props.onNext}>Continue to compose <ArrowRight size={16} /></Button></div>
  </section>
}

function ComposePanel(props: {
  subject: string; body: string; sender: Profile; profile: Profile; saved: boolean; gmail: GmailConnection; library: StoredAttachment[]; selected: StoredAttachment[]; totalSize: number; busy: boolean; input: React.RefObject<HTMLInputElement | null>; placeholders: string[]; savePanel: boolean; templateName: string;
  onSubject: (value: string) => void; onBody: (value: string) => void; onProfile: (value: Profile) => void; onSaveProfile: () => void; onConnect: () => void; onUpload: (files: FileList | null) => void; onChooseFile: () => void; onAttach: (file: StoredAttachment) => void; onDetach: (file: StoredAttachment) => void; onDeleteFile: (file: StoredAttachment) => void; onSavePanel: () => void; onTemplateName: (value: string) => void; onSaveTemplate: () => void; onNext: () => void;
}) {
  return <section className="compose-layout"><div className="compose-main panel-card"><div className="section-title-row"><div><span className="eyebrow">MESSAGE</span><h2>Your note to a sponsor</h2></div><Button variant="outline" size="sm" onClick={props.onSavePanel}><Plus size={15} /> Save template</Button></div>
    {props.savePanel && <div className="save-template-row"><input aria-label="Template name" placeholder="Name this template" value={props.templateName} onChange={(event) => props.onTemplateName(event.target.value)} /><Button className="primary-button" size="sm" disabled={!props.templateName.trim()} onClick={props.onSaveTemplate}>Save</Button><Button variant="ghost" size="sm" onClick={props.onSavePanel}>Cancel</Button></div>}
    <label className="field-label" htmlFor="subject">Subject line</label><input className="text-field subject-field" id="subject" maxLength={200} value={props.subject} onChange={(event) => props.onSubject(event.target.value)} placeholder="A clear, personal subject" />
    <div className="editor-label-row"><label className="field-label">Message</label><span>Use <code>[Column Name]</code> to personalize each email</span></div><Suspense fallback={<div className="editor-loading" aria-label="Loading message editor" />}><RichEditor value={props.body} onChange={props.onBody} placeholderNames={props.placeholders} /></Suspense><div className="editor-note"><SparkleIcon /> Values are escaped before insertion. Unfilled fields will be skipped at review.</div></div>
    <div className="compose-side"><div className="panel-card sender-card"><div className="side-card-title"><span className="side-title-icon"><Envelope size={17} /></span><span><b>Sending as</b><small>From your connected Gmail</small></span><span className={`small-status ${props.gmail ? 'on' : ''}`}><i />{props.gmail ? 'CONNECTED' : 'NOT CONNECTED'}</span></div>
      {props.gmail ? <div className="sender-address"><LockKey size={14} />{props.gmail.email}</div> : <div className="gmail-connect-box"><span>Connect the Google account you want to send from.</span><Button variant="outline" size="sm" disabled={props.busy} onClick={props.onConnect}><GoogleLogo size={16} /> Connect Gmail</Button></div>}
      <div className="sender-fields"><label><span>Your name</span><input className="text-field" value={props.profile.name} onChange={(event) => props.onProfile({ ...props.profile, name: event.target.value })} placeholder="e.g. Manan Shah" /></label><label><span>Phone number</span><input className="text-field" value={props.profile.phone} onChange={(event) => props.onProfile({ ...props.profile, phone: event.target.value })} placeholder="+91 98765 43210" /></label><div className="sender-save"><span>{props.saved ? <><CheckCircle size={14} /> Saved privately</> : 'These details fill sender placeholders'}</span><Button variant="outline" size="sm" disabled={props.busy || !props.profile.name.trim()} onClick={props.onSaveProfile}>{props.saved ? 'Update' : 'Save details'}</Button></div></div>
    </div>
    <div className="panel-card attachment-card"><div className="side-card-title"><span className="side-title-icon"><Paperclip size={17} /></span><span><b>Attachments</b><small>Same files go to each recipient</small></span><span className="attachment-total">{formatBytes(props.totalSize)} / 10 MB</span></div>
      <input ref={props.input} className="visually-hidden" type="file" multiple onChange={(event) => props.onUpload(event.target.files)} />
      {props.selected.length > 0 && <div className="attachment-list">{props.selected.map((file) => <div className="attachment-item" key={file.id}><span className="file-icon"><FileText size={17} /></span><span className="file-name"><b>{file.name}</b><small>{formatBytes(file.size)}</small></span><button aria-label={`Remove ${file.name} from campaign`} onClick={() => props.onDetach(file)}><X size={15} /></button></div>)}</div>}
      {props.library.some((item) => !props.selected.some((chosen) => chosen.id === item.id)) && <div className="stored-files"><span>YOUR STORED FILES</span>{props.library.filter((item) => !props.selected.some((chosen) => chosen.id === item.id)).slice(0, 4).map((file) => <div className="stored-file" key={file.id}><span>{file.name}<small>{formatBytes(file.size)}</small></span><button onClick={() => props.onAttach(file)}>Attach</button><button className="delete-file" aria-label={`Delete ${file.name}`} onClick={() => props.onDeleteFile(file)}><Trash size={14} /></button></div>)}</div>}
      <button className="attachment-add" disabled={props.busy} onClick={props.onChooseFile}><Plus size={15} /> Add attachment <span>up to 10 MB combined</span></button>
    </div>
    <div className="compose-tip"><Info size={16} /><span><b>Personalization tip</b>Field names match your spreadsheet headers. Sender details take precedence.</span></div></div>
    <div className="compose-footer"><span><i className={props.gmail && props.saved ? 'check-dot' : 'warning-dot'} />{props.gmail && props.saved ? 'Ready for a personalized review' : 'Save sender details and connect Gmail to continue'}</span><Button className="primary-button" disabled={!props.gmail || !props.saved || !props.subject.trim()} onClick={props.onNext}>Review emails <ArrowRight size={16} /></Button></div>
  </section>
}

function SparkleIcon() { return <span className="sparkle-small">✦</span> }

function ReviewPanel(props: { rows: PreviewRow[]; selected?: PreviewRow; index: number; sender: Profile; attachments: StoredAttachment[]; busy: boolean; onIndex: (index: number) => void; onBack: () => void; onTest: () => void; onConfirm: () => void }) {
  const ready = props.rows.filter((row) => row.previewStatus === 'ready').length
  const skipped = props.rows.length - ready
  return <section className="review-layout"><div className="review-summary panel-card"><div><span className="eyebrow">CHECK THE DETAILS</span><h2>Everything is personal, and ready.</h2><p>Review each message before it leaves your account. You can still go back and edit.</p></div><div className="review-counts"><div className="review-count ready"><b>{ready}</b><span>Ready to send</span></div><div className="review-count skipped"><b>{skipped}</b><span>Will be skipped</span></div><div className="review-count files"><b>{props.attachments.length}</b><span>Attachments</span></div></div></div>
    <div className="review-content"><div className="review-recipient panel-card"><div className="section-title-row"><div><span className="eyebrow">RECIPIENTS</span><h3>Personalized preview</h3></div><span className="tiny-counter">{props.rows.length ? `${props.index + 1} / ${props.rows.length}` : '0 / 0'}</span></div><div className="review-recipient-list">{props.rows.map((row, index) => <button className={`review-recipient-row ${props.index === index ? 'selected' : ''} ${row.previewStatus === 'skipped' ? 'will-skip' : ''}`} key={`${row.rowNumber}-${row.email}`} onClick={() => props.onIndex(index)}><span className="review-row-avatar">{(row.pocName || row.companyName || '?').slice(0, 1).toUpperCase()}</span><span className="review-row-info"><b>{row.pocName || 'No contact name'}</b><small>{row.companyName || row.email || `Source row ${row.rowNumber}`}</small></span><span className={`review-status ${row.previewStatus}`}>{row.previewStatus === 'ready' ? <><CheckCircle size={14} /> Ready</> : <><WarningCircle size={14} /> Skip</>}</span></button>)}</div></div>
      <div className="email-preview panel-card"><div className="preview-window-bar"><span><i /><i /><i /></span><small>MESSAGE PREVIEW</small><span className="preview-window-tag">{props.selected?.previewStatus === 'ready' ? 'Personalized' : 'Skipped'}</span></div>{props.selected ? <><div className="preview-meta"><div><span>TO</span><b>{props.selected.pocName ? `${props.selected.pocName} · ` : ''}{props.selected.email || 'Missing email'}</b></div><div><span>FROM</span><b>{props.sender.name} &lt;{props.sender.email}&gt;</b></div><div className="preview-subject"><span>SUBJECT</span><b>{props.selected.personalized.subject}</b></div></div><article className="email-body" dangerouslySetInnerHTML={{ __html: props.selected.personalized.bodyHtml }} />{props.selected.previewReason && <div className="preview-warning"><WarningCircle size={15} />{props.selected.previewReason}</div>}</> : <div className="empty-preview">Choose a recipient to preview the message.</div>}</div></div>
    {props.attachments.length > 0 && <div className="review-attachments"><Paperclip size={15} /><span>Sending with</span>{props.attachments.map((file) => <span className="review-file" key={file.id}>{file.name}</span>)}</div>}
    <div className="step-actions review-actions"><span className="step-action-note"><Info size={15} /> Test goes to your connected account · usage limits apply</span><div><Button variant="outline" onClick={props.onBack}><ArrowLeft size={15} /> Edit message</Button><Button variant="outline" disabled={!props.selected || props.selected.previewStatus !== 'ready' || props.busy} onClick={props.onTest}><PaperPlaneTilt size={15} /> Send test</Button><Button className="primary-button" disabled={!ready || props.busy} onClick={props.onConfirm}>Confirm {ready} emails <ArrowRight size={16} /></Button></div></div>
  </section>
}

function ResultsPanel(props: { batch: Batch | null; rows: BatchRecipient[]; selectedIds: string[]; setSelectedIds: (value: string[]) => void; ackRisk: boolean; setAckRisk: (value: boolean) => void; busy: boolean; onRetry: () => void; onRetryUncertain: () => void; onResume: () => void; onExport: () => void; onNew: () => void }) {
  const batch = props.batch
  const total = batch?.total_count || props.rows.length
  const success = batch?.success_count || 0
  const failed = batch?.failed_count || 0
  const uncertain = batch?.needs_review_count || 0
  const skipped = batch?.skipped_count || 0
  const active = batch ? ['queued', 'sending'].includes(batch.status) : false
  const retryable = props.rows.filter((row) => row.status === 'failed')
  const review = props.rows.filter((row) => row.status === 'needs_review')
  const allIds = [...retryable, ...review].map((row) => row.id)
  const completed = success + failed + uncertain + skipped
  const percentage = total ? Math.min(100, Math.round(completed / total * 100)) : 0
  return <section className="results-page"><div className="page-heading results-heading"><div><span className="eyebrow">CAMPAIGN RESULTS</span><h1>{active ? 'Your messages are on their way.' : batch?.status === 'paused' ? 'This batch is paused.' : 'Your outreach is accounted for.'}</h1><p>{batch?.subject_template || 'Batch summary'} · {batch?.created_at ? new Date(batch.created_at).toLocaleString() : 'started just now'}</p></div><span className={`batch-state ${batch?.status || 'queued'}`}><i />{statusLabel(batch?.status || 'queued')}</span></div>
    <div className="results-progress panel-card"><div className="progress-label"><span>{active ? 'Sending progress' : 'Batch complete'}</span><b>{active ? `${completed} of ${total} rows processed` : `${success} of ${total} accepted by Gmail`}</b></div><div className="progress-track"><i style={{ width: `${active ? Math.max(3, percentage) : 100}%` }} /></div><div className="result-stat-grid"><div><span className="result-stat-icon success"><CheckCircle size={17} /></span><b>{success}</b><small>Accepted by Gmail</small></div><div><span className="result-stat-icon failure"><WarningCircle size={17} /></span><b>{failed}</b><small>Failed</small></div><div><span className="result-stat-icon review"><WarningCircle size={17} /></span><b>{uncertain}</b><small>Needs your review</small></div><div><span className="result-stat-icon skip"><X size={17} /></span><b>{skipped}</b><small>Skipped</small></div></div>{batch?.error_message && <div className="batch-inline-warning"><Info size={16} />{batch.error_message}</div>}</div>
    <div className="results-table-card panel-card"><div className="section-title-row"><div><h2>Recipient activity</h2><p>Each address received its own email from your account.</p></div><div className="table-actions"><Button variant="outline" size="sm" onClick={props.onExport}><FileCsv size={16} /> Export CSV</Button>{batch?.status === 'paused' && <Button className="primary-button" size="sm" disabled={props.busy} onClick={props.onResume}><ArrowsClockwise size={15} /> Resume</Button>}</div></div>
      <div className="results-table-wrap"><table className="results-table"><thead><tr><th>CONTACT</th><th>EMAIL</th><th>ROW</th><th>STATUS</th><th>ATTEMPTS</th><th>DETAIL</th><th /></tr></thead><tbody>{props.rows.map((row) => {
        const selectable = row.status === 'failed' || row.status === 'needs_review'
        return <tr key={row.id}><td><b>{row.poc_name || '—'}</b><small>{row.company_name || '—'}</small></td><td>{row.email || '—'}</td><td>{row.source_row}</td><td><span className={`status-pill ${row.status}`}>{row.status === 'sent' ? <><Check size={12} /> Sent</> : row.status === 'failed' ? <><WarningCircle size={12} /> Failed</> : row.status === 'needs_review' ? 'Needs review' : row.status === 'skipped' ? 'Skipped' : row.status === 'sending' ? <><CircleNotch className="spin" size={12} /> Sending</> : 'Queued'}</span></td><td>{row.attempt_count}</td><td className="result-detail">{row.reason || row.gmail_message_id || (row.status === 'sent' ? 'Gmail accepted' : '—')}</td><td>{selectable && <input aria-label={`Select ${row.email} for retry`} type="checkbox" checked={props.selectedIds.includes(row.id)} onChange={(event) => props.setSelectedIds(event.target.checked ? [...props.selectedIds, row.id] : props.selectedIds.filter((id) => id !== row.id))} />}</td></tr>
      })}{!props.rows.length && <tr><td colSpan={7} className="empty-table">{active ? <><CircleNotch className="spin" size={17} /> Waiting for the sender to start…</> : 'Recipient rows will appear here.'}</td></tr>}</tbody></table></div>
      {(retryable.length > 0 || review.length > 0) && <div className="retry-panel"><div className="retry-copy"><b>{retryable.length} confirmed failures · {review.length} uncertain result{review.length === 1 ? '' : 's'}</b><span>Check Gmail Sent before resending an uncertain result.</span></div><label className="retry-select-all"><input type="checkbox" checked={allIds.length > 0 && props.selectedIds.length === allIds.length} onChange={(event) => props.setSelectedIds(event.target.checked ? allIds : [])} /> Select retryable rows</label><Button variant="outline" disabled={props.busy || !props.selectedIds.some((id) => retryable.some((row) => row.id === id))} onClick={props.onRetry}><ArrowsClockwise size={15} /> Retry confirmed</Button>{review.length > 0 && <div className="risk-retry"><label><input type="checkbox" checked={props.ackRisk} onChange={(event) => props.setAckRisk(event.target.checked)} /> I checked Gmail Sent and accept the duplicate risk.</label><Button variant="destructive" disabled={props.busy || !props.ackRisk || !props.selectedIds.some((id) => review.some((row) => row.id === id))} onClick={props.onRetryUncertain}>Resend uncertain</Button></div>}</div>}
    </div><div className="results-footnote"><Info size={15} /> “Accepted by Gmail” confirms Gmail accepted the send request; it does not confirm inbox delivery.</div>{!active && <div className="results-bottom"><Button variant="outline" onClick={props.onNew}><Plus size={15} /> New campaign</Button><span>Batch records and files expire after 30 days.</span></div>}</section>
}

function TemplatesPanel(props: { items: Template[]; onLoad: (item: Template) => void; onDelete: (item: Template) => void; onNew: () => void }) {
  return <section className="library-page"><div className="page-heading"><div><span className="eyebrow">YOUR LIBRARY</span><h1>Templates that sound like you.</h1><p>Reusable subject lines and messages, kept private to your account.</p></div><Button className="primary-button" onClick={props.onNew}><Plus size={16} /> New message</Button></div>
    {props.items.length ? <div className="template-grid">{props.items.map((item) => <article className="template-card panel-card" key={item.id}><div className="template-card-top"><span className="template-icon"><FileText size={18} /></span><span className="template-updated">Updated {new Date(item.updatedAt).toLocaleDateString()}</span></div><h3>{item.name}</h3><p className="template-subject">{item.subject}</p><div className="template-excerpt" dangerouslySetInnerHTML={{ __html: item.bodyHtml }} /><div className="template-card-actions"><Button variant="outline" size="sm" onClick={() => props.onLoad(item)}>Use template <ArrowRight size={14} /></Button><button aria-label={`Delete ${item.name}`} onClick={() => props.onDelete(item)}><Trash size={15} /></button></div></article>)}</div> : <EmptyState icon={<FileText size={23} />} title="No templates saved yet" detail="Save a message while composing to keep it here next time." action="Write a message" onAction={props.onNew} />}
  </section>
}

function HistoryPanel(props: { items: Batch[]; busy: boolean; onOpen: (item: Batch) => void; onDelete: (item: Batch) => void; onNew: () => void }) {
  return <section className="library-page"><div className="page-heading"><div><span className="eyebrow">PRIVATE ARCHIVE</span><h1>Every campaign, in one place.</h1><p>Recipient outcomes stay available for 30 days, then batch details and files are deleted.</p></div><Button className="primary-button" onClick={props.onNew}><Plus size={16} /> New campaign</Button></div>
    {props.items.length ? <div className="history-card panel-card"><div className="history-table-wrap"><table className="history-table"><thead><tr><th>CAMPAIGN</th><th>CREATED</th><th>STATUS</th><th>CONTACTS</th><th>SENT</th><th>ISSUES</th><th /></tr></thead><tbody>{props.items.map((item) => <tr key={item.id}><td><b>{item.subject_template}</b><small>{item.id.slice(0, 8)}</small></td><td>{new Date(item.created_at).toLocaleDateString()}</td><td><span className={`history-status ${item.status}`}><i />{statusLabel(item.status)}</span></td><td>{item.total_count}</td><td>{item.success_count}</td><td>{item.failed_count + item.needs_review_count + item.skipped_count}</td><td className="history-actions"><Button variant="ghost" size="sm" disabled={props.busy} onClick={() => props.onOpen(item)}>View <ArrowRight size={14} /></Button><button aria-label={`Delete ${item.subject_template}`} disabled={props.busy || ['queued', 'sending'].includes(item.status)} onClick={() => props.onDelete(item)}><Trash size={15} /></button></td></tr>)}</tbody></table></div></div> : <EmptyState icon={<ChartBar size={23} />} title="Your history starts here" detail="Finished campaigns and recipient outcomes will appear here." action="Start a campaign" onAction={props.onNew} />}
  </section>
}

function AccountPanel(props: { session: Session; profile: Profile; gmail: GmailConnection; saved: boolean; busy: boolean; onProfile: (value: Profile) => void; onSave: () => void; onConnect: () => void; onDisconnect: () => void; onSignOut: () => void; onDeleteAccount: () => void }) {
  return <section className="account-page"><div className="page-heading"><div><span className="eyebrow">ACCOUNT & SENDING</span><h1>Your details, your sender.</h1><p>Manage your private profile and Google permissions.</p></div></div>
    <div className="account-grid"><div className="panel-card account-card"><div className="account-title"><span className="user-avatar large">{(props.profile.name || props.session.user.email || 'U').slice(0, 1).toUpperCase()}</span><span><b>Sender profile</b><small>Your name and phone fill sender placeholders.</small></span></div><label className="account-field"><span>Google sign-in address</span><div className="read-only-field"><LockKey size={15} />{props.session.user.email}<small>READ ONLY</small></div></label><label className="account-field"><span>Your name</span><input className="text-field" value={props.profile.name} onChange={(event) => props.onProfile({ ...props.profile, name: event.target.value })} placeholder="e.g. Manan Shah" /></label><label className="account-field"><span>Your phone number</span><input className="text-field" value={props.profile.phone} onChange={(event) => props.onProfile({ ...props.profile, phone: event.target.value })} placeholder="+91 98765 43210" /></label><div className="account-save-row"><span>{props.saved ? 'Profile saved privately' : 'Save details before composing'}</span><Button className="primary-button" disabled={props.busy || !props.profile.name.trim()} onClick={props.onSave}>Save profile</Button></div></div>
      <div className="account-stack"><div className="panel-card account-card gmail-card"><div className="account-title"><span className="gmail-logo"><GoogleLogo size={20} weight="bold" /></span><span><b>Gmail sending access</b><small>Separate permission · send only</small></span></div>{props.gmail ? <div className="connected-account"><span className="connected-check"><Check size={15} weight="bold" /></span><span><b>{props.gmail.email}</b><small>{props.gmail.reconnectRequired ? 'Reconnect required' : 'Connected to send sponsorship email'}</small></span><Button variant="outline" size="sm" disabled={props.busy} onClick={props.onDisconnect}>Disconnect</Button></div> : <><p className="account-explainer">Connect the same Google account you signed in with. Email Sender requests send-only Gmail access and never reads your inbox.</p><Button variant="outline" disabled={props.busy} onClick={props.onConnect}><GoogleLogo size={16} /> Connect Gmail</Button></>}</div>
        <div className="panel-card data-card"><span className="side-title-icon"><LockKey size={18} /></span><div><b>Private by default</b><p>Contacts, attachments, templates, and results are visible only to your account. Batch data is deleted after 30 days.</p><a href="/privacy.html">Read the privacy policy <ArrowRight size={13} /></a></div></div><div className="account-signout"><span>Signed in as <b>{props.session.user.email}</b></span><Button variant="outline" onClick={props.onSignOut}><SignOut size={15} /> Sign out</Button></div><div className="delete-account-row"><span><b>Delete account</b><small>Permanently erase your stored workspace data.</small></span><Button variant="destructive" disabled={props.busy} onClick={props.onDeleteAccount}><Trash size={15} /> Delete account</Button></div>
      </div></div></section>
}

function ConfirmSend(props: { count: number; skipped: number; sender: string; fileCount: number; busy: boolean; onClose: () => void; onSend: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && props.onClose()}><section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-heading"><span className="modal-icon"><PaperPlaneTilt size={21} weight="duotone" /></span><button className="modal-close" aria-label="Close" onClick={props.onClose}><X size={18} /></button><span className="eyebrow">READY TO SEND</span><h2 id="confirm-heading">Send to {props.count} {props.count === 1 ? 'recipient' : 'recipients'}?</h2><p>Each person gets a separate email from <strong>{props.sender}</strong>. {props.skipped ? `${props.skipped} row${props.skipped === 1 ? '' : 's'} will be skipped.` : 'All reviewed rows are ready.'}</p><div className="confirm-summary"><span><CheckCircle size={16} /> {props.count} personalized</span><span><Paperclip size={16} /> {props.fileCount} attachment{props.fileCount === 1 ? '' : 's'}</span></div><div className="modal-actions"><Button variant="outline" onClick={props.onClose}>Go back</Button><Button className="primary-button" disabled={props.busy} onClick={props.onSend}>{props.busy ? <CircleNotch className="spin" /> : <PaperPlaneTilt size={16} />} Send all</Button></div><small className="modal-note">Success means Gmail accepted the message for sending.</small></section></div>
}

function EmptyState(props: { icon: ReactNode; title: string; detail: string; action: string; onAction: () => void }) {
  return <div className="empty-state panel-card"><span className="empty-state-icon">{props.icon}</span><h2>{props.title}</h2><p>{props.detail}</p><Button variant="outline" onClick={props.onAction}>{props.action} <ArrowRight size={14} /></Button></div>
}

function formatBytes(size: number) { return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB` }
function titleCase(value: string) { return value[0].toUpperCase() + value.slice(1) }
function statusLabel(status: string) { return status === 'completed_with_errors' ? 'Needs attention' : status[0].toUpperCase() + status.slice(1) }
