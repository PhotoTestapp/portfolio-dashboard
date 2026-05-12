// Optional Supabase sync adapter.
// This file is intentionally not imported by default. Wire it into App.jsx only after Supabase is configured.
// Frontend must use only VITE_SUPABASE_ANON_KEY with RLS enabled.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export async function getCurrentUser() {
  if (!supabase) return { user: null, error: new Error('Supabase is not configured') }
  const { data, error } = await supabase.auth.getUser()
  return { user: data?.user ?? null, error }
}

export async function signInWithEmail(email) {
  if (!supabase) return { error: new Error('Supabase is not configured') }
  return supabase.auth.signInWithOtp({ email })
}

export async function signOut() {
  if (!supabase) return { error: new Error('Supabase is not configured') }
  return supabase.auth.signOut()
}

export async function loadPortfolioState() {
  if (!supabase) return { state: null, error: new Error('Supabase is not configured') }
  const { user, error: userError } = await getCurrentUser()
  if (userError || !user) return { state: null, error: userError || new Error('Not signed in') }

  const { data, error } = await supabase
    .from('portfolio_state')
    .select('revision,state,state_hash,updated_at')
    .eq('user_id', user.id)
    .maybeSingle()

  return { state: data, error }
}

export async function savePortfolioState({ state, stateHash, revision }) {
  if (!supabase) return { error: new Error('Supabase is not configured') }
  const { user, error: userError } = await getCurrentUser()
  if (userError || !user) return { error: userError || new Error('Not signed in') }

  const payload = {
    user_id: user.id,
    revision,
    state,
    state_hash: stateHash
  }

  return supabase
    .from('portfolio_state')
    .upsert(payload, { onConflict: 'user_id' })
    .select('revision,state_hash,updated_at')
    .single()
}

export async function appendAuditLog({ eventType, payload, revision }) {
  if (!supabase) return { error: new Error('Supabase is not configured') }
  const { user, error: userError } = await getCurrentUser()
  if (userError || !user) return { error: userError || new Error('Not signed in') }

  return supabase.from('audit_log').insert({
    user_id: user.id,
    revision,
    event_type: eventType,
    payload
  })
}
