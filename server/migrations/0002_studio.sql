CREATE TABLE IF NOT EXISTS myhome_draft (
  id INTEGER PRIMARY KEY CHECK (id = 1), document TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS myhome_recovery (
  id INTEGER PRIMARY KEY CHECK (id = 1), code_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS myhome_auth_attempts (
  key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS myhome_oauth_states (
  state_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS myhome_operator_recovery (code_hash TEXT PRIMARY KEY);
