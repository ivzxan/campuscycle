import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from './supabase'
import { useAuth } from './auth'

const Ctx = createContext({ alerts: 0, messages: 0, tick: 0, refresh() {} })
export const useBadges = () => useContext(Ctx)

// Keeps unread counts live and shows a banner when a message arrives outside its chat.
export function BadgesProvider({ children }) {
  const { user } = useAuth()
  const loc = useLocation()
  const pathRef = useRef(loc.pathname)
  const [counts, setCounts] = useState({ alerts: 0, messages: 0 })
  const [tick, setTick] = useState(0)
  const [toast, setToast] = useState(null)

  useEffect(() => { pathRef.current = loc.pathname }, [loc.pathname])

  const uid = user?.id
  const refresh = useCallback(async () => {
    if (!uid) return setCounts({ alerts: 0, messages: 0 })
    const [a, m] = await Promise.all([
      supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null),
      supabase.from('messages').select('id', { count: 'exact', head: true }).is('read_at', null).neq('sender_id', uid),
    ])
    setCounts({ alerts: a.count || 0, messages: m.count || 0 })
    setTick((t) => t + 1)
  }, [uid])

  useEffect(() => {
    if (!uid) return undefined
    refresh()
    const ch = supabase
      .channel(`badges-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, refresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (p) => {
        refresh()
        const m = p.new
        if (m.sender_id === uid) return
        if (pathRef.current === `/messages/${m.conversation_id}`) return
        const { data } = await supabase.from('profiles').select('display_name').eq('id', m.sender_id).maybeSingle()
        setToast({ title: data?.display_name || 'New message', body: m.body.slice(0, 80), link: `/messages/${m.conversation_id}` })
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [uid, refresh])

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    document.title = counts.alerts > 0 ? `(${counts.alerts}) CampusCycle` : 'CampusCycle'
  }, [counts.alerts])

  const value = useMemo(() => ({ ...counts, tick, refresh }), [counts, tick, refresh])
  return (
    <Ctx.Provider value={value}>
      {children}
      {toast && (
        <Link to={toast.link} className="toast" onClick={() => setToast(null)} role="status">
          <strong>{toast.title}</strong>
          <span>{toast.body}</span>
        </Link>
      )}
    </Ctx.Provider>
  )
}
