import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

const Ctx = createContext({ user: null, profile: null, loading: true, signOut() {} })
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const uid = session?.user?.id
  useEffect(() => {
    if (!uid) {
      setProfile(null)
      return
    }
    supabase
      .from('profiles')
      .select('display_name,program,affiliation')
      .eq('id', uid)
      .maybeSingle()
      .then(({ data }) => setProfile(data))
  }, [uid])

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      profile,
      loading: session === undefined,
      signOut: () => supabase.auth.signOut(),
    }),
    [session, profile]
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
