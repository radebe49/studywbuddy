import React, { useState, useMemo, useEffect } from 'react';
import { ExamPaper, QuestionAnalysis } from '../types';
import {
    BookOpen, CheckCircle, BrainCircuit, BarChart3, Clock, ChevronLeft,
    Download, Printer, RefreshCw, XCircle, ChevronRight, Trophy, AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { savePracticeSession as saveToAPI, getProgress as fetchProgressFromAPI, ProgressData, PracticeSessionFromAPI } from '../lib/api';

interface ExamViewerProps {
    paper: ExamPaper;
    onClose: () => void;
}

type Mode = 'review' | 'practice';
type QuestionStatus = 'unanswered' | 'correct' | 'incorrect';

// --- Re-export types for Dashboard compatibility ---
export interface PracticeSession {
    examId: string;
    examName: string;
    date: string;
    totalQuestions: number;
    correctCount: number;
    incorrectCount: number;
    scorePercentage: number;
}

// --- Helper function to load progress from Supabase API ---
export const loadProgress = async (): Promise<ProgressData> => {
    try {
        const data = await fetchProgressFromAPI();
        return data;
    } catch (e) {
        console.error('Failed to load progress from API:', e);
        return { sessions: [], questionsMastered: 0, questionsAttempted: 0 };
    }
};

const ExamViewer: React.FC<ExamViewerProps> = ({ paper, onClose }) => {
    const [mode, setMode] = useState<Mode>('review');
    const [practiceStats, setPracticeStats] = useState<Record<number, QuestionStatus>>({});
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [showPracticeResult, setShowPracticeResult] = useState(false);

    if (!paper.solution) return null;

    const questions = paper.solution.questions || [];
    const totalQuestions = questions.length;

    // --- Computed Stats ---
    const answeredCount = Object.keys(practiceStats).length;
    const correctCount = Object.values(practiceStats).filter(s => s === 'correct').length;
    const incorrectCount = Object.values(practiceStats).filter(s => s === 'incorrect').length;
    const scorePercentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    // --- Handlers ---
    const handlePrint = () => window.print();

    const startPractice = () => {
        setMode('practice');
        setPracticeStats({});
        setCurrentQuestionIndex(0);
        setShowPracticeResult(false);
    };

    const handleAnswer = (status: QuestionStatus) => {
        setPracticeStats(prev => ({
            ...prev,
            [currentQuestionIndex]: status
        }));
        setShowPracticeResult(true);

        // Optimistic confetti if correct
        if (status === 'correct') {
            confetti({
                particleCount: 50,
                spread: 60,
                origin: { y: 0.7 },
                colors: ['#4F46E5', '#10B981']
            });
        }
    };

    // --- Save Practice Session to Supabase ---
    const savePracticeSession = async () => {
        try {
            await saveToAPI({
                exam_id: paper.id,
                exam_name: paper.name,
                total_questions: totalQuestions,
                correct_count: correctCount,
                incorrect_count: incorrectCount,
                score_percentage: scorePercentage
            });
            console.log('Practice session saved to Supabase');
        } catch (e) {
            console.error('Failed to save practice session:', e);
        }
    };

    const nextQuestion = () => {
        if (currentQuestionIndex < totalQuestions - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
            setShowPracticeResult(false);
        } else {
            // Finish and Save Progress
            savePracticeSession();
            setMode('review');

            // Trigger big confetti for completion
            confetti({
                particleCount: 150,
                spread: 100,
                origin: { y: 0.6 }
            });
            alert(`Übung abgeschlossen! Sie haben ${scorePercentage}% erreicht (${correctCount}/${totalQuestions})`);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-2xl shadow-xl overflow-hidden animate-fade-in border border-gray-100 font-sans">
            {/* Header */}
            <div className="bg-white border-b border-gray-100 p-4 md:px-8 md:py-5 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 shadow-sm z-10">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 leading-tight truncate max-w-md">
                            {paper.name}
                        </h2>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                            <span className={`px-2 py-0.5 rounded-full font-semibold ${paper.solution.difficulty === 'Hard' ? 'bg-red-50 text-red-600' :
                                paper.solution.difficulty === 'Medium' ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'
                                }`}>
                                {paper.solution.difficulty}
                            </span>
                            <span>•</span>
                            <span>{paper.solution.subject}</span>
                            <span>•</span>
                            <span>{paper.solution.year || 'Unbekanntes Jahr'}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                    {mode === 'review' ? (
                        <>
                            <button
                                onClick={handlePrint}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 border border-gray-200 hidden md:flex"
                            >
                                <Download size={16} />
                                Exportieren
                            </button>
                            <button
                                onClick={startPractice}
                                className="flex-1 md:flex-none px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 active:scale-95"
                            >
                                <BrainCircuit size={18} />
                                Übung beginnen
                            </button>
                        </>
                    ) : (
                        <div className="flex items-center gap-4">
                            <div className="text-right hidden md:block">
                                <div className="text-xs text-gray-400 font-medium uppercase tracking-wider">Fortschritt</div>
                                <div className="text-sm font-bold text-gray-700">{currentQuestionIndex + 1} / {totalQuestions}</div>
                            </div>
                            <button
                                onClick={() => setMode('review')}
                                className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm font-medium"
                            >
                                Beenden
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden bg-gray-50 relative">
                {mode === 'review' ? (
                    <ReviewModeView paper={paper} />
                ) : (
                    <div className="h-full overflow-y-auto custom-scrollbar p-6 flex flex-col items-center">
                        <div className="w-full max-w-3xl">
                            {/* Progress Bar */}
                            <div className="w-full bg-gray-200 rounded-full h-1.5 mb-8 overflow-hidden">
                                <div
                                    className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500 ease-out"
                                    style={{ width: `${((currentQuestionIndex) / totalQuestions) * 100}%` }}
                                ></div>
                            </div>

                            <PracticeCard
                                question={questions[currentQuestionIndex]}
                                index={currentQuestionIndex}
                                total={totalQuestions}
                                onResult={handleAnswer}
                                onNext={nextQuestion}
                                showResult={showPracticeResult}
                                currentStatus={practiceStats[currentQuestionIndex]}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Sub-components ---

const ReviewModeView: React.FC<{ paper: ExamPaper }> = ({ paper }) => {
    return (
        <div className="h-full overflow-y-auto p-4 md:p-8 custom-scrollbar">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Summary Box */}
                <div className="bg-white rounded-xl p-6 border border-indigo-50 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-2 flex items-center gap-2">
                        <BookOpen size={16} className="text-indigo-500" />
                        Zusammenfassung
                    </h3>
                    <p className="text-gray-600 leading-relaxed text-sm">
                        {paper.solution?.summary}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
                        {paper.solution?.topics?.map((topic, idx) => (
                            <span key={idx} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                                {topic}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Questions List */}
                <div className="space-y-6">
                    {paper.solution?.questions?.map((q, idx) => (
                        <QuestionCard key={idx} question={q} index={idx} />
                    ))}
                </div>

                <div className="text-center pt-8 pb-12 text-gray-400 text-sm">
                    Ende des Dokuments
                </div>
            </div>
        </div>
    );
};

const QuestionCard: React.FC<{ question: QuestionAnalysis; index: number }> = ({ question, index }) => {
    const [showExplanation, setShowExplanation] = React.useState(false);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden break-inside-avoid">
            <div className="p-5 border-b border-gray-50 flex gap-4">
                <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 font-bold text-sm">
                    {question.questionNumber}
                </span>
                <div>
                    <span className="inline-block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">
                        {question.topic}
                    </span>
                    <p className="text-gray-800 font-medium text-base leading-relaxed">
                        {question.questionText}
                    </p>
                </div>
            </div>

            <div className="bg-gray-50/30 p-5">
                <button
                    onClick={() => setShowExplanation(!showExplanation)}
                    className="text-indigo-600 text-sm font-semibold flex items-center gap-2 hover:text-indigo-700 transition-colors mb-4 focus:outline-none"
                >
                    {showExplanation ? 'Antwort verbergen' : 'Antwort anzeigen'}
                    <ChevronLeft size={14} className={`transition-transform ${showExplanation ? '-rotate-90' : 'rotate-180'}`} />
                </button>

                <div className={`transition-all duration-300 ease-in-out overflow-hidden ${showExplanation ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="bg-green-50/50 border border-green-100 rounded-lg p-4 mb-3">
                        <div className="text-xs font-bold text-green-700 uppercase mb-1 flex items-center gap-1">
                            <CheckCircle size={12} /> Richtige Antwort
                        </div>
                        <div className="text-gray-900 font-medium text-sm">
                            {question.solution}
                        </div>
                    </div>
                    <div className="text-sm text-gray-600 pl-2 border-l-2 border-indigo-200">
                        <span className="font-semibold text-indigo-900">Erklärung:</span> {question.explanation}
                    </div>
                </div>
            </div>
        </div>
    );
};


const PracticeCard: React.FC<{
    question: QuestionAnalysis;
    index: number;
    total: number;
    onResult: (status: QuestionStatus) => void;
    onNext: () => void;
    showResult: boolean;
    currentStatus: QuestionStatus;
}> = ({ question, index, total, onResult, onNext, showResult, currentStatus }) => {

    return (
        <div className="bg-white rounded-2xl shadow-xl shadow-indigo-100/50 border border-white overflow-hidden animate-slide-up">
            {/* Question Header */}
            <div className="bg-indigo-600 p-6 text-white">
                <div className="flex justify-between items-start opacity-90 mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2 py-1 rounded">Frage {index + 1} von {total}</span>
                    <span className="text-xs font-medium text-indigo-100">{question.topic}</span>
                </div>
                <h3 className="text-xl md:text-2xl font-bold leading-snug">
                    {question.questionText}
                </h3>
            </div>

            {/* Answer Interaction Area */}
            <div className="p-6 md:p-8">
                {!showResult ? (
                    <div className="space-y-6">
                        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-500">
                            <BrainCircuit size={48} className="mx-auto mb-4 text-gray-300" />
                            <p className="text-sm font-medium">Nehmen Sie sich einen Moment Zeit, um dies selbst zu lösen.</p>
                            <p className="text-xs mt-1">Schreiben Sie es auf oder denken Sie an die Antwort.</p>
                        </div>

                        <button
                            onClick={() => onResult('unanswered')} // Just reveal first, logic handled better below
                            className="w-full py-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl transition-all active:scale-[0.98] shadow-sm border border-indigo-100"
                        >
                            Antwort aufdecken
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6 animate-fade-in">
                        {/* Result Content */}
                        <div className="space-y-4">
                            <div className="p-4 bg-gray-900 text-white rounded-xl shadow-inner">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Antwort</div>
                                <div className="font-mono text-sm md:text-base leading-relaxed">
                                    {question.solution}
                                </div>
                            </div>

                            <div className="p-4 bg-blue-50 text-blue-900 rounded-xl border border-blue-100 text-sm leading-relaxed">
                                <span className="font-bold mr-1">Erklärung:</span> {question.explanation}
                            </div>
                        </div>

                        {/* Self Grading */}
                        {!currentStatus || currentStatus === 'unanswered' ? (
                            <div className="pt-4 border-t border-gray-100">
                                <p className="text-center text-sm font-bold text-gray-900 mb-4">Haben Sie es richtig gemacht?</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => onResult('incorrect')}
                                        className="py-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl border border-red-200 transition-all flex items-center justify-center gap-2"
                                    >
                                        <XCircle size={18} />
                                        Falsch
                                    </button>
                                    <button
                                        onClick={() => onResult('correct')}
                                        className="py-3 bg-green-50 hover:bg-green-100 text-green-600 font-bold rounded-xl border border-green-200 transition-all flex items-center justify-center gap-2 shadow-sm"
                                    >
                                        <CheckCircle size={18} />
                                        Richtig
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="pt-6 border-t border-gray-100 text-center">
                                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm mb-6 ${currentStatus === 'correct' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                    }`}>
                                    {currentStatus === 'correct' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                                    {currentStatus === 'correct' ? 'Als Richtig markiert' : 'Als Falsch markiert'}
                                </div>

                                <button
                                    onClick={onNext}
                                    className="w-full py-4 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl transition-all shadow-lg shadow-gray-200 flex items-center justify-center gap-2"
                                >
                                    {index < total - 1 ? 'Nächste Frage' : 'Übung beenden'}
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default ExamViewer;
