import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BUCKET, imageUrl, supabase } from '../supabase'
import { useAuth } from '../auth'
import { AFFILIATIONS, CATEGORIES, CONDITIONS, priceLine, timeAgo } from '../constants'
import TypeTag from '../components/TypeTag'
import Avatar from '../components/Avatar'

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

const HEADING = {
  sell: 'Message the seller',
  free: 'Ask for this item',
  swap: 'Propose a swap',
  looking_for: 'Have this? Let them know',
}
const QUICK = {
  sell: ['Is this still available?', 'Where can we meet?'],
  free: ['Is this still available?', 'When can I pick it up?'],
  swap: ['Is this still available?', 'What would you swap for?'],
  looking_for: ['I have this.', 'Can I send you a photo?'],
}

function ChatStarter({ listing, user }) {
  const nav = useNavigate()
  const [convId, setConvId] = useState(undefined)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    supabase.from('conversations').select('id').eq('listing_id', listing.id).eq('starter_id', user.id).maybeSingle()
      .then(({ data }) => setConvId(data?.id || null))
  }, [listing.id, user.id])

  async function send(e) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setErr('')
    setBusy(true)
    let id = convId
    if (!id) {
      const { data, error } = await supabase.from('conversations').insert({ listing_id: listing.id }).select('id').single()
      if (error) {
        if (error.code === '23505') {
          const r = await supabase.from('conversations').select('id').eq('listing_id', listing.id).eq('starter_id', user.id).single()
          id = r.data?.id
        } else {
          setErr(error.message)
          setBusy(false)
          return
        }
      } else id = data.id
    }
    const { error: e2 } = await supabase.from('messages').insert({ conversation_id: id, body })
    if (e2) {
      setErr(e2.message)
      setBusy(false)
      return
    }
    nav(`/messages/${id}`)
  }

  if (convId === undefined) return null
  if (convId) {
    return (
      <div className="panel">
        <h2>You are already chatting</h2>
        <p className="muted">Continue the conversation about this listing.</p>
        <Link to={`/messages/${convId}`} className="btn btn-primary">Open chat</Link>
      </div>
    )
  }
  return (
    <form onSubmit={send} className="form panel">
      <h2>{HEADING[listing.type]}</h2>
      <div className="quick">
        {QUICK[listing.type].map((q) => (
          <button key={q} type="button" className="chip" onClick={() => setText(q)}>{q}</button>
        ))}
      </div>
      <label className="sr-label">Your message
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} rows={3} required
          placeholder="Write a message" />
      </label>
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn btn-primary" disabled={busy || !text.trim()}>{busy ? 'Sending…' : 'Send message'}</button>
    </form>
  )
}

function OwnerChats({ listingId }) {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    supabase.from('conversations')
      .select('id,last_message,last_message_at,starter:profiles!starter_id(display_name,avatar_color)')
      .eq('listing_id', listingId).order('last_message_at', { ascending: false })
      .then(({ data }) => setRows(data || []))
  }, [listingId])
  if (rows === null) return null
  return (
    <section className="panel">
      <h2>Chats about this listing ({rows.length})</h2>
      {rows.length === 0 && <p className="muted">No one has messaged yet.</p>}
      {rows.map((r) => (
        <Link key={r.id} to={`/messages/${r.id}`} className="conv">
          <Avatar profile={r.starter} size={40} />
          <div className="conv-text">
            <strong>{r.starter?.display_name}</strong>
            <span className="muted">{r.last_message}</span>
          </div>
          <span className="muted small">{timeAgo(r.last_message_at)}</span>
        </Link>
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
      .select('*, listing_images(id,path,thumb_path,position), profiles(id,display_name,program,affiliation,avatar_color)')
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
    if (!error) nav('/me', { replace: true })
  }

  return (
    <main className="wrap detail">
      <Gallery images={imgs} title={l.title} />
      <div>
        <TypeTag type={l.type} />
        <h1>{l.title}</h1>
        <p className="big">{priceLine(l)}</p>
        {done && <p className="note">This one is no longer available.</p>}

        <Link to={`/u/${l.user_id}`} className="poster">
          <Avatar profile={l.profiles} size={44} />
          <span>
            <strong>{l.profiles?.display_name}</strong>
            <small>{l.profiles?.program} {AFFILIATIONS[l.profiles?.affiliation]?.toLowerCase()}</small>
          </span>
        </Link>

        <dl className="facts">
          <dt>Category</dt><dd>{CATEGORIES[l.category]}</dd>
          {l.course && <><dt>Subject</dt><dd>{l.course}</dd></>}
          {l.condition && <><dt>Condition</dt><dd>{CONDITIONS[l.condition]}</dd></>}
          <dt>Posted</dt><dd>{timeAgo(l.created_at)}</dd>
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
            <OwnerChats listingId={l.id} />
          </>
        ) : !done && (
          user ? (
            <ChatStarter listing={l} user={user} />
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
