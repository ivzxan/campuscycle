import { Link } from 'react-router-dom'
import { useAuth } from '../auth'

export default function Header() {
  const { user, loading } = useAuth()
  return (
    <header className="top">
      <div className="wrap bar">
        <Link to="/" className="logo">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="42 14" strokeLinecap="round" />
          </svg>
          CampusCycle
        </Link>
        <nav aria-label="Main">
          {!loading && (user
            ? <Link to="/my" className="navlink">My stuff</Link>
            : <Link to="/login" className="navlink">Log in</Link>)}
          <Link to="/post" className="btn btn-primary">Post</Link>
        </nav>
      </div>
    </header>
  )
}
