import { lazy, Suspense } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth'
import Header from './components/Header'
import Browse from './pages/Browse'

const ListingPage = lazy(() => import('./pages/ListingPage'))
const ListingForm = lazy(() => import('./pages/ListingForm'))
const Me = lazy(() => import('./pages/Me'))
const EditProfile = lazy(() => import('./pages/EditProfile'))
const Profile = lazy(() => import('./pages/Profile'))
const Messages = lazy(() => import('./pages/Messages'))
const Chat = lazy(() => import('./pages/Chat'))
const Alerts = lazy(() => import('./pages/Alerts'))
const AuthPage = lazy(() => import('./pages/Auth'))
const ResetPage = lazy(() => import('./pages/Reset'))

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <p className="wrap status">Loading…</p>
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  return children
}

function NotFound() {
  return (
    <main className="wrap status">
      <h1>Page not found</h1>
      <p><Link to="/">Back to browse</Link></p>
    </main>
  )
}

export default function App() {
  return (
    <>
      <Header />
      <Suspense fallback={<p className="wrap status">Loading…</p>}>
        <Routes>
          <Route path="/" element={<Browse />} />
          <Route path="/listing/:id" element={<ListingPage />} />
          <Route path="/u/:id" element={<Profile />} />
          <Route path="/post" element={<RequireAuth><ListingForm /></RequireAuth>} />
          <Route path="/edit/:id" element={<RequireAuth><ListingForm /></RequireAuth>} />
          <Route path="/me" element={<RequireAuth><Me /></RequireAuth>} />
          <Route path="/me/edit" element={<RequireAuth><EditProfile /></RequireAuth>} />
          <Route path="/messages" element={<RequireAuth><Messages /></RequireAuth>}>
            <Route index element={<div className="thread-empty"><p>Pick a conversation to read it.</p></div>} />
            <Route path=":id" element={<Chat />} />
          </Route>
          <Route path="/alerts" element={<RequireAuth><Alerts /></RequireAuth>} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/reset" element={<ResetPage />} />
          <Route path="/my" element={<Navigate to="/me" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  )
}
