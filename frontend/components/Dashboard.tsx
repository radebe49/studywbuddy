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
    AlertCircle
} from 'lucide-react';

interface DashboardProps {
    papers: ExamPaper[];
    studyPlan: StudyPlan | null;
    onFileUpload: (files: File[]) => void;
    onViewPaper: (paper: ExamPaper) => void;
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
        <div className="h-full overflow-y-auto custom-scrollbar p-1 pb-20 animate-fade-in">

            {/* Header */}
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Übersicht</h1>
                    <p className="text-gray-500 mt-1 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        {new Date().toLocaleDateString('de-DE', { weekday: 'long', month: 'long', day: 'numeric' })}
                        {specialization !== 'None' && (
                            <>
                                <span className="text-gray-300">•</span>
                                <span className="text-indigo-600 font-medium">HQ: {specialization}</span>
                            </>
                        )}
                    </p>
                </div>

                {/* Quick Upload Button (Replacing the giant dropzone) */}
                <div className="flex gap-3">
                    <button
                        onClick={() => document.getElementById('fileInput')?.click()}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-all shadow-sm active:scale-95"
                    >
                        <Plus size={18} />
                        <span className="hidden md:inline">Schnell-Upload</span>
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
            </div>

            {/* Bento Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6 mb-8">

                {/* Metric 1: Weekly Velocity */}
                <div className="col-span-1 md:col-span-2 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <TrendingUp size={100} />
                    </div>
                    <div className="relative z-10">
                        <p className="text-indigo-200 font-medium text-sm mb-1">Wöchentliche Geschwindigkeit</p>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-4xl font-bold">{stats.papersThisWeek}</h3>
                            <span className="text-indigo-200 text-sm">Arbeiten analysiert</span>
                        </div>
                        <div className="mt-6 flex items-center gap-2 text-xs font-medium text-indigo-100 bg-white/10 w-fit px-3 py-1 rounded-full">
                            <Zap size={12} className="text-yellow-300 fill-yellow-300" />
                            {stats.uniqueTopics} Themen in allen Fächern abgedeckt
                        </div>
                    </div>
                </div>

                {/* Metric 2: Difficulty Analysis (Mock chart visual) */}
                <div className="col-span-1 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between hover:border-indigo-100 transition-colors">
                    <div>
                        <div className="flex items-center gap-2 mb-2 text-gray-500">
                            <Brain size={18} />
                            <span className="text-sm font-medium">Kognitive Belastung</span>
                        </div>
                        <div className="text-2xl font-bold text-gray-800">{stats.hardCount}</div>
                        <div className="text-xs text-gray-400">Anspruchsvolle Arbeiten gelöst</div>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full mt-4 overflow-hidden flex">
                        <div className="bg-green-400 h-full" style={{ width: '40%' }}></div>
                        <div className="bg-yellow-400 h-full" style={{ width: '30%' }}></div>
                        <div className="bg-red-400 h-full" style={{ width: '30%' }}></div>
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400 mt-2 font-medium uppercase">
                        <span>Leicht</span>
                        <span>Mittel</span>
                        <span>Schwer</span>
                    </div>
                </div>

                {/* Metric 3: System Status */}
                <div className="col-span-1 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between hover:border-indigo-100 transition-colors">
                    <div>
                        <div className="flex items-center gap-2 mb-2 text-gray-500">
                            <FileText size={18} />
                            <span className="text-sm font-medium">Bibliothek</span>
                        </div>
                        <div className="text-2xl font-bold text-gray-800">{stats.totalPapers}</div>
                        <div className="text-xs text-gray-400">Gesamte Dokumente gespeichert</div>
                    </div>
                    <button
                        onClick={() => document.getElementById('fileInput')?.click()}
                        className="mt-4 text-xs font-semibold text-indigo-600 flex items-center gap-1 hover:gap-2 transition-all"
                    >
                        Mehr hinzufügen <ArrowUpRight size={12} />
                    </button>
                </div>
            </div>

