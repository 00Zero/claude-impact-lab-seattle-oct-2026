import { supabase } from './supabase'

export type Role = 'hospital' | 'family'

/**
 * Sends a magic-link email. Works for both sign-up and sign-in: if the email
 * is new, Supabase creates the auth user with `role` in its metadata, which
 * `handle_new_user` (see supabase/migrations) copies into `profiles.role`.
 * For an existing user `role` is ignored, matching the trigger firing only on
 * insert into auth.users.
 */
export async function sendMagicLink(email: string, role: Role, redirectTo: string = window.location.origin) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      data: { role },
    },
  })
  if (error) throw error
}

/**
 * Starts a family session with no email. Creates an anonymous Supabase user
 * (role metadata is copied into `profiles.role` by `handle_new_user`). The
 * session lives in this browser only; an email can be attached later.
 */
export async function startAnonymousFamilySession() {
  const { error } = await supabase.auth.signInAnonymously({ options: { data: { role: 'family' } } })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
