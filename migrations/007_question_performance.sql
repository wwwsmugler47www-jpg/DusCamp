CREATE INDEX IF NOT EXISTS idx_questions_lesson_created ON questions(lesson, created_at);
CREATE INDEX IF NOT EXISTS idx_questions_lesson_group_created ON questions(lesson, question_group, created_at);
CREATE INDEX IF NOT EXISTS idx_questions_lesson_topic_created ON questions(lesson, topic, created_at);