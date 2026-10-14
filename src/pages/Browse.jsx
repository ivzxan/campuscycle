import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase'
import { CATEGORIES, TYPES } from '../constants'
import ListingCard from '../components/ListingCard'

const PAGE = 12
const COLS = 'id,type,title,price,swap_for,course,category,created_at,listing_images(thumb_path,position)'

export default function Browse() {
  const [params, setParams] = useSearchParams()
  const type = params.get('type') || ''
  const cat = params.get('cat') || ''
  const q = params.get('q') || ''

  const [text, setText] = useState(q)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [more, setMore] = useState(false)
  const [error, setError] = useState('')

  function setParam(key, value) {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    }, { replace: true })
  }

  // Debounce the search box so we do not query on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      if (text.trim() !== q) setParam('q', text.trim())
    }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  function fetchPage(offset) {
    let qb = supabase
      .from('listings')
      .select(COLS)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE - 1)
    if (type) qb = qb.eq('type', type)
    if (cat) qb = qb.eq('category', cat)
    if (q) {
      const s = q.replace(/[%,()"\\*]/g, ' ').trim()
      if (s) qb = qb.or(`title.ilike.%${s}%,course.ilike.%${s}%,description.ilike.%${s}%`)
    }
    return qb
  }

  useEffect(() => {
    let stale = false
    setLoading(true)
    setError('')
    fetchPage(0).then(({ data, error }) => {
      if (stale) return
      if (error) setError('Could not load listings. Check your connection and try again.')
      else {
        setItems(data)
        setMore(data.length === PAGE)
      }
      setLoading(false)
    })
    return () => { stale = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, cat, q])

  async function loadMore() {
    setLoading(true)
    const { data, error } = await fetchPage(items.length)
    if (error) setError('Could not load more. Try again.')
    else {
      setItems((prev) => [...prev, ...data])
      setMore(data.length === PAGE)
    }
    setLoading(false)
  }

  return (
    <main className="wrap">
      <section className="intro">
        <h1>Find it or pass it on</h1>
        <p>Books, components, and materials from BSIS students and alumni.</p>
      </section>

      <div className="filters">
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search items or subjects"
          aria-label="Search listings"
        />
        <div className="chips" role="group" aria-label="Listing type">
          <button type="button" className="chip" aria-pressed={!type} onClick={() => setParam('type', '')}>All</button>
          {Object.entries(TYPES).map(([k, v]) => (
            <button key={k} type="button" className="chip" aria-pressed={type === k} onClick={() => setParam('type', k)}>
              {v.label}
            </button>
          ))}
        </div>
        <select value={cat} onChange={(e) => setParam('cat', e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {error && <p className="err" role="alert">{error}</p>}

      {items.length > 0 && (
        <div className="grid">
          {items.map((l) => <ListingCard key={l.id} l={l} />)}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="empty">
          <h2>Nothing here yet</h2>
          <p>Post what you no longer need, or ask for what you are looking for.</p>
          <div className="row">
            <Link to="/post" className="btn btn-primary">Post an item</Link>
            <Link to="/post?type=looking_for" className="btn">Post what you need</Link>
          </div>
        </div>
      )}

      {loading && <p className="status">Loading…</p>}
      {!loading && more && (
        <p className="center"><button type="button" className="btn" onClick={loadMore}>Show more</button></p>
      )}
    </main>
  )
}
