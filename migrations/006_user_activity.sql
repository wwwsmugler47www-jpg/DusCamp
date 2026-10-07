CREATE TABLE IF NOT EXISTS user_login_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id TEXT NOT NULL,
 occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_login_events_time ON user_login_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_user_login_events_user_time ON user_login_events(user_id,occurred_at);