import { supabase } from './supabase'

// Fires the `parse-intake` Supabase Edge Function right after a hospital's
// PDF upload succeeds. Fire-and-forget: CaseDetail.tsx just shows "PDF not
// parsed yet" until the intake_documents row appears, so a slow/failed call
// here doesn't block case creation.
//
// `functions.invoke` attaches the current session's JWT (or the publishable
// anon key, for an unauthenticated caller) automatically -- see
// supabase/config.toml's verify_jwt note on why that's sufficient here.
export function triggerParseIntake(caseId: string, storagePath: string) {
  supabase.functions.invoke('parse-intake', { body: { caseId, storagePath } }).catch(() => {
    // Swallowed -- see fire-and-forget note above.
  })
}
