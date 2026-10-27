// getmydrug proxy — the only server-side code.
// Holds the Claude API key (ANTHROPIC_API_KEY env var on Vercel) and runs three fixed tasks
// against a policy PDF the browser sends. Nothing is stored here.

const API = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';

const EXTRACT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['payer', 'policy_title', 'program_number', 'effective_date', 'drugs', 'criteria', 'questions', 'notes'],
  properties: {
    payer: { type: 'string', description: 'Insurer or PBM name as written in the document' },
    policy_title: { type: 'string' },
    program_number: { type: 'string', description: 'Policy or program number, or empty string' },
    effective_date: { type: 'string', description: 'YYYY-MM-DD if stated, else empty string' },
    drugs: {
      type: 'array', items: {
        type: 'object', additionalProperties: false, required: ['name', 'generic', 'uses'],
        properties: {
          name: { type: 'string' }, generic: { type: 'string' },
          uses: { type: 'array', items: { type: 'string' }, description: 'Covered uses, e.g. "acute treatment of migraine"' }
        }
      }
    },
    criteria: {
      type: 'array', description: 'Initial authorization criteria, one entry per requirement the patient must meet',
      items: {
        type: 'object', additionalProperties: false, required: ['id', 'drugs', 'use', 'requirement', 'quote', 'logic'],
        properties: {
          id: { type: 'string', description: 'short stable id like c1, c2' },
          drugs: { type: 'array', items: { type: 'string' }, description: 'drug names this applies to, empty = all' },
          use: { type: 'string', description: 'the use/pathway this applies to, or "any"' },
          requirement: { type: 'string', description: 'plain-language statement of the requirement' },
          quote: { type: 'string', description: 'verbatim sentence from the document supporting it' },
          logic: { type: 'string', enum: ['all', 'any'], description: 'whether this criterion combines with siblings by AND (all) or OR (any)' }
        }
      }
    },
    questions: {
      type: 'array', description: 'the minimal set of questions a patient must answer to evaluate the criteria',
      items: {
        type: 'object', additionalProperties: false, required: ['id', 'text', 'type', 'options', 'criterion_ids'],
        properties: {
          id: { type: 'string' },
          text: { type: 'string', description: 'plain language, second person, no jargon' },
          type: { type: 'string', enum: ['single', 'multi', 'yesno', 'number'] },
          options: { type: 'array', items: { type: 'string' } },
          criterion_ids: { type: 'array', items: { type: 'string' } }
        }
      }
    },
    notes: { type: 'array', items: { type: 'string' }, description: 'renewal rules, quantity limits, state or plan exceptions, approval duration' }
  }
};

const CHECK_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['decision', 'criteria', 'patient_summary', 'clinic_checklist', 'missing'],
  properties: {
    decision: { type: 'string', enum: ['likely_meets', 'likely_does_not_meet', 'needs_confirmation'] },
    criteria: {
      type: 'array', items: {
        type: 'object', additionalProperties: false, required: ['id', 'requirement', 'status', 'reason', 'quote'],
        properties: {
          id: { type: 'string' },
          requirement: { type: 'string' },
          status: { type: 'string', enum: ['met', 'not_met', 'confirm'] },
          reason: { type: 'string', description: 'one sentence tying the answer to the requirement' },
          quote: { type: 'string', description: 'verbatim supporting sentence from the policy' }
        }
      }
    },
    patient_summary: { type: 'string', description: 'plain language, 3-5 sentences, no treatment advice; what the plan requires, what they appear to meet, what to bring up with the prescriber' },
    clinic_checklist: { type: 'string', description: 'for office staff preparing a prior authorization: policy name/number/date, each criterion with status and the documentation to attach' },
    missing: { type: 'array', items: { type: 'string' }, description: 'documents or facts still needed' }
  }
};

const GROUNDING = 'Use only the attached policy document. Never invent a criterion, drug, or number that is not in the document. Every quote must be copied verbatim from the document. This is coverage information, not medical advice: never recommend a diagnosis or treatment.';

function buildRequest(task, body) {
  const doc = {
    type: 'document',
    source: { type: 'base64', media_type: 'application/pdf', data: body.pdf_base64 },
    cache_control: { type: 'ephemeral' }
  };
  if (task === 'extract') {
    return {
      model: MODEL, max_tokens: 16000,
      system: GROUNDING,
      messages: [{ role: 'user', content: [doc, { type: 'text', text:
        'Read this prescription drug coverage policy. Keep each quote to one sentence. Extract the payer, the drugs it covers, the initial authorization criteria (one entry per requirement, with a verbatim quote each), and the smallest set of plain-language questions a patient could answer to check those criteria. Put renewal rules, quantity limits, approval duration and state or plan exceptions in notes.' }] }],
      output_config: { format: { type: 'json_schema', schema: EXTRACT_SCHEMA } }
    };
  }
  if (task === 'check') {
    return {
      model: MODEL, max_tokens: 4000,
      system: GROUNDING,
      messages: [{ role: 'user', content: [doc, { type: 'text', text:
        'A patient wants ' + body.drug + ' for ' + body.use + '. Here are their answers to the screening questions:\n' +
        JSON.stringify(body.answers, null, 2) +
        '\n\nEvaluate each initial-authorization criterion for this drug and use against the answers. Mark met, not_met, or confirm (when the answer is missing or unclear). Then write a patient summary in plain language and a clinic checklist for preparing the prior authorization.' }] }],
      output_config: { format: { type: 'json_schema', schema: CHECK_SCHEMA } }
    };
  }
  if (task === 'ask') {
    return {
      model: MODEL, max_tokens: 800,
      system: GROUNDING + ' Answer in plain language in under 120 words. If the document does not answer the question, say so.',
      messages: [{ role: 'user', content: [doc, { type: 'text', text: body.question }] }]
    };
  }
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not set on the server' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const request = buildRequest(body.task, body);
  if (!request) return res.status(400).json({ error: 'unknown task' });
  if (!body.pdf_base64) return res.status(400).json({ error: 'pdf_base64 missing' });

  const r = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(request)
  });
  const data = await r.json();
  if (!r.ok) return res.status(r.status).json({ error: (data.error && data.error.message) || 'Claude API error' });

  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  if (body.task === 'ask') return res.status(200).json({ answer: text });
  if (data.stop_reason === 'max_tokens') return res.status(502).json({ error: 'The policy is too long to extract in one pass; split the PDF by drug and add the parts separately.' });
  try { return res.status(200).json(JSON.parse(text)); }
  catch (e) { return res.status(502).json({ error: 'Model returned non-JSON', raw: text.slice(0, 500) }); }
};
