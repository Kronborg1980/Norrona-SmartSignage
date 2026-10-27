-- Media digests are attached to each R2 object as custom metadata.
-- This migration reserves a place for future audit log tables.
CREATE TABLE IF NOT EXISTS audit_events (
 id TEXT PRIMARY KEY, action TEXT NOT NULL, object_id TEXT, created_at TEXT NOT NULL
);
