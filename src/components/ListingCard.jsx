import { Link } from 'react-router-dom'
import { imageUrl } from '../supabase'
import { CATEGORIES, priceLine, timeAgo } from '../constants'
import TypeTag from './TypeTag'

export default function ListingCard({ l }) {
  const img = [...(l.listing_images || [])].sort((a, b) => a.position - b.position)[0]
  return (
    <Link to={`/listing/${l.id}`} className="card">
      <div className="thumb">
        {img ? (
          <img src={imageUrl(img.thumb_path)} alt="" loading="lazy" width="360" height="270" />
        ) : (
          <span className="ph">{CATEGORIES[l.category]}</span>
        )}
        <TypeTag type={l.type} />
      </div>
      <div className="body">
        <h3>{l.title}</h3>
        <p className="price">{priceLine(l)}</p>
        <p className="meta">{l.course || CATEGORIES[l.category]}</p>
        <p className="meta">{timeAgo(l.created_at)}</p>
      </div>
    </Link>
  )
}