            {/* Progress Tracking Section */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6 mb-8">
                {/* Mastery Rate */}
                <div className="col-span-1 md:col-span-2 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <Trophy size={100} />
                    </div>
                    <div className="relative z-10">
                        <p className="text-emerald-200 font-medium text-sm mb-1">Übungsbeherrschung</p>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-4xl font-bold">{progressMetrics.masteryRate}%</h3>
                            <span className="text-emerald-200 text-sm">Genauigkeitsrate</span>
                        </div>
                        <div className="mt-4 flex items-center gap-4 text-sm">
                            <div className="bg-white/10 px-3 py-1 rounded-full flex items-center gap-1">
                                <CheckCircle2 size={14} />
                                <span>{progress.questionsMastered} gemeistert</span>
                            </div>
                            <div className="bg-white/10 px-3 py-1 rounded-full flex items-center gap-1">
                                <BarChart3 size={14} />
                                <span>{progress.questionsAttempted} versucht</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Practice Streak */}
                <div className="col-span-1 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between hover:border-orange-100 transition-colors">
                    <div>
                        <div className="flex items-center gap-2 mb-2 text-gray-500">
                            <Flame size={18} className={progressMetrics.streak > 0 ? 'text-orange-500' : ''} />
                            <span className="text-sm font-medium">Lernsträhne</span>
                        </div>
                        <div className="text-2xl font-bold text-gray-800">{progressMetrics.streak}</div>
                        <div className="text-xs text-gray-400">{progressMetrics.streak === 1 ? 'Tag' : 'Tage'} in Folge</div>
                    </div>
                    <div className="flex gap-1 mt-4">
                        {[...Array(7)].map((_, i) => (
                            <div
                                key={i}
                                className={`flex-1 h-2 rounded-full ${i < progressMetrics.streak ? 'bg-orange-400' : 'bg-gray-100'
                                    }`}
                            />
                        ))}
                    </div>
                </div>

