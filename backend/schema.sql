-- Enable pgcrypto extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Table: exams
CREATE TABLE IF NOT EXISTS exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
    filename TEXT NOT NULL,
    storage_path TEXT,
    status TEXT DEFAULT 'uploading',
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    error_message TEXT,
    qualification_area TEXT,
    handlungsbereich TEXT,
    specialization TEXT
);

-- Table: study_plans
CREATE TABLE IF NOT EXISTS study_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
    exam_id UUID UNIQUE REFERENCES exams(id) ON DELETE CASCADE,
    raw_json JSONB,
    markdown_plan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: practice_sessions
CREATE TABLE IF NOT EXISTS practice_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
    exam_id UUID REFERENCES exams(id) ON DELETE SET NULL,
    exam_name TEXT,
    session_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_questions INTEGER,
    correct_count INTEGER,
    incorrect_count INTEGER,
    score_percentage INTEGER
);

-- Table: topic_summaries
CREATE TABLE IF NOT EXISTS topic_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
    topic TEXT NOT NULL,
    subject TEXT,
    summary_markdown TEXT,
    key_concepts JSONB,
    formulas JSONB,
    common_mistakes JSONB,
    example_questions JSONB,
    source_exam_ids UUID[],
    qualification_area TEXT,
    handlungsbereich TEXT,
    specialization TEXT,
    point_strategy TEXT,
    quick_tips JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, topic)
);

-- Table: scenarios
CREATE TABLE IF NOT EXISTS scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
    exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
    context_text TEXT NOT NULL,
    "order" INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: questions
CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
    exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
    scenario_id UUID REFERENCES scenarios(id) ON DELETE CASCADE,
    question_number TEXT,
    question_text TEXT NOT NULL,
    type TEXT,
    qualification_area TEXT,
    subject TEXT,
    topic TEXT,
    solution TEXT,
    explanation TEXT,
    points_total INTEGER,
    points_breakdown JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: user_settings
CREATE TABLE IF NOT EXISTS user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) DEFAULT auth.uid(),
    specialization TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own exams" ON exams FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own study plans" ON study_plans FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own practice sessions" ON practice_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own topic summaries" ON topic_summaries FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own scenarios" ON scenarios FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own questions" ON questions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own settings" ON user_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Create a function to update the 'updated_at' column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for topic_summaries
CREATE TRIGGER update_topic_summaries_modtime
    BEFORE UPDATE ON topic_summaries
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- --- AUTOMATED MAINTENANCE CRON ---
-- Runs every 5 minutes to sweep stuck processing tasks
-- Fails any exam in 'processing' state for more than 15 minutes
SELECT cron.schedule(
    'exam-timeout-sweep',
    '*/5 * * * *',
    $$ UPDATE exams SET status='failed', error_message='Verarbeitung abgebrochen (Zeitüberschreitung)' WHERE status='processing' AND upload_date < NOW() - INTERVAL '15 minutes' $$
);
