CREATE TABLE IF NOT EXISTS user_question_history (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id TEXT NOT NULL,
 question_id UUID NOT NULL,
 lesson TEXT NOT NULL DEFAULT '',
 topic TEXT NOT NULL DEFAULT '',
 is_correct BOOLEAN NOT NULL,
 answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
;
CREATE INDEX IF NOT EXISTS idx_user_history_user_answered ON user_question_history(user_id, answered_at DESC)
;
CREATE INDEX IF NOT EXISTS idx_user_history_user_question ON user_question_history(user_id, question_id)
;
CREATE TABLE IF NOT EXISTS user_favorites (
 user_id TEXT NOT NULL,
 question_id UUID NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY (user_id, question_id)
)
;
CREATE INDEX IF NOT EXISTS idx_user_favorites_user_created ON user_favorites(user_id, created_at DESC)
;