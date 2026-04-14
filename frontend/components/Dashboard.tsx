"use client";

import React, { useMemo, useEffect, useState } from 'react';
import { ExamPaper, StudyPlan, Specialization } from '../types';
import FileUpload from './FileUpload';
import { loadProgress } from './ExamViewer';
import { ProgressData } from '../lib/api';
import {
    Brain,
    TrendingUp,
    Calendar,
    Clock,
    Target,
    ArrowUpRight,
    FileText,
    Zap,
    CheckCircle2,
    Plus,
    Trophy,
    BarChart3,
    Flame,
    AlertCircle,
    RefreshCw,
    Trash2
} from 'lucide-react';

interface DashboardProps {
    papers: ExamPaper[];
    studyPlan: StudyPlan | null;
    onFileUpload: (files: File[]) => void;
    onViewPaper: (paper: ExamPaper) => void;
    onRetryPaper: (paperId: string) => void;
    onDeletePaper?: (id: string) => void;
    onGeneratePlan: () => void;
    onNavigateToPlan: () => void;
    specialization: Specialization;
    onNavigateToSettings: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({
    papers,
    studyPlan,
    onFileUpload,
    onViewPaper,
    onRetryPaper,
    onDeletePaper,
    onGeneratePlan,
    onNavigateToPlan,
    specialization,
    onNavigateToSettings
}) => {
    // --- Progress Tracking State ---
    const [progress, setProgress] = useState<ProgressData>({ sessions: [], questionsMastered: 0, questionsAttempted: 0 });

    useEffect(() => {
        const fetchProgress = async () => {
            const data = await loadProgress();
            setProgress(data);
        };
        fetchProgress();
    }, []);

    // --- Computed Metrics ---
    const stats = useMemo(() => {
        const solved = papers.filter(p => p.status === 'completed');
        const totalPapers = papers.length;

        // Papers this week (Mock logic: assuming uploaded recently)
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const papersThisWeek = papers.filter(p => p.uploadDate > oneWeekAgo).length;

        // Unique topics
        const topics = new Set<string>();
        solved.forEach(p => p.solution?.topics?.forEach(t => topics.add(t)));

        // Difficulty spread
        const hardCount = solved.filter(p => p.solution?.difficulty === 'Hard').length;

        return { totalPapers, solvedCount: solved.length, papersThisWeek, uniqueTopics: topics.size, hardCount };
    }, [papers]);

    // --- Progress Metrics ---
    const progressMetrics = useMemo(() => {
        const masteryRate = progress.questionsAttempted > 0
            ? Math.round((progress.questionsMastered / progress.questionsAttempted) * 100)
            : 0;
        const totalSessions = progress.sessions.length;
        const recentSessions = progress.sessions.slice(-5).reverse(); // Last 5 sessions

        // Streak logic (consecutive days with practice)
        let streak = 0;
        if (progress.sessions.length > 0) {
            const today = new Date().toDateString();
            const yesterday = new Date(Date.now() - 86400000).toDateString();
            const lastSessionDate = new Date(progress.sessions[progress.sessions.length - 1].session_date).toDateString();

            if (lastSessionDate === today || lastSessionDate === yesterday) {
                streak = 1;
                // Count backwards for streak
                for (let i = progress.sessions.length - 2; i >= 0; i--) {
                    const sessionDate = new Date(progress.sessions[i].session_date).toDateString();
                    const prevSession = new Date(progress.sessions[i + 1].session_date);
                    const dayBefore = new Date(prevSession.getTime() - 86400000).toDateString();
                    if (sessionDate === dayBefore) {
                        streak++;
                    } else {
                        break;
                    }
                }
            }
        }

        return { masteryRate, totalSessions, recentSessions, streak };
    }, [progress]);

    // Determine current active task from plan (or first day)
    const todaysTasks = studyPlan?.schedule[0];

    return (
        <div className="h-full overflow-y-auto px-6 md:px-12 py-10 max-w-7xl mx-auto animate-fade-in custom-scrollbar">

            {/* Header section (Action-led) */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-16">
                <div>
                    <h1 className="text-3xl font-semibold text-gray-900 tracking-tight">Übersicht</h1>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-[10px] font-medium tracking-widest uppercase text-gray-400">
                        {stats.papersThisWeek > 0 && <span>{stats.papersThisWeek} Uploads diese Woche</span>}
                        {progressMetrics.masteryRate > 0 && <span>{progressMetrics.masteryRate}% Genauigkeit</span>}
                        {progressMetrics.streak > 0 && <span className="flex items-center gap-1 text-orange-500"><Flame size={12}/>{progressMetrics.streak} Tage Strähne</span>}
                        {specialization !== 'None' && <span>HQ: {specialization}</span>}
                    </div>
                </div>

                <button
                    onClick={() => document.getElementById('fileInput')?.click()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-black transition-all active:scale-95 border border-transparent shadow-sm"
                >
                    <Plus size={16} />
                    Arbeit Hochladen
                    <input
                        type="file"
                        id="fileInput"
                        multiple
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                                const pdfFiles = Array.from(e.target.files).filter((f: File) => f.type === 'application/pdf');
                                onFileUpload(pdfFiles);
                            }
                        }}
                    />
                </button>
            </div>

            {/* Main Content Splitted with high negative space */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24">
                
                {/* Left Column: Focus (No nested cards, pure typography) */}
                <div className="col-span-1 lg:col-span-7 space-y-16">
                    
                    <section>
                        <h2 className="text-[10px] tracking-widest text-gray-400 uppercase mb-6 flex items-center gap-2">
                            <Target size={14}/> Heutiger Fokus
                        </h2>
                        
                        {studyPlan && todaysTasks ? (
                            <div className="space-y-6">
                                <div className="flex justify-between items-baseline mb-4">
                                    <h3 className="text-2xl font-medium text-gray-900">{todaysTasks.focus}</h3>
                                    <button onClick={onNavigateToPlan} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">Voller Plan</button>
                                </div>
                                <div className="space-y-5">
                                    {todaysTasks.tasks.map((task, i) => (
                                        <div key={i} className="flex gap-4 group cursor-default">
                                            <div className="mt-2 w-1.5 h-1.5 rounded-full bg-gray-300 group-hover:bg-indigo-500 transition-colors shrink-0" />
                                            <p className="text-base text-gray-700 leading-relaxed">{task}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex items-center gap-6 text-[10px] font-medium tracking-widest text-gray-400 uppercase pt-6">
                                    <span className="flex items-center gap-1.5"><Clock size={12}/> {todaysTasks.durationMinutes} Min</span>
                                    <span>Tag {todaysTasks.day}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-start gap-4">
                                <p className="text-gray-500 text-base">Sie haben derzeit keinen aktiven Lernplan.</p>
                                {stats.solvedCount > 0 ? (
                                    <button onClick={onGeneratePlan} className="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mt-2">
                                        Plan generieren <ArrowUpRight size={14}/>
                                    </button>
                                ) : (
                                    <span className="text-sm text-gray-400 mt-2">Laden Sie eine Prüfung hoch, um zu beginnen.</span>
                                )}
                            </div>
                        )}
                    </section>
                </div>

                {/* Right Column: Library & Topics (Typography over borders) */}
                <div className="col-span-1 lg:col-span-5 space-y-16">
                    
                    <section>
                        <h2 className="text-[10px] tracking-widest text-gray-400 uppercase mb-6 flex items-center gap-2">
                            <Clock size={14}/> Neueste Dokumente
                        </h2>
                        
                        {papers.length === 0 ? (
                            <p className="text-gray-400 text-sm">Noch keine Arbeiten hochgeladen.</p>
                        ) : (
                            <div className="space-y-6">
                                {papers.slice().reverse().slice(0, 5).map(paper => (
                                    <div key={paper.id} onClick={() => onViewPaper(paper)} className="flex items-start justify-between cursor-pointer group">
                                        <div className="pr-4">
                                            <p className="text-sm font-medium text-gray-800 group-hover:text-indigo-600 transition-colors">
                                                {paper.name}
                                            </p>
                                            <p className={`text-xs mt-1 ${paper.status === 'failed' ? 'text-red-500' : 'text-gray-400'}`}>
                                                {paper.status === 'completed' ? paper.solution?.subject : paper.status === 'failed' ? 'Fehler bei der Analyse' : 'Verarbeitung...'}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3 pt-1 shrink-0">
                                            {paper.status === 'failed' ? (
                                                <button onClick={(e) => { e.stopPropagation(); onRetryPaper(paper.id); }} className="text-gray-400 hover:text-indigo-600 transition-colors">
                                                    <RefreshCw size={14} />
                                                </button>
                                            ) : paper.status === 'completed' ? (
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                            ) : (
                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                            )}
                                            {onDeletePaper && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDeletePaper(paper.id);
                                                    }}
                                                    className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                                    title="Löschen"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {stats.uniqueTopics > 0 && (
                        <section>
                            <h2 className="text-[10px] tracking-widest text-gray-400 uppercase mb-6 flex items-center gap-2">
                                <Brain size={14}/> Wissensbasis
                            </h2>
                            <div className="flex flex-wrap gap-2">
                                {Array.from(new Set(papers.flatMap(p => p.solution?.topics || []))).slice(0, 8).map((t, i) => (
                                    <span key={i} className="text-xs font-medium text-gray-600 bg-gray-100/50 hover:bg-gray-100 px-3 py-1.5 rounded transition-colors cursor-default border border-gray-200/50">
                                        {t}
                                    </span>
                                ))}
                            </div>
                        </section>
                    )}
                </div>

            </div>
        </div>
    );
};

export default Dashboard;