                {/* Practice Sessions */}
                <div className="col-span-1 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between hover:border-indigo-100 transition-colors">
                    <div>
                        <div className="flex items-center gap-2 mb-2 text-gray-500">
                            <Brain size={18} />
                            <span className="text-sm font-medium">Sitzungen</span>
                        </div>
                        <div className="text-2xl font-bold text-gray-800">{progressMetrics.totalSessions}</div>
                        <div className="text-xs text-gray-400">Übungstests abgeschlossen</div>
                    </div>
                    {progressMetrics.recentSessions.length > 0 && (
                        <div className="mt-4 space-y-1">
                            {progressMetrics.recentSessions.slice(0, 2).map((session, i) => (
                                <div key={i} className="flex justify-between text-xs text-gray-500">
                                    <span className="truncate max-w-[100px]">{session.exam_name.slice(0, 15)}...</span>
                                    <span className={session.score_percentage >= 70 ? 'text-green-600 font-medium' : 'text-gray-600'}>
                                        {session.score_percentage}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Left Column: Today's Action Plan (Value Prop: Continuity) */}
                <div className="col-span-1 md:col-span-2 space-y-6">
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <Target className="text-indigo-600" size={20} />
                                Heutiger Fokus
                            </h3>
                            {studyPlan && (
                                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-wider">
                                    Tag {todaysTasks?.day}
                                </span>
                            )}
                        </div>

                        <div className="p-6">
                            {studyPlan && todaysTasks ? (
                                <div className="space-y-4">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h4 className="text-lg font-bold text-gray-900">{todaysTasks.focus}</h4>
                                            <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                                                <span className="flex items-center gap-1"><Clock size={14} /> {todaysTasks.durationMinutes} Min.</span>
                                                <span className="flex items-center gap-1"><Calendar size={14} /> {new Date().toLocaleDateString('de-DE')}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={onNavigateToPlan}
                                            className="text-indigo-600 text-sm font-medium hover:underline"
                                        >
                                            Vollständigen Plan ansehen
                                        </button>
                                    </div>

                                    <div className="space-y-2 mt-4">
                                        {todaysTasks.tasks.map((task, i) => (
                                            <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-indigo-200 transition-colors group">
                                                <div className="mt-0.5 w-5 h-5 rounded-full border-2 border-gray-300 group-hover:border-indigo-500 flex items-center justify-center transition-colors">
                                                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                                <span className="text-sm text-gray-700 leading-snug">{task}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Target className="text-gray-400" size={24} />
                                    </div>
                                    <h3 className="font-semibold text-gray-900 mb-1">Kein aktiver Plan</h3>
                                    <p className="text-gray-500 text-sm mb-4 max-w-xs mx-auto">
                                        Erstellen Sie einen personalisierten Lernplan basierend auf Ihrer letzten Prüfungsleistung.
                                    </p>
                                    {stats.solvedCount > 0 ? (
                                        <button
                                            onClick={onGeneratePlan}
                                            className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium shadow-md hover:bg-black transition-all"
                                        >
                                            Plan jetzt erstellen
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => document.getElementById('fileInput')?.click()}
                                            className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium shadow-md hover:bg-indigo-700 transition-all"
                                        >
                                            Erste Arbeit hochladen
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Clock className="text-gray-400" size={20} />
                            Neueste Dateien
                        </h3>
                        {papers.length === 0 ? (
                            <p className="text-gray-400 text-sm italic">Noch keine Dateien verarbeitet.</p>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {papers.slice().reverse().slice(0, 3).map(paper => (
                                    <div
                                        key={paper.id}
                                        onClick={() => onViewPaper(paper)}
                                        className="py-3 flex items-center justify-between group cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${paper.status === 'completed' ? 'bg-emerald-100 text-emerald-600' :
                                                paper.status === 'failed' ? 'bg-red-100 text-red-600' :
                                                    'bg-gray-100 text-gray-500'
                                                }`}>
                                                {paper.status === 'completed' ? <CheckCircle2 size={16} /> :
                                                    paper.status === 'failed' ? <AlertCircle size={16} /> :
                                                        <FileText size={16} />}
                                            </div>
                                            <div className="w-full">
                                                <p className="text-sm font-medium text-gray-900 group-hover:text-indigo-600 transition-colors">
                                                    {paper.name}
                                                </p>
                                                <p className={`text-xs ${paper.status === 'failed' ? 'text-red-500 line-clamp-1' : 'text-gray-500'}`} title={paper.status === 'failed' ? paper.error_message : undefined}>
                                                    {paper.status === 'completed' ? paper.solution?.subject :
                                                        paper.status === 'failed' ? (paper.error_message || 'Analyse fehlgeschlagen') :
                                                            'Verarbeitung...'}
                                                </p>
                                            </div>
                                        </div>
                                        <ArrowUpRight size={16} className="text-gray-300 group-hover:text-indigo-500" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Insights & Quick Actions */}
                <div className="space-y-6">

                    {/* Weakness/Topics Widget */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                        <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wider">Wissensdatenbank</h3>
                        {stats.uniqueTopics > 0 ? (
                            <div className="space-y-4">
                                <div className="p-3 bg-orange-50 rounded-xl border border-orange-100">
                                    <p className="text-xs font-semibold text-orange-700 mb-1">Empfohlener Fokus</p>
                                    <p className="text-sm text-orange-900 font-medium">
                                        Basierend auf Ihren "schweren" Arbeiten, wiederholen Sie komplexe Themen in {papers.find(p => p.solution?.difficulty === 'Hard')?.solution?.subject || 'Ihren Fächern'}.
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs text-gray-400 mb-2 font-medium">AKTUELLE THEMEN</p>
                                    <div className="flex flex-wrap gap-2">
                                        {Array.from(new Set(papers.flatMap(p => p.solution?.topics || []))).slice(0, 5).map((t, i) => (
                                            <span key={i} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                                                {t}
                                            </span>
                                        ))}
                                        {stats.uniqueTopics > 5 && (
                                            <span className="px-2 py-1 bg-gray-50 text-gray-400 rounded text-xs">
                                                +{stats.uniqueTopics - 5} mehr
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-6 text-gray-400 text-sm">
                                <Brain size={32} className="mx-auto mb-2 opacity-20" />
                                Analysieren Sie Arbeiten, um Erkenntnisse freizuschalten.
                            </div>
                        )}
                    </div>

                    {/* Empty State / Tips (if no data) */}
                    {stats.totalPapers === 0 && (
                        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 text-gray-300 shadow-md">
                            <h3 className="text-white font-bold mb-2">Profi-Tipp</h3>
                            <p className="text-sm leading-relaxed">
                                Laden Sie mindestens 3 Prüfungsarbeiten hoch, um einen hochpräzisen wöchentlichen Lernplan von der KI zu erhalten.
                            </p>
                        </div>
                    )}

                </div>
            </div>
        </div >
    );
};

export default Dashboard;
