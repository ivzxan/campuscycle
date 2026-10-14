import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BUCKET, imageUrl, supabase } from '../supabase'
import { useAuth } from '../auth'
import { AFFILIATIONS, CATEGORIES, CONDITIONS, priceLine, timeAgo } from '../constants'
import TypeTag from '../components/TypeTag'

function Gallery({ images, title }) {
  const [i, setI] = useState(0)
  if (!images.length) return <div className="hero-ph">No photo</div>
  return (
    <div>
      <div className="hero-box">
        <img src={imageUrl(images[i].path)} alt={title} width="900" height="675" />
      </div>
      {images.length > 1 && (
        <div className="thumbs">
          {images.map((im, n) => (
            <button key={im.id} type="button" onClick={() => setI(n)} aria-label={`Show photo ${n + 1}`} aria-current={n === i}>
              <img src={imageUrl(im.thumb_path)} alt="" width="72" height="54" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const CONTACT_HEADING = {
  sell: 'Message the seller',
  free: 'Ask for this item',
  swap: 'Propose a swap',
  looking_for: 'Have this? Let them know',
}

function ContactForm({ listing, user }) {
  const [sent, setSent] = useState(undefined)
  const [message, setMessage] = useState('')
  const [contact, setContact] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('contact_requests').select('id').eq('listing_id', listing.id).eq('from_user', user.id).maybeSingle()
      .then(({ data }) => setSent(Boolean(data)))
  }, [listing.id, user.id])

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    const { error } = await supabase.from('contact_requests').insert({
      listing_id: listing.id,
      message: message.trim(),
      contact: contact.trim(),
    })
    setBusy(false)
    if (!error) return setSent(true)
    if (error.code === '23505') return setSent(true)
    setErr(error.message)
  }

  if (sent === undefined) return null
  if (sent) return <p className="note" role="status">Message sent. The poster can now see how to reach you.</p>
  return (
    <form onSubmit={submit} className="form panel">
      <h2>{CONTACT_HEADING[listing.type]}</h2>
      <label>Your message
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} rows={3} required
          placeholder="Hi, is this still available?" />
      </label>
      <label>How can they reach you?
        <input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={100} minLength={3} required
          placeholder="Messenger name or mobile number" />
      </label>
      <p className="muted small">Only the poster will see your contact details.</p>
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Send message'}</button>
    </form>
  )
}

function Requests({ listingId }) {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    supabase.from('contact_requests')
      .select('id,message,contact,created_at,profiles(display_name)')
      .eq('listing_id', listingId).order('created_at', { ascending: false })
      .then(({ data }) => setRows(data || []))
  }, [listingId])
  if (rows === null) return null
  return (
    <section className="panel">
      <h2>Messages ({rows.length})</h2>
      {rows.length === 0 && <p className="muted">No messages yet.</p>}
      {rows.map((r) => (
        <article key={r.id} className="req">
          <p><strong>{r.profiles?.display_name || 'Student'}</strong>, {timeAgo(r.created_at)}</p>
          <p className="pre">{r.message}</p>
          <p>Reach them at: <strong>{r.contact}</strong></p>
        </article>
      ))}
    </section>
  )
}

function Report({ listingId }) {
  const [reason, setReason] = useState('spam')
  const [note, setNote] = useState('')
  const [state, setState] = useState('idle')
  async function submit(e) {
    e.preventDefault()
    const { error } = await supabase.from('reports').insert({ listing_id: listingId, reason, note: note.trim() || null })
    setState(error && error.code !== '23505' ? 'error' : 'done')
  }
  if (state === 'done') return <p className="muted small">Thanks. We will review this listing.</p>
  return (
    <details className="report">
      <summary>Report this listing</summary>
      <form onSubmit={submit} className="form">
        <label>Reason
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="spam">Spam</option>
            <option value="scam">Looks like a scam</option>
            <option value="inappropriate">Inappropriate</option>
            <option value="other">Something else</option>
          </select>
        </label>
        <label>Details (optional)
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
        </label>
        {state === 'error' && <p className="err" role="alert">Could not send the report. Try again.</p>}
        <button className="btn">Send report</button>
      </form>
    </details>
  )
}

export default function ListingPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const nav = useNavigate()
  const [l, setL] = useState(undefined)

  useEffect(() => {
    setL(undefined)
    supabase.from('listings')
      .select('*, listing_images(id,path,thumb_path,position), profiles(display_name,program,affiliation)')
      .eq('id', id).maybeSingle()
      .then(({ data }) => setL(data))
  }, [id])

  if (l === undefined) return <p className="wrap status">Loading…</p>
  if (l === null) {
    return (
      <main className="wrap status">
        <h1>Listing not found</h1>
        <p>It may have been removed.</p>
        <Link to="/">Back to browse</Link>
      </main>
    )
  }

  const mine = user?.id === l.user_id
  const imgs = [...l.listing_images].sort((a, b) => a.position - b.position)
  const done = l.status === 'done'

  async function setStatus(status) {
    const { error } = await supabase.from('listings').update({ status }).eq('id', l.id)
    if (!error) setL({ ...l, status })
  }

  async function remove() {
    if (!window.confirm('Delete this listing? This cannot be undone.')) return
    const paths = imgs.flatMap((i) => [i.path, i.thumb_path])
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
    const { error } = await supabase.from('listings').delete().eq('id', l.id)
    if (!error) nav('/my', { replace: true })
  }

  return (
    <main className="wrap detail">
      <Gallery images={imgs} title={l.title} />
      <div>
        <TypeTag type={l.type} />
        <h1>{l.title}</h1>
        <p className="big">{priceLine(l)}</p>
        {done && <p className="note">This one is no longer available.</p>}

        <dl className="facts">
          <dt>Category</dt><dd>{CATEGORIES[l.category]}</dd>
          {l.course && <><dt>Subject</dt><dd>{l.course}</dd></>}
          {l.condition && <><dt>Condition</dt><dd>{CONDITIONS[l.condition]}</dd></>}
          <dt>Posted</dt><dd>{timeAgo(l.created_at)}</dd>
          <dt>Posted by</dt>
          <dd>{l.profiles?.display_name}, {l.profiles?.program} {AFFILIATIONS[l.profiles?.affiliation]?.toLowerCase()}</dd>
        </dl>
        {l.description && <p className="pre">{l.description}</p>}

        {mine ? (
          <>
            <div className="row">
              <Link to={`/edit/${l.id}`} className="btn">Edit</Link>
              <button type="button" className="btn" onClick={() => setStatus(done ? 'active' : 'done')}>
                {done ? 'Reopen listing' : 'Mark as done'}
              </button>
              <button type="button" className="btn btn-danger" onClick={remove}>Delete</button>
            </div>
            <Requests listingId={l.id} />
          </>
        ) : !done && (
          user ? (
            <ContactForm listing={l} user={user} />
          ) : (
            <p className="panel">
              <Link to="/login" state={{ from: `/listing/${l.id}` }}>Log in</Link> to message the poster.
            </p>
          )
        )}
        {!mine && user && <Report listingId={l.id} />}
      </div>
    </main>
  )
}
