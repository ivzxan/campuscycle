import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../auth'
import { AFFILIATIONS } from '../constants'

function friendly(message) {
  if (/invalid login/i.test(message)) return 'Wrong email or password.'
  if (/already registered/i.test(message)) return 'That email already has an account. Log in instead.'
  if (/password/i.test(message) && /6|8|short|weak/i.test(message)) return 'Use a password with at least 8 characters.'
  return message
}

export default function AuthPage() {
  const { user } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const [mode, setMode] = useState('login')
  const [f, setF] = useState({ email: '', password: '', name: '', program: 'BSIS', affiliation: 'student' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (user) nav(loc.state?.from || '/', { replace: true })
  }, [user, nav, loc.state])

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setNotice('')
    if (mode === 'signup' && f.name.trim().length < 2) return setErr('Enter the name other students will see.')
    if (f.password.length < 8) return setErr('Use a password with at least 8 characters.')
    setBusy(true)
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email: f.email.trim(), password: f.password })
      if (error) setErr(friendly(error.message))
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: f.email.trim(),
        password: f.password,
        options: {
          data: { display_name: f.name.trim(), program: f.program.trim() || 'BSIS', affiliation: f.affiliation },
          emailRedirectTo: window.location.origin,
        },
      })
      if (error) setErr(friendly(error.message))
      else if (!data.session) setNotice('Check your email to confirm your account, then log in.')
    }
    setBusy(false)
  }

  async function forgot() {
    if (!f.email.trim()) return setErr('Enter your email first, then tap "Forgot password".')
    setErr('')
    const { error } = await supabase.auth.resetPasswordForEmail(f.email.trim(), {
      redirectTo: `${window.location.origin}/reset`,
    })
    if (error) setErr(error.message)
    else setNotice('If that email has an account, a reset link is on its way.')
  }

  const login = mode === 'login'
  return (
    <main className="auth">
      <aside className="auth-side">
        <div className="stickers stickers-row" aria-hidden="true">
          <span className="tag tag-free sticker s1">Free</span>
          <span className="tag tag-swap sticker s2">Swap</span>
          <span className="tag tag-sell sticker s3">For sale</span>
        </div>
        <h1>{login ? 'Welcome back' : 'Join your campus swap'}</h1>
        <p>Give away what you are done with. Find what you need next.</p>
        <ul className="perks">
          <li>Post an item in under a minute</li>
          <li>Chat inside the app, no phone number needed</li>
          <li>Get an alert when someone replies</li>
        </ul>
      </aside>

      <section className="auth-card">
        <h2>{login ? 'Log in' : 'Create your account'}</h2>
        <p className="muted">
          {login
            ? 'Log in to post items and message other students.'
            : 'Use a personal email so your account still works after you graduate.'}
        </p>
        <form onSubmit={submit} className="form">
          {!login && (
            <>
              <label>Display name
                <input value={f.name} onChange={set('name')} maxLength={40} autoComplete="nickname" required />
              </label>
              <div className="two">
                <label>Program
                  <input value={f.program} onChange={set('program')} maxLength={30} />
                </label>
                <label>I am a
                  <select value={f.affiliation} onChange={set('affiliation')}>
                    {Object.entries(AFFILIATIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
              </div>
            </>
          )}
          <label>Email
            <input type="email" value={f.email} onChange={set('email')} autoComplete="email" required />
          </label>
          <label>Password
            <input type="password" value={f.password} onChange={set('password')}
              autoComplete={login ? 'current-password' : 'new-password'} minLength={8} required />
          </label>
          {err && <p className="err" role="alert">{err}</p>}
          {notice && <p className="note" role="status">{notice}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Please wait…' : login ? 'Log in' : 'Create account'}
          </button>
        </form>
        <p className="row">
          <button type="button" className="linkbtn" onClick={() => { setMode(login ? 'signup' : 'login'); setErr(''); setNotice('') }}>
            {login ? 'Create an account' : 'I already have an account'}
          </button>
          {login && <button type="button" className="linkbtn" onClick={forgot}>Forgot password</button>}
        </p>
      </section>
    </main>
  )
}
