import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../auth'
import { AFFILIATIONS } from '../constants'
import Avatar from '../components/Avatar'
import ListingCard from '../components/ListingCard'

const COLS = 'id,type,title,price,swap_for,course,category,created_at,listing_images(thumb_path,position)'

export default function Profile() {
  const { id } = useParams()
  const { user } = useAuth()
  const [p, setP] = useState(undefined)
  const [items, setItems] = useState([])
  const [doneCount, setDoneCount] = useState(0)

  useEffect(() => {
    setP(undefined)
    supabase.from('profiles')
      .select('id,display_name,program,affiliation,bio,avatar_color,created_at')
      .eq('id', id).maybeSingle()
      .then(({ data }) => setP(data))
    supabase.from('listings').select(COLS).eq('user_id', id).eq('status', 'active')
      .order('created_at', { ascending: false }).then(({ data }) => setItems(data || []))
    supabase.from('listings').select('id', { count: 'exact', head: true })
      .eq('user_id', id).eq('status', 'done').then(({ count }) => setDoneCount(count || 0))
  }, [id])

  if (p === undefined) return <p className="wrap status">Loading…</p>
  if (p === null) {
    return (
      <main className="wrap status">
        <h1>Profile not found</h1>
        <Link to="/">Back to browse</Link>
      </main>
    )
  }

  const mine = user?.id === p.id
  const since = new Date(p.created_at).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
  return (
    <main className="wrap">
      <section className="me-card profile-head">
        <Avatar profile={p} size={72} />
        <div className="me-info">
          <h1>{p.display_name}</h1>
          <p className="muted">{p.program} {AFFILIATIONS[p.affiliation]?.toLowerCase()}, joined {since}</p>
          {p.bio && <p>{p.bio}</p>}
        </div>
        {mine && <div className="me-actions"><Link to="/me/edit" className="btn btn-small">Edit profile</Link></div>}
      </section>

      <section className="stats two-up" aria-label="Summary">
        <div className="stat"><b>{items.length}</b><span>Active listings</span></div>
        <div className="stat"><b>{doneCount}</b><span>Completed</span></div>
      </section>

      <h2>{mine ? 'Your active listings' : `Listings from ${p.display_name}`}</h2>
      {items.length === 0
        ? <p className="muted">No active listings right now.</p>
        : <div className="grid">{items.map((l) => <ListingCard key={l.id} l={l} />)}</div>}
    </main>
  )
}
