import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useBadges } from '../badges'
import { timeAgo } from '../constants'
import Icon from '../components/Icon'

export default function Alerts() {
  const nav = useNavigate()
  const { refresh, tick } = useBadges()
  const [rows, setRows] = useState(null)

  const load = useCallback(() => {
    supabase.from('notifications')
      .select('id,type,title,context,body,link,count,read_at,created_at')
      .order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => setRows(data || []))
  }, [])

  useEffect(() => { load() }, [load, tick])

  async function open(n) {
    if (!n.read_at) {
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id)
      refresh()
    }
    nav(n.link)
  }

  async function readAll() {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
    refresh()
    load()
  }

  const hasUnread = rows?.some((n) => !n.read_at)
  return (
    <main className="wrap narrow">
      <header className="page-head">
        <h1>Alerts</h1>
        {hasUnread && <button type="button" className="btn btn-small" onClick={readAll}>Mark all as read</button>}
      </header>
      {rows === null && <p className="status">Loading…</p>}
      {rows?.length === 0 && (
        <div className="empty">
          <h2>You are all caught up</h2>
          <p>You will see an alert here when someone messages you or a listing you asked about is gone.</p>
        </div>
      )}
      <ul className="alerts">
        {rows?.map((n) => (
          <li key={n.id}>
            <button type="button" className={`alert${n.read_at ? '' : ' unread'}`} onClick={() => open(n)}>
              <span className={`alert-ico ${n.type}`}><Icon name={n.type === 'message' ? 'chat' : 'tag'} size={18} /></span>
              <span className="alert-text">
                <strong>
                  {n.type === 'message'
                    ? `${n.title} sent ${n.count > 1 ? `${n.count} messages` : 'a message'}`
                    : n.title}
                </strong>
                {n.context && <span className="muted small">About {n.context}</span>}
                {n.body && <span className="alert-body">{n.body}</span>}
              </span>
              <span className="muted small">{timeAgo(n.created_at)}</span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}
