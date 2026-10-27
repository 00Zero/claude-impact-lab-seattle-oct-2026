-- AI intake (C3–C5) and the brief contractors see after submission.
--
-- Customers never touch these tables. The app server checks the link token
-- (or the contractor's workspace) and then writes with the secret key, so
-- every row is tied to an already-authorized request. Contractors read their
-- workspace's rows through RLS.

alter table public.service_requests
  -- The customer's optional closing note from the review step.
  add column customer_note text
    check (customer_note is null or char_length(customer_note) <= 2000);

-- One AI pass over the customer's photos and description (C4) that also
-- writes the first questions (C5). Kept per photo set so changing photos
-- produces a fresh analysis while older ones stay on record.
create table public.intake_analyses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  service_request_id uuid not null,
  intake_revision integer not null check (intake_revision > 0),
  -- Sorted ids of the photos analyzed, so an unchanged set reuses the result.
  photo_set text not null,
  status text not null check (status in ('running', 'succeeded', 'failed')),
  -- Server-validated model output (observations, equipment, photo issues).
  result jsonb,
  error_code text,
  model text not null,
  prompt_version text not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (organization_id, service_request_id)
    references public.service_requests (organization_id, id) on delete cascade
);

create index intake_analyses_request_idx
  on public.intake_analyses (service_request_id, created_at desc);

create table public.intake_questions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  service_request_id uuid not null,
  analysis_id uuid not null references public.intake_analyses (id) on delete cascade,
  position integer not null check (position >= 0),
  type text not null check (type in (
    'short_text', 'long_text', 'single_select', 'multi_select',
    'yes_no_unknown', 'number_with_units', 'photo_request'
  )),
  label text not null check (char_length(label) between 1 and 300),
  help text check (help is null or char_length(help) <= 500),
  options jsonb not null default '[]'::jsonb,
  unit text check (unit is null or char_length(unit) <= 40),
  required boolean not null default false,
  allow_unknown boolean not null default true,
  -- Why the AI asked, shown to contractors and as the "because" line.
  reason text not null check (char_length(reason) <= 500),
  -- Photo ids the question is based on (validated against the request).
  evidence_photo_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (analysis_id, position),
  foreign key (organization_id, service_request_id)
    references public.service_requests (organization_id, id) on delete cascade
);

-- Append-only: a changed answer is a new row, so earlier answers are kept
-- (C6) and the latest row per question is the current answer.
create table public.intake_answers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  service_request_id uuid not null,
  question_id uuid not null references public.intake_questions (id) on delete cascade,
  value jsonb not null,
  created_at timestamptz not null default now(),
  foreign key (organization_id, service_request_id)
    references public.service_requests (organization_id, id) on delete cascade
);

create index intake_answers_question_idx
  on public.intake_answers (question_id, created_at desc);

-- Immutable brief versions. A new version never overwrites an older one.
create table public.ai_briefs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  service_request_id uuid not null,
  version integer not null check (version > 0),
  intake_revision integer not null check (intake_revision > 0),
  state text not null check (state in ('draft', 'final')),
  brief jsonb not null,
  model text not null,
  prompt_version text not null,
  created_at timestamptz not null default now(),
  unique (service_request_id, version),
  foreign key (organization_id, service_request_id)
    references public.service_requests (organization_id, id) on delete cascade
);

-- Durable record of background AI work, so a closed browser or a crashed
-- worker leaves a visible, retryable job instead of silently nothing.
create table public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  service_request_id uuid not null,
  kind text not null check (kind in ('brief')),
  input_revision integer not null check (input_revision > 0),
  status text not null default 'pending'
    check (status in ('pending', 'running', 'succeeded', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  error_code text,
  -- e.g. brief:<request id>:<revision>:<n>; makes duplicate submits no-ops.
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, service_request_id)
    references public.service_requests (organization_id, id) on delete cascade
);

create index processing_jobs_request_idx
  on public.processing_jobs (service_request_id, created_at desc);

create trigger processing_jobs_set_updated_at
  before update on public.processing_jobs
  for each row execute function public.set_updated_at();

-- One row per model call, including failures. Also the source for budgets.
-- No prompts, photos, or customer text are stored here.
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  service_request_id uuid references public.service_requests (id) on delete set null,
  kind text not null check (kind in ('analysis', 'brief')),
  model text not null,
  prompt_version text not null,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  outcome text not null check (outcome in ('succeeded', 'failed', 'refused', 'invalid_output')),
  created_at timestamptz not null default now()
);

create index ai_usage_org_created_idx on public.ai_usage (organization_id, created_at desc);
create index ai_usage_request_idx on public.ai_usage (service_request_id, kind);
create index ai_usage_created_idx on public.ai_usage (created_at desc);

revoke all on
  public.intake_analyses, public.intake_questions, public.intake_answers,
  public.ai_briefs, public.processing_jobs, public.ai_usage
from anon;
revoke insert, update, delete on
  public.intake_analyses, public.intake_questions, public.intake_answers,
  public.ai_briefs, public.processing_jobs, public.ai_usage
from authenticated;

alter table public.intake_analyses enable row level security;
alter table public.intake_questions enable row level security;
alter table public.intake_answers enable row level security;
alter table public.ai_briefs enable row level security;
alter table public.processing_jobs enable row level security;
alter table public.ai_usage enable row level security;

create policy "Members can read their workspace's analyses"
  on public.intake_analyses for select to authenticated
  using (public.is_org_member(organization_id));
create policy "Members can read their workspace's questions"
  on public.intake_questions for select to authenticated
  using (public.is_org_member(organization_id));
create policy "Members can read their workspace's answers"
  on public.intake_answers for select to authenticated
  using (public.is_org_member(organization_id));
create policy "Members can read their workspace's briefs"
  on public.ai_briefs for select to authenticated
  using (public.is_org_member(organization_id));
create policy "Members can read their workspace's jobs"
  on public.processing_jobs for select to authenticated
  using (public.is_org_member(organization_id));
create policy "Members can read their workspace's AI usage"
  on public.ai_usage for select to authenticated
  using (public.is_org_member(organization_id));
