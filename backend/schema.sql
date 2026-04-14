-- Enable pgcrypto extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Table: exams
CREATE TABLE IF NOT EXISTS exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    exam_id UUID UNIQUE REFERENCES exams(id) ON DELETE CASCADE,
    raw_json JSONB,
    markdown_plan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: practice_sessions
CREATE TABLE IF NOT EXISTS practice_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    topic TEXT UNIQUE NOT NULL,
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: scenarios
CREATE TABLE IF NOT EXISTS scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
    context_text TEXT NOT NULL,
    "order" INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: questions
CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    user_id TEXT PRIMARY KEY,
    specialization TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create a function to update the 'updated_at' column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for topic_summaries
CREATE TRIGGER IF NOT EXISTS update_topic_summaries_modtime
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

