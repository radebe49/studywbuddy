
export type ViewState = 'dashboard' | 'study-plan' | 'paper-details' | 'study-guides' | 'settings' | 'fachgespraech';

export type Specialization = 'Infrastruktursysteme und Betriebstechnik' | 'Automatisierungs- und Informationstechnik' | 'None';

export interface ExamPaper {
    id: string;
    name: string; // from 'filename' in DB, or local file name
    // file: File; // Removed as we handle files via uploads, logic changes in Next.js/Backend
    textParams?: string; // Optional, maybe unused in frontend now
    status: 'uploading' | 'processing' | 'completed' | 'failed';
    solution?: ExamSolution;
    uploadDate: Date; // or string from DB
    error_message?: string;
}

// IHK Qualification Areas
export type QualificationArea = 'BQ' | 'HQ';

// Official IHK Handlungsbereiche for HQ
export type Handlungsbereich = 'Technik' | 'Organisation' | 'Führung und Personal';

export interface ExamSolution {
    subject: string;
    qualificationArea?: QualificationArea;
    handlungsbereich?: Handlungsbereich;
    year?: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    topics: string[];
    questions: QuestionAnalysis[];
    summary: string;
}

export interface QuestionAnalysis {
    questionNumber: string;
    contextScenario?: string; // Situationsbeschreibung for HQ
    questionText: string;
    solution: string;
    explanation: string;
    qualificationArea?: QualificationArea;
    subject?: string;
    topic: string;
    points?: number; // Estimated IHK points
    pointsBreakdown?: string; // Breakdown of point allocation
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
