CREATE TABLE IF NOT EXISTS layouts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  orientation TEXT NOT NULL DEFAULT 'landscape',
  background TEXT NOT NULL DEFAULT '#071220',
  widgets_json TEXT NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS screens (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  zone TEXT NOT NULL DEFAULT 'General',
  orientation TEXT NOT NULL DEFAULT 'landscape',
  layout_id TEXT,
  device_token_hash TEXT NOT NULL,
  last_seen TEXT,
  version TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_screens_zone ON screens(zone);
CREATE TABLE IF NOT EXISTS pairings (
  code TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL,
  claimed_screen_id TEXT,
  claimed_token TEXT
);
CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  scope TEXT NOT NULL,
  target TEXT NOT NULL,
  layout_id TEXT NOT NULL,
  start_utc TEXT,
  end_utc TEXT,
  days_json TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
  start_time TEXT NOT NULL DEFAULT '00:00',
  end_time TEXT NOT NULL DEFAULT '23:59',
  priority INTEGER NOT NULL DEFAULT 10,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_schedules_scope ON schedules(scope,target);
CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS login_attempts (
  ip TEXT PRIMARY KEY,
  failures INTEGER NOT NULL DEFAULT 0,
  blocked_until INTEGER NOT NULL DEFAULT 0
);
