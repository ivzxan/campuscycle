import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BUCKET, imageUrl, supabase } from '../supabase'
import { useAuth } from '../auth'
import { CATEGORIES, CONDITIONS, SUBJECTS, TYPES } from '../constants'
import { prepareImage } from '../image'

const HINTS = {
  sell: { title: 'What are you selling?', desc: 'Condition, what is included, and where you can meet.' },
  free: { title: 'What are you giving away?', desc: 'What is included and where it can be picked up.' },
  swap: { title: 'What are you offering to swap?', desc: 'What is included and what you would like in return.' },
  looking_for: { title: 'What do you need?', desc: 'Model, quantity, and when you need it by.' },
}

export default function ListingForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { user } = useAuth()
  const nav = useNavigate()

  const startType = TYPES[params.get('type')] ? params.get('type') : 'free'
  const [f, setF] = useState({
    type: startType, title: '', category: 'electronics', course: '',
    condition: 'good', price: '', swap_for: '', description: '',
  })
  const [existing, setExisting] = useState([])
  const [removed, setRemoved] = useState([])
  const [added, setAdded] = useState([])
  const [ready, setReady] = useState(!id)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const createdId = useRef(null)
  const uploaded = useRef(new Set())

  useEffect(() => {
    if (!id) return
    supabase.from('listings')
      .select('*, listing_images(id,path,thumb_path,position)')
      .eq('id', id).maybeSingle()
      .then(({ data }) => {
        if (!data || data.user_id !== user.id) return nav('/me', { replace: true })
        setF({
          type: data.type, title: data.title, category: data.category, course: data.course || '',
          condition: data.condition || 'good', price: data.price ?? '', swap_for: data.swap_for || '',
          description: data.description || '',
        })
        setExisting([...data.listing_images].sort((a, b) => a.position - b.position))
        setReady(true)
      })
  }, [id, user.id, nav])

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const kept = existing.filter((x) => !removed.includes(x.id))
  const room = 3 - kept.length - added.length

  async function onPick(e) {
    const files = [...e.target.files].slice(0, Math.max(room, 0))
    e.target.value = ''
    setErr('')
    for (const file of files) {
      try {
        const img = await prepareImage(file)
        setAdded((prev) => [...prev, img])
      } catch {
        setErr('One photo could not be read. Use a JPG or PNG file.')
      }
    }
  }

  async function submit(e) {
    e.preventDefault()
    setErr('')
    const title = f.title.trim()
    if (title.length < 3) return setErr('Add a title with at least 3 characters.')
    if (f.type === 'sell' && (f.price === '' || Number(f.price) < 0 || Number.isNaN(Number(f.price)))) {
      return setErr('Enter a price in pesos.')
    }
    setBusy(true)
    const row = {
      type: f.type,
      title,
      category: f.category,
      course: f.course.trim() || null,
      condition: f.type === 'looking_for' ? null : f.condition,
      price: f.type === 'sell' ? Number(f.price) : null,
      swap_for: f.type === 'swap' ? f.swap_for.trim() || null : null,
      description: f.description.trim(),
    }
    try {
      let listingId = id || createdId.current
      if (listingId) {
        const { error } = await supabase.from('listings').update(row).eq('id', listingId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('listings').insert(row).select('id').single()
        if (error) throw error
        listingId = data.id
        createdId.current = listingId
      }

      if (removed.length) {
        const gone = existing.filter((x) => removed.includes(x.id))
        await supabase.storage.from(BUCKET).remove(gone.flatMap((x) => [x.path, x.thumb_path]))
        await supabase.from('listing_images').delete().in('id', removed)
        setExisting(existing.filter((x) => !removed.includes(x.id)))
        setRemoved([])
      }

      const base = kept.length
      for (let i = 0; i < added.length; i++) {
        if (uploaded.current.has(added[i].url)) continue
        const key = `${user.id}/${listingId}/${crypto.randomUUID()}`
        const opts = { contentType: 'image/jpeg', cacheControl: '31536000' }
        const a = await supabase.storage.from(BUCKET).upload(`${key}.jpg`, added[i].main, opts)
        if (a.error) throw a.error
        const t = await supabase.storage.from(BUCKET).upload(`${key}-t.jpg`, added[i].thumb, opts)
        if (t.error) throw t.error
        const r = await supabase.from('listing_images').insert({
          listing_id: listingId, path: `${key}.jpg`, thumb_path: `${key}-t.jpg`, position: base + i,
        })
        if (r.error) throw r.error
        uploaded.current.add(added[i].url)
      }
      nav(`/listing/${listingId}`, { replace: true })
    } catch (e2) {
      setErr(e2.message || 'Something went wrong. Try again.')
      setBusy(false)
    }
  }

  if (!ready) return <p className="wrap status">Loading…</p>
  const hint = HINTS[f.type]

  return (
    <main className="wrap narrow">
      <h1>{id ? 'Edit listing' : 'Post an item'}</h1>
      <form onSubmit={submit} className="form">
        <fieldset className="seg-group">
          <legend>What would you like to do?</legend>
          {Object.entries(TYPES).map(([k, v]) => (
            <label key={k} className={`seg seg-${k}${f.type === k ? ' on' : ''}`}>
              <input type="radio" name="type" value={k} checked={f.type === k} onChange={set('type')} className="sr" />
              {v.label}
            </label>
          ))}
        </fieldset>

        <label>{hint.title}
          <input value={f.title} onChange={set('title')} maxLength={80} required />
        </label>

        <label>Category
          <select value={f.category} onChange={set('category')}>
            {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>

        <label>Subject (optional)
          <input value={f.course} onChange={set('course')} maxLength={60} list="subjects" placeholder="Helps classmates find it" />
          <datalist id="subjects">{SUBJECTS.map((s) => <option key={s} value={s} />)}</datalist>
        </label>

        {f.type !== 'looking_for' && (
          <label>Condition
            <select value={f.condition} onChange={set('condition')}>
              {Object.entries(CONDITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        )}

        {f.type === 'sell' && (
          <label>Price (₱)
            <input type="number" inputMode="decimal" min="0" step="0.01" value={f.price} onChange={set('price')} required />
          </label>
        )}
        {f.type === 'swap' && (
          <label>Looking to swap for (optional)
            <input value={f.swap_for} onChange={set('swap_for')} maxLength={80} />
          </label>
        )}

        <label>Details
          <textarea value={f.description} onChange={set('description')} maxLength={1000} rows={4} placeholder={hint.desc} />
        </label>

        <div>
          <p className="label">Photos (up to 3)</p>
          <div className="photos">
            {kept.map((x) => (
              <div key={x.id} className="photo">
                <img src={imageUrl(x.thumb_path)} alt="" width="96" height="72" />
                <button type="button" onClick={() => setRemoved([...removed, x.id])} aria-label="Remove photo">Remove</button>
              </div>
            ))}
            {added.map((x, n) => (
              <div key={x.url} className="photo">
                <img src={x.url} alt="" width="96" height="72" />
                <button type="button" onClick={() => setAdded(added.filter((_, j) => j !== n))} aria-label="Remove photo">Remove</button>
              </div>
            ))}
          </div>
          {room > 0 && (
            <input type="file" accept="image/*" multiple onChange={onPick} aria-label="Add photos" />
          )}
          <p className="muted small">Photos are shrunk on your phone before upload, so they stay quick to load.</p>
        </div>

        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : id ? 'Save changes' : 'Publish'}</button>
      </form>
    </main>
  )
}
