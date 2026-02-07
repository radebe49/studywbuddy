import React from 'react';
import { StudyPlan } from '../types';
import { Calendar, Clock, CheckSquare, Target, Download, Sparkles, AlertCircle } from 'lucide-react';

interface StudyPlanViewProps {
    plan: StudyPlan | null;
    hasSolvedPapers: boolean;
    onGenerate: () => void;
    isGenerating: boolean;
}

const StudyPlanView: React.FC<StudyPlanViewProps> = ({ plan, hasSolvedPapers, onGenerate, isGenerating }) => {
    const handlePrint = () => {
        window.print();
    };

    // EMPTY STATE: No Plan Generated Yet
    if (!plan) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-fade-in">
                <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
                    <Calendar size={48} className="text-indigo-400" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Your Personal Study Schedule</h2>
                <p className="text-gray-500 max-w-md mb-8">
                    ExamPilot can analyze your solved papers to create a tailored 7-day revision strategy focusing on your weak areas.
                </p>

                {hasSolvedPapers ? (
                    <button
                        onClick={onGenerate}
                        disabled={isGenerating}
                        className="px-8 py-4 bg-gray-900 hover:bg-black text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center gap-3 disabled:opacity-70 disabled:cursor-wait"
                    >
                        {isGenerating ? (
                            <>
                                <Sparkles size={20} className="animate-spin text-yellow-300" />
                                Designing your plan...
                            </>
                        ) : (
                            <>
                                <Sparkles size={20} className="text-yellow-300" />
                                Generate AI Study Plan
                            </>
                        )}
                    </button>
                ) : (
                    <div className="flex items-center gap-2 px-6 py-3 bg-orange-50 text-orange-700 rounded-lg border border-orange-100">
                        <AlertCircle size={20} />
                        <span className="font-medium">Upload and analyze papers first to generate a plan.</span>
                    </div>
                )}
            </div>
        );
    }

    // ACTIVE STATE: Plan Exists
    return (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden h-full flex flex-col relative animate-fade-in">
            {/* Floating Action Button for Print */}
            <button
                onClick={handlePrint}
                className="absolute top-6 right-6 p-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors z-10 no-print"
                title="Export as PDF"
            >
                <Download size={20} />
            </button>

            <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-emerald-500 to-teal-600 text-white shrink-0">
                <div className="flex items-center gap-3 mb-2">
                    <Calendar className="w-6 h-6" />
                    <h2 className="text-xl font-bold">{plan.title}</h2>
                </div>
                <p className="text-emerald-50 text-sm opacity-90 leading-relaxed pr-8">
                    {plan.overview}
                </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gray-50 custom-scrollbar">
                <div className="space-y-4 max-w-3xl mx-auto">
                    {plan.schedule.map((day, idx) => (
                        <div key={idx} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden group break-inside-avoid">
                            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 print:bg-emerald-600"></div>

                            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
                                <div className="flex-shrink-0">
                                    <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex flex-col items-center justify-center border border-emerald-100">
                                        <span className="text-xs font-bold uppercase">Day</span>
                                        <span className="text-lg font-bold">{day.day}</span>
                                    </div>
                                </div>

                                <div className="flex-1">
                                    <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                                        {day.focus}
                                    </h3>
                                    <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                                        <span className="flex items-center gap-1"><Clock size={12} /> {day.durationMinutes} mins</span>
                                        <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(day.date).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 pl-2">
                                {day.tasks.map((task, tIdx) => (
                                    <div key={tIdx} className="flex items-start gap-3 text-sm text-gray-700">
                                        <CheckSquare size={16} className="text-emerald-400 mt-0.5 shrink-0 print:text-black" />
                                        <span>{task}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    <div className="text-center pt-8 pb-4">
                        <button
                            onClick={onGenerate}
                            className="text-sm text-gray-400 hover:text-indigo-600 underline transition-colors no-print"
                        >
                            Regenerate Plan from latest papers
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudyPlanView;
