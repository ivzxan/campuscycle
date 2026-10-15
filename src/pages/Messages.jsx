import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useMatch } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../auth'
import { timeAgo } from '../constants'
import Avatar from '../components/Avatar'

const COLS = 'id,owner_id,starter_id,last_message,last_sender,last_message_at,' +
  'listings(id,title,type,status),' +
  'owner:profiles!owner_id(id,display_name,avatar_color),' +
  'starter:profiles!starter_id(id,display_name,avatar_color)'

export default function Messages() {
  const { user } = useAuth()
  const open = useMatch('/messages/:id')
  const [convs, setConvs] = useState(null)
  const [unread, setUnread] = useState({})

  const load = useCallback(async () => {
    const [c, u] = await Promise.all([
      supabase.from('conversations').select(COLS).order('last_message_at', { ascending: false }),
      supabase.from('messages').select('conversation_id').is('read_at', null).neq('sender_id', user.id),
    ])
    const map = {}
    ;(u.data || []).forEach((m) => { map[m.conversation_id] = (map[m.conversation_id] || 0) + 1 })
    setUnread(map)
    setConvs(c.data || [])
  }, [user.id])

  useEffect(() => {
    load()
    const ch = supabase
      .channel(`inbox-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, load)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load, user.id])

  return (
    <main className={`wrap msgs${open ? ' has-chat' : ''}`}>
      <aside className="convlist" aria-label="Conversations">
        <h1>Messages</h1>
        {convs === null && <p className="status">Loading…</p>}
        {convs?.length === 0 && (
          <div className="empty">
            <h2>No messages yet</h2>
            <p>Open any listing and tap send to start a chat. You can chat with many people at once.</p>
          </div>
        )}
        {convs?.map((c) => {
          const other = user.id === c.owner_id ? c.starter : c.owner
          const n = unread[c.id] || 0
          return (
            <NavLink key={c.id} to={`/messages/${c.id}`} className={({ isActive }) => `conv${isActive ? ' active' : ''}${n ? ' unread' : ''}`}>
              <Avatar profile={other} size={44} />
              <div className="conv-text">
                <strong>{other?.display_name}</strong>
                <span className="conv-listing">{c.listings?.title}</span>
                <span className="conv-last">{c.last_sender === user.id ? 'You: ' : ''}{c.last_message}</span>
              </div>
              <div className="conv-side">
                <span className="small muted">{timeAgo(c.last_message_at)}</span>
                {n > 0 && <span className="badge">{n > 9 ? '9+' : n}</span>}
              </div>
            </NavLink>
          )
        })}
      </aside>
      <section className="thread-pane">
        <Outlet context={{ reload: load }} />
      </section>
    </main>
  )
}
