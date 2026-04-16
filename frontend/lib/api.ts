
import axios from 'axios';
import { ExamPaper, ExamSolution, StudyPlan } from '../types';

import { supabase } from './supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

const api = axios.create({
    baseURL: API_URL,
});

api.interceptors.request.use(async (config) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
    }
    return config;
});

export const uploadExams = async (files: File[]): Promise<void> => {
    for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        await api.post('/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    }
};

export const getExams = async (): Promise<ExamPaper[]> => {
    const res = await api.get('/exams');
    return res.data.map((item: any) => ({
        id: item.id,
        name: item.filename,
        status: item.status,
        uploadDate: new Date(item.created_at || item.upload_date || new Date()), // Supabase timestamp
        solution: undefined,
        error_message: item.error_message,
    }));
};

export const retryExam = async (examId: string): Promise<void> => {
    await api.post(`/retry/${examId}`);
};

export const getSolution = async (examId: string): Promise<ExamSolution> => {
    const res = await api.get(`/solutions/${examId}`);
    return res.data;
};

export const generateStudyPlan = async (solutions: ExamSolution[]): Promise<StudyPlan> => {
    const res = await api.post('/generate-plan', { exam_solutions: solutions });
    return res.data;
}

// --- Progress Tracking API ---

export interface PracticeSessionPayload {
    exam_id: string;
    exam_name: string;
    total_questions: number;
    correct_count: number;
    incorrect_count: number;
    score_percentage: number;
}

export interface ProgressData {
    sessions: PracticeSessionFromAPI[];
    questionsMastered: number;
    questionsAttempted: number;
}

export interface PracticeSessionFromAPI {
    id: string;
    exam_id: string;
    exam_name: string;
    session_date: string;
    total_questions: number;
    correct_count: number;
    incorrect_count: number;
    score_percentage: number;
}

export const savePracticeSession = async (session: PracticeSessionPayload): Promise<{ session_id: string }> => {
    const res = await api.post('/progress/sessions', session);
    return res.data;
};

export const getProgress = async (): Promise<ProgressData> => {
    const res = await api.get('/progress');
    return res.data;
};

export const getExamProgress = async (examId: string): Promise<PracticeSessionFromAPI[]> => {
    const res = await api.get(`/progress/exam/${examId}`);
    return res.data;
};

// --- Study Guides API ---

export interface StudyGuide {
    id: string;
    topic: string;
    subject: string;
    qualification_area?: 'BQ' | 'HQ';
    handlungsbereich?: string;
    summary_markdown: string;
    key_concepts: string[];
    formulas: Array<{ name: string; formula: string; description: string }>;
    common_mistakes: Array<{ mistake: string; correction: string }>;
    example_questions: Array<{ problem: string; solution: string }>;
    point_strategy?: string;
    quickTips?: string[];
    created_at?: string;
}

// IHK Taxonomy Constants for Frontend
export const IHK_TAXONOMY = {
    BQ: {
        name: 'Basisqualifikationen',
        subjects: [
            'Rechtsbewusstes Handeln',
            'Betriebswirtschaftliches Handeln',
            'Anwendung von Methoden der Information, Kommunikation und Planung',
            'Zusammenarbeit im Betrieb',
            'Berücksichtigung naturwissenschaftlicher und technischer Gesetzmäßigkeiten (NTG)'
        ]
    },
    HQ: {
        name: 'Handlungsspezifische Qualifikationen',
        handlungsbereiche: {
            'Technik': [
                'Infrastruktursysteme und Betriebstechnik',
                'Automatisierungs- und Informationstechnik'
            ],
            'Organisation': [
                'Betriebliches Kostenwesen',
                'Planungs-, Steuerungs- und Kommunikationssysteme',
                'Arbeits-, Umwelt- und Gesundheitsschutz'
            ],
            'Führung und Personal': [
                'Personalführung',
                'Personalentwicklung',
                'Qualitätsmanagement'
            ]
        }
    }
} as const;

export const listAvailableTopics = async (): Promise<string[]> => {
    const res = await api.get('/topics');
    return res.data;
};

export const generateStudyGuide = async (topic: string): Promise<StudyGuide> => {
    const res = await api.post('/study-guides/generate', { topic });
    return res.data;
};

export const listStudyGuides = async (): Promise<Partial<StudyGuide>[]> => {
    const res = await api.get('/study-guides');
    return res.data;
};

export const getStudyGuide = async (id: string): Promise<StudyGuide> => {
    const res = await api.get(`/study-guides/${id}`);
    return res.data;
};

export const deleteStudyGuide = async (id: string): Promise<{ message: string }> => {
    const res = await api.delete(`/study-guides/${id}`);
    return res.data;
};

export const deleteExam = async (id: string): Promise<{ message: string }> => {
    const res = await api.delete(`/exams/${id}`);
    return res.data;
};

// --- Fachgespräch Bot API ---

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export const chatFachgespraech = async (messages: ChatMessage[], topic?: string): Promise<string> => {
    const res = await api.post('/fachgespraech', { messages, context_topic: topic });
    return res.data.content;
};

// --- Settings API ---

export interface UserSettings {
    specialization: string | null;
    language?: string | null;
}

export const getSettings = async (): Promise<UserSettings> => {
    const res = await api.get('/settings');
    return res.data;
};

export const updateSettings = async (specialization?: string, language?: string): Promise<UserSettings> => {
    const data: any = {};
    if (specialization) data.specialization = specialization;
    if (language) data.language = language;
    const res = await api.post('/settings', data);
    return res.data;
};
