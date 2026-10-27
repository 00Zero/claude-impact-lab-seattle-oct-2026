-- Per-business call tracking for each request. Additive only: the previous
-- Worker keeps serving while this runs.

-- `ref` is the reference the agent quotes back when it reports progress; the
-- display fields are the request's summary as the requester saw it.
ALTER TABLE requests ADD COLUMN ref TEXT;
ALTER TABLE requests ADD COLUMN where_text TEXT;
ALTER TABLE requests ADD COLUMN when_text TEXT;
ALTER TABLE requests ADD COLUMN budget_text TEXT;
ALTER TABLE requests ADD COLUMN call_cap INTEGER NOT NULL DEFAULT 5;
CREATE UNIQUE INDEX requests_ref ON requests (ref);

-- One row per business the agent contacts for a request, updated in place as
-- the call progresses. `called_at` is set the first time the business is
-- called, and counts against the request's call cap.
CREATE TABLE provider_calls (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  business TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'calling', 'quoted', 'retry', 'declined')),
  detail TEXT NOT NULL DEFAULT '',
  called_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX provider_calls_session_business ON provider_calls (session_id, business COLLATE NOCASE);
