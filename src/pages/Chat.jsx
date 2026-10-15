import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { imageUrl, supabase } from '../supabase'
import { useAuth } from '../auth'
import { useBadges } from '../badges'
import { clock, dayLabel, priceLine } from '../constants'
import Avatar from '../components/Avatar'
import Icon from '../components/Icon'
import TypeTag from '../components/TypeTag'

const PAGE = 40
const MSG_COLS = 'id,sender_id,body,read_at,created_at'
const CONV_COLS = 'id,owner_id,starter_id,' +
  'listings(id,title,type,status,price,swap_for,listing_images(thumb_path,position)),' +
  'owner:profiles!owner_id(id,display_name,avatar_color),' +
  'starter:profiles!starter_id(id,display_name,avatar_color)'
const isMobile = () => /Mobi|Android|iPhone/i.test(navigator.userAgent)

export default function Chat() {
  const { id } = useParams()
  const { user } = useAuth()
  const { refresh } = useBadges()
  const [conv, setConv] = useState(undefined)
  const [msgs, setMsgs] = useState([])
  const [hasOlder, setHasOlder] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  const logRef = useRef(null)
  const inputRef = useRef(null)

  const markRead = useCallback(() => {
    supabase.rpc('mark_conversation_read', { conv: id }).then(() => refresh())
  }, [id, refresh])

  useEffect(() => {
    let stale = false
    setConv(undefined)
    setMsgs([])
    supabase.from('conversations').select(CONV_COLS).eq('id', id).maybeSingle()
      .then(({ data }) => { if (!stale) setConv(data) })
    supabase.from('messages').select(MSG_COLS).eq('conversation_id', id)
      .order('id', { ascending: false }).limit(PAGE)
      .then(({ data }) => {
        if (stale) return
        setMsgs((data || []).reverse())
        setHasOlder((data || []).length === PAGE)
        markRead()
      })

    const ch = supabase
      .channel(`chat-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, (p) => {
        setMsgs((prev) => (prev.some((m) => m.id === p.new.id) ? prev : [...prev, p.new]))
        if (p.new.sender_id !== user.id) markRead()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, (p) => {
        setMsgs((prev) => prev.map((m) => (m.id === p.new.id ? { ...m, read_at: p.new.read_at } : m)))
      })
      .subscribe()
    return () => { stale = true; supabase.removeChannel(ch) }
  }, [id, user.id, markRead])

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [msgs.length, conv])

  async function loadOlder() {
    const first = msgs[0]
    if (!first) return
    const { data } = await supabase.from('messages').select(MSG_COLS).eq('conversation_id', id)
      .lt('id', first.id).order('id', { ascending: false }).limit(PAGE)
    setMsgs((prev) => [...(data || []).reverse(), ...prev])
    setHasOlder((data || []).length === PAGE)
  }

  async function send(e) {
    e?.preventDefault()
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    setErr('')
    const { data, error } = await supabase.from('messages')
      .insert({ conversation_id: id, body }).select(MSG_COLS).single()
    setSending(false)
    if (error) return setErr(error.message)
    setMsgs((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]))
    setText('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && !isMobile()) {
      e.preventDefault()
      send()
    }
  }

  function grow(e) {
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
  }

  if (conv === undefined) return <p className="status">Loading…</p>
  if (conv === null) {
    return (
      <div className="thread-empty">
        <p>This conversation could not be found.</p>
        <Link to="/messages" className="btn">Back to messages</Link>
      </div>
    )
  }

  const other = user.id === conv.owner_id ? conv.starter : conv.owner
  const l = conv.listings
  const thumb = l && [...(l.listing_images || [])].sort((a, b) => a.position - b.position)[0]
  const lastMineIdx = msgs.map((m) => m.sender_id === user.id).lastIndexOf(true)

  return (
    <div className="thread">
      <header className="thread-head">
        <Link to="/messages" className="back" aria-label="Back to messages"><Icon name="back" /></Link>
        <Link to={`/u/${other?.id}`} className="who">
          <Avatar profile={other} size={40} />
          <strong>{other?.display_name}</strong>
        </Link>
      </header>

      {l && (
        <Link to={`/listing/${l.id}`} className="about">
          {thumb ? <img src={imageUrl(thumb.thumb_path)} alt="" width="48" height="36" /> : <span className="about-ph" />}
          <span className="about-text">
            <strong>{l.title}</strong>
            <span>{l.status === 'done' ? 'No longer available' : priceLine(l)}</span>
          </span>
          <TypeTag type={l.type} />
        </Link>
      )}

      <div className="chat-log" ref={logRef}>
        {hasOlder && <button type="button" className="linkbtn center" onClick={loadOlder}>Load earlier messages</button>}
        {msgs.map((m, i) => {
          const mine = m.sender_id === user.id
          const newDay = i === 0 || dayLabel(msgs[i - 1].created_at) !== dayLabel(m.created_at)
          return (
            <div key={m.id} className="msg-wrap">
              {newDay && <div className="day">{dayLabel(m.created_at)}</div>}
              <div className={`bub ${mine ? 'me' : 'them'}`}>
                {m.body}
                <small>{clock(m.created_at)}</small>
              </div>
              {mine && i === lastMineIdx && m.read_at && <div className="seen">Seen</div>}
            </div>
          )
        })}
        {msgs.length === 0 && <p className="muted center">Say hello and ask about the item.</p>}
      </div>

      <form className="composer" onSubmit={send}>
        {err && <p className="err small" role="alert">{err}</p>}
        <div className="composer-row">
          <textarea ref={inputRef} rows={1} value={text} maxLength={1000} placeholder="Write a message"
            aria-label="Message" onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown} onInput={grow} />
          <button className="btn btn-primary" disabled={!text.trim() || sending}>Send</button>
        </div>
      </form>
    </div>
  )
}
