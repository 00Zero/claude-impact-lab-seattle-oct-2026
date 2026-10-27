import { z } from 'zod'
import type { DispositionPreference } from './filterCandidates.ts'

export interface RankCandidateInput {
  id: string
  name: string
  county: string | null
  price_cremation: number | null
  price_burial: number | null
  rating: number | null
}

export interface RankedRecommendation {
  funeral_home_id: string
  rank: number
  rationale: string
}

// Cheap, modern, strong general reasoning -- same model/pattern as the parser.
const MODEL = 'google/gemini-3.8-flash'
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

const PROMPT = `You are ranking funeral homes for a grieving family, based only on the
candidate data provided below (each home's county, price for the family's chosen
disposition, and rating -- "distance" here means same county vs. a neighboring county,
not a precise mileage).

Pick the best candidates and rank them best-first. Write one rationale sentence per pick
that only references the fields actually present in that candidate's data (county/same
area, price, rating) -- never invent a reason not supported by the data (e.g. don't claim
a home is "highly recommended by families" unless a rating is given). If a field is null
for a candidate, don't mention it.`

// apiKey is passed in rather than read from an env var here, so this module
// stays runtime-agnostic (Deno edge function, Node test script, etc.).
export async function rankCandidates(
  disposition: DispositionPreference,
  candidates: RankCandidateInput[],
  apiKey: string,
): Promise<RankedRecommendation[]> {
  if (candidates.length === 0) return []

  const ids = candidates.map((c) => c.id) as [string, ...string[]]
  const maxPicks = Math.min(5, candidates.length)
  const minPicks = Math.min(3, candidates.length)

  const RankedListSchema = z.object({
    recommendations: z
      .array(
        z.object({
          funeral_home_id: z.enum(ids),
          rationale: z.string(),
        }),
      )
      .min(minPicks)
      .max(maxPicks),
  })

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/agenticlantern',
      'X-Title': 'AgenticLantern',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'user',
          content: `${PROMPT}\n\nFamily's disposition preference: ${disposition}\n\nCandidates:\n${JSON.stringify(candidates, null, 2)}`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'ranked_recommendations',
          strict: true,
          schema: z.toJSONSchema(RankedListSchema),
        },
      },
    }),
  })

  if (!res.ok) {
    throw new Error(`OpenRouter request failed: ${res.status} ${await res.text()}`)
  }

  const data = (await res.json()) as { choices: { message: { content: string } }[] }
  const content = data.choices[0]?.message.content
  if (!content) throw new Error('OpenRouter returned no content')

  const parsed = RankedListSchema.parse(JSON.parse(content))
  return parsed.recommendations.map((r, i) => ({
    funeral_home_id: r.funeral_home_id,
    rank: i + 1,
    rationale: r.rationale,
  }))
}
