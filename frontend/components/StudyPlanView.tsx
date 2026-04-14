"use client";

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
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Ihr persönlicher Lernplan</h2>
                <p className="text-gray-500 max-w-md mb-8">
                    ExamPilot kann Ihre gelösten Arbeiten analysieren, um eine maßgeschneiderte 7-Tage-Revisionsstrategie zu erstellen, die sich auf Ihre Schwachstellen konzentriert.
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
                                Lernplan wird erstellt...
                            </>
                        ) : (
                            <>
                                <Sparkles size={20} className="text-yellow-300" />
                                KI-Lernplan erstellen
                            </>
                        )}
                    </button>
                ) : (
                    <div className="flex items-center gap-2 px-6 py-3 bg-orange-50 text-orange-700 rounded-lg border border-orange-100">
                        <AlertCircle size={20} />
                        <span className="font-medium">Laden Sie zuerst Arbeiten hoch und analysieren Sie diese, um einen Plan zu erstellen.</span>
                    </div>
                )}
            </div>
        );
    }

    // ACTIVE STATE: Plan Exists
    return (
        <div className="h-full flex flex-col relative animate-fade-in bg-white border border-gray-100 rounded-xl overflow-hidden">
            {/* Action Button for Print */}
            <button
                onClick={handlePrint}
                className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-900 transition-colors z-10 no-print hover:bg-gray-50 rounded-md"
                title="Als PDF exportieren"
            >
                <Download size={20} />
            </button>

            <div className="p-8 border-b border-gray-200 shrink-0">
                <div className="flex items-center gap-3 mb-2 text-gray-900">
                    <Calendar className="w-5 h-5 text-emerald-600" />
                    <h2 className="text-xl font-bold">{plan.title}</h2>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed max-w-2xl">
                    {plan.overview}
                </p>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="space-y-8 max-w-3xl mx-auto">
                    {plan.schedule.map((day, idx) => (
                        <div key={idx} className="pb-8 border-b border-gray-100 last:border-0 relative break-inside-avoid">
                            
                            <div className="flex flex-col md:flex-row md:items-start gap-4 mb-4">
                                <div className="flex-shrink-0 w-12 pt-1">
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Tag</div>
                                    <div className="text-2xl font-black text-gray-900 text-center">{day.day}</div>
                                </div>

                                <div className="flex-1">
                                    <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                                        {day.focus}
                                    </h3>
                                    <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                                        <span className="flex items-center gap-1"><Clock size={12} /> {day.durationMinutes} Min.</span>
                                        <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(day.date).toLocaleDateString('de-DE')}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3 pl-16">
                                {day.tasks.map((task, tIdx) => (
                                    <div key={tIdx} className="flex items-start gap-3 text-sm text-gray-700">
                                        <CheckSquare size={16} className="text-gray-300 mt-0.5 shrink-0" />
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
                            Plan aus neuesten Arbeiten neu erstellen
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudyPlanView;
