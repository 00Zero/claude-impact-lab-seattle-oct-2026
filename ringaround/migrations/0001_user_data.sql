-- User data that used to live in browser storage. Every row belongs to one
-- signed-in user, identified by their Google account ID (the session's
-- `user.id`, the JWT `sub`).

CREATE TABLE profiles (
  user_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  default_address TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Extra addresses saved from the request form. The profile address stays the
-- default and isn't repeated here.
CREATE TABLE saved_locations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  label TEXT NOT NULL,
  address TEXT NOT NULL,
  time_zone TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX saved_locations_user_address ON saved_locations (user_id, address COLLATE NOCASE);

-- The application made at checkout. Card details are never stored.
CREATE TABLE account_applications (
  user_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  plan TEXT NOT NULL,
  submitted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- One row per request sent to the agent, so a user's requests can be listed
-- without scanning every session. Status still comes from the session itself.
CREATE TABLE requests (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX requests_user_created ON requests (user_id, created_at DESC);
