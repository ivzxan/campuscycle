import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../auth'
import { AFFILIATIONS, timeAgo } from '../constants'
import TypeTag from '../components/TypeTag'

export default function MyStuff() {
  const { user, profile, signOut } = useAuth()
  const [mine, setMine] = useState(null)
  const [sent, setSent] = useState(null)

  useEffect(() => {
    supabase.from('listings')
      .select('id,type,title,status,created_at,contact_requests(count)')
      .eq('user_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => setMine(data || []))
    supabase.from('contact_requests')
      .select('id,created_at,message,listings(id,title,status)')
      .eq('from_user', user.id).order('created_at', { ascending: false })
      .then(({ data }) => setSent(data || []))
  }, [user.id])

  async function toggle(l) {
    const status = l.status === 'done' ? 'active' : 'done'
    const { error } = await supabase.from('listings').update({ status }).eq('id', l.id)
    if (!error) setMine(mine.map((x) => (x.id === l.id ? { ...x, status } : x)))
  }

  async function withdraw(id) {
    const { error } = await supabase.from('contact_requests').delete().eq('id', id)
    if (!error) setSent(sent.filter((x) => x.id !== id))
  }

  return (
    <main className="wrap narrow">
      <header className="me">
        <div>
          <h1>{profile?.display_name || 'My stuff'}</h1>
          {profile && <p className="muted">{profile.program} {AFFILIATIONS[profile.affiliation]?.toLowerCase()}</p>}
        </div>
        <button type="button" className="btn" onClick={signOut}>Log out</button>
      </header>

      <h2>My listings</h2>
      {mine === null && <p className="status">Loading…</p>}
      {mine?.length === 0 && (
        <p>You have not posted anything yet. <Link to="/post">Post your first item</Link></p>
      )}
      <ul className="list">
        {mine?.map((l) => {
          const n = l.contact_requests?.[0]?.count || 0
          return (
            <li key={l.id} className={l.status === 'done' ? 'dim' : ''}>
              <div>
                <TypeTag type={l.type} />
                <Link to={`/listing/${l.id}`} className="ltitle">{l.title}</Link>
                <p className="muted small">
                  {l.status === 'done' ? 'Done' : l.status === 'hidden' ? 'Hidden by moderators' : 'Active'},
                  {' '}{timeAgo(l.created_at)}{n > 0 && `, ${n} message${n === 1 ? '' : 's'}`}
                </p>
              </div>
              {l.status !== 'hidden' && (
                <button type="button" className="btn" onClick={() => toggle(l)}>
                  {l.status === 'done' ? 'Reopen' : 'Mark as done'}
                </button>
              )}
            </li>
          )
        })}
      </ul>

      <h2>Messages I sent</h2>
      {sent?.length === 0 && <p className="muted">Nothing sent yet.</p>}
      <ul className="list">
        {sent?.map((r) => (
          <li key={r.id}>
            <div>
              {r.listings
                ? <Link to={`/listing/${r.listings.id}`} className="ltitle">{r.listings.title}</Link>
                : <span className="ltitle">Listing no longer available</span>}
              <p className="muted small">{timeAgo(r.created_at)}</p>
            </div>
            <button type="button" className="btn" onClick={() => withdraw(r.id)}>Withdraw</button>
          </li>
        ))}
      </ul>
    </main>
  )
}
