import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BUCKET, imageUrl, supabase } from '../supabase'
import { useAuth } from '../auth'
import { useBadges } from '../badges'
import { AFFILIATIONS, timeAgo } from '../constants'
import Avatar from '../components/Avatar'
import TypeTag from '../components/TypeTag'

export default function Me() {
  const { user, profile, signOut } = useAuth()
  const { messages } = useBadges()
  const [rows, setRows] = useState(null)
  const [show, setShow] = useState('active')

  useEffect(() => {
    supabase.from('listings')
      .select('id,type,title,status,created_at,listing_images(path,thumb_path,position),conversations(count)')
      .eq('user_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => setRows(data || []))
  }, [user.id])

  async function toggle(l) {
    const status = l.status === 'done' ? 'active' : 'done'
    const { error } = await supabase.from('listings').update({ status }).eq('id', l.id)
    if (!error) setRows(rows.map((x) => (x.id === l.id ? { ...x, status } : x)))
  }

  async function remove(l) {
    if (!window.confirm(`Delete "${l.title}"? This cannot be undone.`)) return
    const paths = l.listing_images.flatMap((i) => [i.path, i.thumb_path])
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
    const { error } = await supabase.from('listings').delete().eq('id', l.id)
    if (!error) setRows(rows.filter((x) => x.id !== l.id))
  }

  const active = rows?.filter((l) => l.status === 'active') || []
  const done = rows?.filter((l) => l.status === 'done') || []
  const shown = show === 'active' ? active : done

  return (
    <main className="wrap narrow wide">
      <section className="me-card">
        <Avatar profile={profile} size={64} />
        <div className="me-info">
          <h1>{profile?.display_name || 'My space'}</h1>
          {profile && <p className="muted">{profile.program} {AFFILIATIONS[profile.affiliation]?.toLowerCase()}</p>}
          {profile?.bio && <p>{profile.bio}</p>}
        </div>
        <div className="me-actions">
          <Link to="/me/edit" className="btn btn-small">Edit profile</Link>
          <Link to={`/u/${user.id}`} className="btn btn-small">View public profile</Link>
        </div>
      </section>

      <section className="stats" aria-label="Summary">
        <div className="stat"><b>{rows ? active.length : '–'}</b><span>Active listings</span></div>
        <div className="stat"><b>{rows ? done.length : '–'}</b><span>Completed</span></div>
        <Link to="/messages" className="stat link"><b>{messages}</b><span>Unread messages</span></Link>
      </section>

      <div className="row">
        <Link to="/post" className="btn btn-accent">Post an item</Link>
        <Link to="/post?type=looking_for" className="btn">Post what you need</Link>
      </div>

      <div className="page-head">
        <h2>My listings</h2>
        <div className="chips" role="group" aria-label="Show">
          <button type="button" className="chip" aria-pressed={show === 'active'} onClick={() => setShow('active')}>Active</button>
          <button type="button" className="chip" aria-pressed={show === 'done'} onClick={() => setShow('done')}>Completed</button>
        </div>
      </div>

      {rows === null && <p className="status">Loading…</p>}
      {rows && shown.length === 0 && (
        <div className="empty">
          <h2>{show === 'active' ? 'No active listings' : 'Nothing completed yet'}</h2>
          <p>{show === 'active' ? 'Post something you no longer need. Someone on campus may be looking for it.' : 'Listings you mark as done appear here.'}</p>
        </div>
      )}
      <ul className="list">
        {shown.map((l) => {
          const thumb = [...l.listing_images].sort((a, b) => a.position - b.position)[0]
          const n = l.conversations?.[0]?.count || 0
          return (
            <li key={l.id}>
              <Link to={`/listing/${l.id}`} className="list-thumb">
                {thumb ? <img src={imageUrl(thumb.thumb_path)} alt="" width="72" height="54" loading="lazy" /> : <span />}
              </Link>
              <div className="list-main">
                <TypeTag type={l.type} />
                <Link to={`/listing/${l.id}`} className="ltitle">{l.title}</Link>
                <p className="muted small">
                  {l.status === 'done' ? 'Completed' : 'Active'}, posted {timeAgo(l.created_at)}
                  {n > 0 && `, ${n} chat${n === 1 ? '' : 's'}`}
                </p>
                <div className="row tight">
                  <Link to={`/edit/${l.id}`} className="btn btn-small">Edit</Link>
                  <button type="button" className="btn btn-small" onClick={() => toggle(l)}>
                    {l.status === 'done' ? 'Reopen' : 'Mark as done'}
                  </button>
                  <button type="button" className="btn btn-small btn-danger" onClick={() => remove(l)}>Delete</button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      <p className="center"><button type="button" className="linkbtn" onClick={signOut}>Log out</button></p>
    </main>
  )
}
