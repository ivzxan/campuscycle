import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

const Ctx = createContext({ user: null, profile: null, loading: true, signOut() {}, refreshProfile() {} })
export const useAuth = () => useContext(Ctx)

const PROFILE_COLS = 'id,display_name,program,affiliation,bio,avatar_color,created_at'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const uid = session?.user?.id
  const refreshProfile = useCallback(async () => {
    if (!uid) return setProfile(null)
    const { data } = await supabase.from('profiles').select(PROFILE_COLS).eq('id', uid).maybeSingle()
    setProfile(data)
  }, [uid])

  useEffect(() => { refreshProfile() }, [refreshProfile])

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      profile,
      loading: session === undefined,
      signOut: () => supabase.auth.signOut(),
      refreshProfile,
    }),
    [session, profile, refreshProfile]
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
