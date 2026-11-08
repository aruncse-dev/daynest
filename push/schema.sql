-- DayNest reminder pusher. Stores only push addresses and wake-up minutes, never reminder text.
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS slots (
  device_id TEXT NOT NULL,
  at INTEGER NOT NULL, -- epoch minute (UTC)
  PRIMARY KEY (device_id, at)
);
CREATE INDEX IF NOT EXISTS slots_at ON slots (at);
