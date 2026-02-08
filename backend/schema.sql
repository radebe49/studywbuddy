-- Enable pgcrypto extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Table: exams
CREATE TABLE IF NOT EXISTS exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    storage_path TEXT,
    status TEXT DEFAULT 'uploading',
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    error_message TEXT
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
CREATE TRIGGER update_topic_summaries_modtime
    BEFORE UPDATE ON topic_summaries
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
