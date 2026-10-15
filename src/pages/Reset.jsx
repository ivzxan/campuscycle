import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../auth'

export default function Reset() {
  const { user, loading } = useAuth()
  const nav = useNavigate()
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (password.length < 8) return setErr('Use a password with at least 8 characters.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setErr(error.message); setBusy(false) } else nav('/me', { replace: true })
  }

  if (loading) return <p className="wrap status">Loading…</p>
  if (!user) {
    return (
      <main className="wrap narrow">
        <h1>Reset your password</h1>
        <p>Open the reset link from your email on this device. <Link to="/login">Back to log in</Link></p>
      </main>
    )
  }
  return (
    <main className="wrap narrow">
      <h1>Choose a new password</h1>
      <form onSubmit={submit} className="form">
        <label>New password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} autoComplete="new-password" required />
        </label>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn btn-primary" disabled={busy}>Save password</button>
      </form>
    </main>
  )
}
