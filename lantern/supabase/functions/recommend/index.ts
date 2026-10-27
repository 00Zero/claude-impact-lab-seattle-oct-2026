import { createClient } from '@supabase/supabase-js'
import { filterCandidatesForCase } from '../_shared/filterCandidates.ts'
import { rankCandidates } from '../_shared/rankCandidates.ts'
import { corsHeaders } from '../_shared/cors.ts'

interface RecommendRequest {
  caseId: string
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let body: Partial<RecommendRequest>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  if (!body.caseId) {
    return json({ error: 'caseId is required' }, 400)
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Idempotent: a case activated twice (e.g. a retried request) must not
  // re-rank or duplicate rows -- if recommendations already exist, return them as-is.
  const { data: existing, error: existingError } = await supabase
    .from('recommendations')
    .select('*')
    .eq('case_id', body.caseId)
    .order('rank', { ascending: true })

  if (existingError) {
    console.error('Failed to check for existing recommendations', existingError)
    return json({ error: 'Failed to check for existing recommendations' }, 500)
  }

  if (existing && existing.length > 0) {
    return json({ recommendations: existing }, 200)
  }

  const { data: caseRow, error: caseError } = await supabase.from('cases').select('*').eq('id', body.caseId).single()
  if (caseError || !caseRow) {
    console.error('Failed to load case', caseError)
    return json({ error: 'Case not found' }, 404)
  }

  const { data: homes, error: homesError } = await supabase.from('funeral_homes').select('*')
  if (homesError || !homes) {
    console.error('Failed to load funeral homes', homesError)
    return json({ error: 'Failed to load funeral homes' }, 500)
  }

  const candidates = filterCandidatesForCase(homes, caseRow)

  let recommendations: Awaited<ReturnType<typeof rankCandidates>> = []
  if (candidates.length > 0) {
    try {
      const apiKey = Deno.env.get('OPENROUTER_API_KEY')
      if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set')
      recommendations = await rankCandidates(
        // filterCandidatesForCase only returns candidates when disposition_preference is set.
        caseRow.disposition_preference!,
        candidates.map((c) => ({
          id: c.id,
          name: c.name,
          county: c.county,
          price_cremation: c.price_cremation,
          price_burial: c.price_burial,
          rating: c.rating,
        })),
        apiKey,
      )
    } catch (err) {
      console.error('Ranking candidates failed', err)
      return json({ error: 'Failed to rank candidates' }, 500)
    }
  }

  if (recommendations.length > 0) {
    const { error: insertError } = await supabase.from('recommendations').insert(
      recommendations.map((r) => ({
        case_id: body.caseId,
        funeral_home_id: r.funeral_home_id,
        rank: r.rank,
        rationale: r.rationale,
      })),
    )

    if (insertError) {
      console.error('Failed to write recommendations', insertError)
      return json({ error: 'Failed to save recommendations' }, 500)
    }
  }

  const { error: statusError } = await supabase
    .from('cases')
    .update({ status: 'recommendations_ready' })
    .eq('id', body.caseId)

  if (statusError) {
    console.error('Failed to update case status', statusError)
    return json({ error: 'Failed to update case status' }, 500)
  }

  return json({ recommendations }, 200)
})
