
import axios from 'axios';
import { ExamPaper, ExamSolution, StudyPlan } from '../types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
    baseURL: API_URL,
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
    }));
};

export const getSolution = async (examId: string): Promise<ExamSolution> => {
    const res = await api.get(`/solutions/${examId}`);
    return res.data;
};

export const generateStudyPlan = async (solutions: ExamSolution[]): Promise<StudyPlan> => {
    const res = await api.post('/generate-plan', { exam_solutions: solutions });
    return res.data;
}
