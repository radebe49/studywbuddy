"use client";

import React, { useState, useEffect } from 'react';
import { ExamPaper, StudyPlan, ViewState } from '../types';
import Sidebar from '../components/Sidebar';
import Dashboard from '../components/Dashboard';
import ExamViewer from '../components/ExamViewer';
import StudyPlanView from '../components/StudyPlanView';
import StudyGuides from '../components/StudyGuides';
import { Menu } from 'lucide-react';
import * as api from '../lib/api';

const App: React.FC = () => {
    const [papers, setPapers] = useState<ExamPaper[]>([]);
    const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);

    // --- UI State ---
    const [activeView, setActiveView] = useState<ViewState>('dashboard');
    const [selectedPaperId, setSelectedPaperId] = useState<string | undefined>(undefined);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

    // --- Data Fetching ---
    const refreshPapers = async () => {
        try {
            const list = await api.getExams();

            // Hydrate with solutions for completed papers
            const detailedList = await Promise.all(list.map(async (p) => {
                if (p.status === 'completed') {
                    try {
                        // Check if we already have it in state to avoid refetch? 
                        // For now, simpliest valid approach: fetch. 
                        // Optimization: caching could be done here.
                        const sol = await api.getSolution(p.id);
                        return { ...p, solution: sol };
                    } catch (e) {
                        console.error(`Failed to load solution for ${p.id}`, e);
                        return p;
                    }
                }
                return p;
            }));

            setPapers(detailedList);
        } catch (e) {
            console.error("Failed to fetch exams", e);
        }
    };

    useEffect(() => {
        refreshPapers();
        const interval = setInterval(refreshPapers, 5000); // Poll every 5s
        return () => clearInterval(interval);
    }, []);

    // --- Action Handlers ---

    const handleFileUpload = async (files: File[]) => {
        // Optimistic UI updates could be added here, but we rely on polling/refresh for now
        try {
            await api.uploadExams(files);
            await refreshPapers(); // Immediate refresh
        } catch (e) {
            alert("Upload failed");
        }
    };

    const handleCreateStudyPlan = async () => {
        const solvedPapers = papers.filter(p => p.status === 'completed' && p.solution);
        if (solvedPapers.length === 0) {
            alert("Please upload and solve at least one exam paper first.");
            return;
        }

        setIsGeneratingPlan(true);
        setActiveView('study-plan');

        try {
            // Map papers to solutions
            const solutions = solvedPapers.map(p => p.solution!).filter(Boolean);
            const plan = await api.generateStudyPlan(solutions);
            setStudyPlan(plan);
        } catch (e) {
            alert("Failed to generate study plan. Please try again.");
            console.error(e);
            setActiveView('dashboard');
        } finally {
            setIsGeneratingPlan(false);
        }
    };

    const handleNavigate = (view: ViewState) => {
        setActiveView(view);
        setSelectedPaperId(undefined);
        setIsSidebarOpen(false);
    };

    const handleSelectPaper = (paper: ExamPaper) => {
        setSelectedPaperId(paper.id);
        setActiveView('paper-details');
        setIsSidebarOpen(false);
    };

    // --- Render Helpers ---

    const renderContent = () => {
        if (activeView === 'paper-details' && selectedPaperId) {
            const paper = papers.find(p => p.id === selectedPaperId);
            if (paper) {
                return (
                    <ExamViewer
                        paper={paper}
                        onClose={() => handleNavigate('dashboard')}
                    />
                );
            }
        }

        if (activeView === 'study-plan') {
            return (
                <StudyPlanView
                    plan={studyPlan}
                    hasSolvedPapers={papers.some(p => p.status === 'completed')}
                    onGenerate={handleCreateStudyPlan}
                    isGenerating={isGeneratingPlan}
                />
            );
        }

        if (activeView === 'study-guides') {
            return <StudyGuides />;
        }

        // Default to Dashboard
        return (
            <Dashboard
                papers={papers}
                studyPlan={studyPlan}
                onFileUpload={handleFileUpload}
                onViewPaper={handleSelectPaper}
                onGeneratePlan={handleCreateStudyPlan}
                onNavigateToPlan={() => handleNavigate('study-plan')}
            />
        );
    };

    return (
        <div className="flex h-screen bg-surface-dark overflow-hidden font-sans text-gray-900">
            <Sidebar
                papers={papers}
                activeView={activeView}
                onNavigate={handleNavigate}
                onSelectPaper={handleSelectPaper}
                selectedPaperId={selectedPaperId}
                onImportClick={() => document.getElementById('fileInput')?.click()}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />

            <main className="flex-1 bg-gray-50/50 relative overflow-hidden flex flex-col w-full">
                {/* Background blobs */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-200 rounded-full blur-3xl opacity-30 -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-200 rounded-full blur-3xl opacity-30 translate-y-1/3 -translate-x-1/4 pointer-events-none"></div>

                {/* Mobile Header */}
                <div className="md:hidden px-4 pt-4 pb-2 flex items-center justify-between z-20 shrink-0 no-print">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-2 bg-white/80 backdrop-blur-md rounded-xl shadow-sm border border-gray-200 text-gray-700 active:scale-95 transition-transform"
                    >
                        <Menu size={20} />
                    </button>
                    <span className="font-bold text-gray-700">ExamPilot</span>
                    <div className="w-9" />
                </div>

                <div className="flex-1 p-4 md:p-6 z-10 overflow-hidden relative">
                    {renderContent()}
                </div>
            </main>
        </div>
    );
};

export default App;
