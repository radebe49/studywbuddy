
export type ViewState = 'dashboard' | 'study-plan' | 'paper-details';

export interface ExamPaper {
    id: string;
    name: string; // from 'filename' in DB, or local file name
    // file: File; // Removed as we handle files via uploads, logic changes in Next.js/Backend
    textParams?: string; // Optional, maybe unused in frontend now
    status: 'uploading' | 'processing' | 'completed' | 'failed';
    solution?: ExamSolution;
    uploadDate: Date; // or string from DB
}

export interface ExamSolution {
    subject: string;
    year?: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    topics: string[];
    questions: QuestionAnalysis[];
    summary: string;
}

export interface QuestionAnalysis {
    questionNumber: string;
    questionText: string;
    solution: string;
    explanation: string;
    topic: string;
}

export interface StudyPlanDay {
    day: number;
    date: string; // ISO string
    focus: string;
    tasks: string[];
    durationMinutes: number;
}

export interface StudyPlan {
    id: string;
    title: string;
    generatedAt: Date;
    schedule: StudyPlanDay[];
    overview: string;
    // Backend returns "markdown_plan" too, but we parse "raw_json" into this structure
}

export interface APIError {
    message: string;
}
