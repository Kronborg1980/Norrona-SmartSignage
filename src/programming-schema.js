// Kept identical to migrations/0003_channels_bookings.sql (verified in tests).
// Only the authenticated, explicit backoffice activation action executes this.
export const programmingSchema = `
CREATE TABLE IF NOT EXISTS channels (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
 version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS content (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, widget_json TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bookings (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, scope TEXT NOT NULL, target TEXT NOT NULL,
 item_type TEXT NOT NULL, item_id TEXT NOT NULL,
 start_date TEXT, end_date TEXT, days_json TEXT NOT NULL,
 start_time TEXT NOT NULL DEFAULT '00:00', end_time TEXT NOT NULL DEFAULT '23:59',
 duration INTEGER NOT NULL DEFAULT 10, position INTEGER NOT NULL DEFAULT 0,
 priority INTEGER NOT NULL DEFAULT 10, enabled INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bookings_target ON bookings(enabled,scope,target);
CREATE INDEX IF NOT EXISTS idx_bookings_item ON bookings(item_type,item_id);
`;
