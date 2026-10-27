import { supabase } from './supabase'

// Fires the `recommend` Supabase Edge Function right after a case becomes
// `active`. Fire-and-forget: FamilyCase.tsx's WaitingForRecommendations
// already polls `cases.status`, so a slow/failed call here just leaves the
// family on the waiting screen rather than surfacing a hard error.
//
// Works the same in local dev and deployed -- unlike the old Azure Functions
// same-origin /api/* proxy (which only existed once deployed to Azure SWA),
// this calls the Supabase project directly, so it also works against
// `npx supabase functions serve` locally.
export function triggerRecommend(caseId: string) {
  supabase.functions.invoke('recommend', { body: { caseId } }).catch(() => {
    // Swallowed -- see fire-and-forget note above.
  })
}
