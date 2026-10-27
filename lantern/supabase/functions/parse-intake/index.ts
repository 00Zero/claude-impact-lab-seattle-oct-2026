import { createClient } from '@supabase/supabase-js'
import { parsePdfToCaseFields } from '../_shared/parsePdfToCase.ts'
import { corsHeaders } from '../_shared/cors.ts'

interface ParseIntakeRequest {
  caseId: string
  storagePath: string
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let body: Partial<ParseIntakeRequest>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  if (!body.caseId || !body.storagePath) {
    return json({ error: 'caseId and storagePath are required' }, 400)
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: pdfBlob, error: downloadError } = await supabase.storage
    .from('intake-documents')
    .download(body.storagePath)

  if (downloadError || !pdfBlob) {
    console.error('Failed to download intake PDF', downloadError)
    return json({ error: 'Failed to download intake document' }, 500)
  }

  const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer())

  // Per spec: a parse failure (corrupted/scanned/unrelated document) still
  // creates the intake_documents row with everything blank -- it must not
  // fail the upload.
  let parsedFields = null
  try {
    const apiKey = Deno.env.get('OPENROUTER_API_KEY')
    if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set')
    parsedFields = await parsePdfToCaseFields(pdfBytes, apiKey)
  } catch (err) {
    console.error('PDF parse failed, writing all-null fields', err)
    parsedFields = null
  }

  const { error: insertError } = await supabase.from('intake_documents').insert({
    case_id: body.caseId,
    storage_path: body.storagePath,
    parsed_fields: parsedFields,
  })

  if (insertError) {
    console.error('Failed to write intake_documents row', insertError)
    return json({ error: 'Failed to save parsed fields' }, 500)
  }

  return json({ parsedFields }, 200)
})
