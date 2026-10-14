import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const configured = Boolean(url && key)
export const supabase = configured ? createClient(url, key) : null
export const BUCKET = 'listing-images'

export const imageUrl = (path) =>
  supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
