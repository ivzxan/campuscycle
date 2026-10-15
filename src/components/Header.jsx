import { Link, NavLink, useMatch } from 'react-router-dom'
import { useAuth } from '../auth'
import { useBadges } from '../badges'
import Icon from './Icon'

function Badge({ n }) {
  return n > 0 ? <span className="badge" aria-label={`${n} unread`}>{n > 9 ? '9+' : n}</span> : null
}

function TabBar({ alerts, messages }) {
  const inChat = useMatch('/messages/:id')
  if (inChat) return null
  const cls = ({ isActive }) => `tab${isActive ? ' on' : ''}`
  return (
    <nav className="tabbar" aria-label="Main">
      <NavLink to="/" end className={cls}><Icon name="home" /><span>Browse</span></NavLink>
      <NavLink to="/messages" className={cls}>
        <span className="ico"><Icon name="chat" /><Badge n={messages} /></span><span>Messages</span>
      </NavLink>
      <NavLink to="/post" className="tab tab-post"><span className="plus"><Icon name="plus" size={24} /></span><span>Post</span></NavLink>
      <NavLink to="/alerts" className={cls}>
        <span className="ico"><Icon name="bell" /><Badge n={alerts} /></span><span>Alerts</span>
      </NavLink>
      <NavLink to="/me" className={cls}><Icon name="user" /><span>Me</span></NavLink>
    </nav>
  )
}

export default function Header() {
  const { user, loading } = useAuth()
  const { alerts, messages } = useBadges()
  const link = ({ isActive }) => `navlink${isActive ? ' on' : ''}`
  return (
    <>
      <header className="top">
        <div className="wrap bar">
          <Link to="/" className="logo">
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="42 14" strokeLinecap="round" />
            </svg>
            CampusCycle
          </Link>
          <nav className="topnav" aria-label="Main">
            <NavLink to="/" end className={link}>Browse</NavLink>
            <NavLink to="/messages" className={link}>Messages <Badge n={messages} /></NavLink>
            <NavLink to="/alerts" className={link}>Alerts <Badge n={alerts} /></NavLink>
            {user ? <NavLink to="/me" className={link}>My space</NavLink>
              : !loading && <NavLink to="/login" className={link}>Log in</NavLink>}
            <Link to="/post" className="btn btn-accent">Post an item</Link>
          </nav>
          {!user && !loading && <Link to="/login" className="btn btn-small mobile-only">Log in</Link>}
        </div>
      </header>
      <TabBar alerts={alerts} messages={messages} />
    </>
  )
}
