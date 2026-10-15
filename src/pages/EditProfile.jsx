import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../auth'
import { AFFILIATIONS, AVATAR_COLORS } from '../constants'
import Avatar from '../components/Avatar'

export default function EditProfile() {
  const { user, profile, refreshProfile } = useAuth()
  const [f, setF] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [saved, setSaved] = useState(false)
  const [pw, setPw] = useState('')
  const [pwMsg, setPwMsg] = useState('')

  useEffect(() => {
    if (profile && !f) {
      setF({
        display_name: profile.display_name, program: profile.program,
        affiliation: profile.affiliation, bio: profile.bio || '', avatar_color: profile.avatar_color,
      })
    }
  }, [profile, f])

  if (!f) return <p className="wrap status">Loading…</p>
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setSaved(false) }

  async function save(e) {
    e.preventDefault()
    setErr('')
    if (f.display_name.trim().length < 2) return setErr('Display name needs at least 2 characters.')
    if (f.program.trim().length < 2) return setErr('Enter your program, for example BSIS.')
    setBusy(true)
    const { error } = await supabase.from('profiles').update({
      display_name: f.display_name.trim(),
      program: f.program.trim(),
      affiliation: f.affiliation,
      bio: f.bio.trim(),
      avatar_color: f.avatar_color,
    }).eq('id', user.id)
    setBusy(false)
    if (error) return setErr(error.message)
    await refreshProfile()
    setSaved(true)
  }

  async function changePassword(e) {
    e.preventDefault()
    setPwMsg('')
    if (pw.length < 8) return setPwMsg('Use a password with at least 8 characters.')
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) setPwMsg(error.message)
    else { setPwMsg('Password changed.'); setPw('') }
  }

  return (
    <main className="wrap narrow">
      <p><Link to="/me">Back to my space</Link></p>
      <h1>Edit profile</h1>
      <div className="avatar-preview">
        <Avatar profile={f} size={72} />
        <p className="muted">This is how other students see you.</p>
      </div>
      <form onSubmit={save} className="form">
        <fieldset>
          <legend>Avatar color</legend>
          <div className="swatches">
            {Object.entries(AVATAR_COLORS).map(([k, hex]) => (
              <label key={k} className={`swatch${f.avatar_color === k ? ' on' : ''}`} style={{ background: hex }}>
                <input type="radio" name="color" className="sr" checked={f.avatar_color === k}
                  onChange={() => { setF({ ...f, avatar_color: k }); setSaved(false) }} />
                <span className="sr">{k}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label>Display name
          <input value={f.display_name} onChange={set('display_name')} maxLength={40} required />
        </label>
        <div className="two">
          <label>Program
            <input value={f.program} onChange={set('program')} maxLength={30} required />
          </label>
          <label>I am a
            <select value={f.affiliation} onChange={set('affiliation')}>
              {Object.entries(AFFILIATIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>
        <label>About you (optional)
          <textarea value={f.bio} onChange={set('bio')} maxLength={200} rows={3}
            placeholder="Subjects you took, what you usually sell or give away" />
          <span className="muted small">{f.bio.length}/200</span>
        </label>
        {err && <p className="err" role="alert">{err}</p>}
        {saved && <p className="note" role="status">Profile saved.</p>}
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      </form>

      <form onSubmit={changePassword} className="form panel">
        <h2>Change password</h2>
        <label>New password
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} autoComplete="new-password" />
        </label>
        {pwMsg && <p className="note" role="status">{pwMsg}</p>}
        <button className="btn">Update password</button>
      </form>
    </main>
  )
}
