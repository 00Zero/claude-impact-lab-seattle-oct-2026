import { Buffer } from 'node:buffer'
import { z } from 'zod'

// Only fields with a column on `cases` (see supabase/migrations) and that
// docs/spec.md's "Parse targets for Milestone 1" section actually lists.
// Cause of death, manner of death, pregnancy, SSN, and certifying physician
// are never in this schema -- structured outputs validate against it, so
// the model cannot return those keys even at low confidence (stronger than
// a prompt instruction alone, which is why there's no "ignored fields"
// branch to test for in the output).
const confidenceField = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.object({
    value: valueSchema.nullable(),
    confidence: z.number().min(0).max(1),
  })

export const ParsedCaseFieldsSchema = z.object({
  legal_first_name: confidenceField(z.string()),
  legal_middle_name: confidenceField(z.string()),
  legal_last_name: confidenceField(z.string()),
  sex: confidenceField(z.string()),
  date_of_birth: confidenceField(z.string().describe('ISO 8601 date, YYYY-MM-DD')),
  age_at_death: confidenceField(z.number()),
  date_of_death: confidenceField(z.string().describe('ISO 8601 date, YYYY-MM-DD')),
  time_of_death: confidenceField(z.string().describe('24-hour HH:MM')),
  facility_name: confidenceField(z.string()),
  facility_city: confidenceField(z.string()),
  facility_state: confidenceField(z.string()),
  facility_zip: confidenceField(z.string()),
  ward: confidenceField(z.string()),
  residence_street: confidenceField(z.string()),
  residence_city: confidenceField(z.string()),
  residence_state: confidenceField(z.string()),
  residence_zip: confidenceField(z.string()),
  residence_county: confidenceField(z.string()),
})

export type ParsedCaseFields = z.infer<typeof ParsedCaseFieldsSchema>

const LOW_CONFIDENCE_THRESHOLD = 0.4

// Cheap, modern, strong native document/PDF understanding -- see
// docs/milestone-1-tasks.md T1.4 for why this model was picked.
const MODEL = 'google/gemini-3.8-flash'
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

const PROMPT = `You are extracting structured fields from a hospital intake document (a
medical certificate of cause of death, or similar paperwork a hospital produces when a
patient has died) for a funeral-planning app.

Extract only the fields in the provided schema. For each field, return the value you
read from the document and a confidence score from 0 (not present / illegible) to 1
(clearly printed and unambiguous). If a field is not present in the document, or you are
not reasonably confident in it, set value to null and confidence accordingly -- never
guess a value just to fill the field.

Do not extract or infer cause of death, manner of death, pregnancy status, the
decedent's Social Security Number, or the certifying physician's name/license number --
none of those are in the schema; ignore them entirely even if printed on the document.

If the document is not a death-related hospital record at all (e.g. an unrelated lab
report), or is unreadable, return every field with value null and confidence 0.`

// apiKey is passed in rather than read from an env var here, so this module
// stays runtime-agnostic (Deno edge function, Node test script, etc.).
export async function parsePdfToCaseFields(pdfBytes: Uint8Array, apiKey: string): Promise<ParsedCaseFields> {
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
          content: [
            { type: 'text', text: PROMPT },
            {
              type: 'file',
              file: {
                filename: 'intake.pdf',
                file_data: `data:application/pdf;base64,${Buffer.from(pdfBytes).toString('base64')}`,
              },
            },
          ],
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'parsed_case_fields',
          strict: true,
          schema: z.toJSONSchema(ParsedCaseFieldsSchema),
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

  const parsed = ParsedCaseFieldsSchema.parse(JSON.parse(content))
  return clampLowConfidence(parsed)
}

// Defense in depth: even if the model attaches a value to a low-confidence
// field against instructions, null it out before it reaches the DB.
function clampLowConfidence(fields: ParsedCaseFields): ParsedCaseFields {
  const result = { ...fields }
  for (const key of Object.keys(result) as (keyof ParsedCaseFields)[]) {
    if (result[key].confidence < LOW_CONFIDENCE_THRESHOLD) {
      result[key] = { value: null, confidence: result[key].confidence }
    }
  }
  return result
}
