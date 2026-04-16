"use client";

import React, { useState, useEffect } from 'react';
import { ExamPaper, StudyPlan, ViewState, Specialization } from '../types';
import Sidebar from '../components/Sidebar';
import Dashboard from '../components/Dashboard';
import ExamViewer from '../components/ExamViewer';
import StudyPlanView from '../components/StudyPlanView';
import StudyGuides from '../components/StudyGuides';
import Settings from '../components/Settings';
import FachgespraechBot from '../components/FachgespraechBot';
import SmartLoadingOverlay from '../components/SmartLoadingOverlay';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';
import { useToast } from '../components/Toast';
import { useLanguage } from '../context/LanguageContext';
import { LogOut, Menu } from 'lucide-react';
import * as api from '../lib/api';
import { Language } from '../lib/translations';

const AppContent: React.FC = () => {
    const { toast } = useToast();
    const { user, loading, signOut } = useAuth();
    const { language, setLanguage } = useLanguage();
    const router = useRouter();
    const [papers, setPapers] = useState<ExamPaper[]>([]);
    const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);

    // --- UI State (must be declared before any conditional returns per Rules of Hooks) ---
    const [activeView, setActiveView] = useState<ViewState>('dashboard');
    const [selectedPaperId, setSelectedPaperId] = useState<string | undefined>(undefined);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
    const [isExtracting, setIsExtracting] = useState(false);
    const [specialization, setSpecialization] = useState<Specialization>('Infrastruktursysteme und Betriebstechnik');

    const extractionSteps: any[] = [
        'stepQuestions',
        'stepConcepts',
        'stepFinalizing'
    ];

    // Ref mirror of papers so refreshPapers can read the latest without re-binding
    const papersRef = React.useRef<ExamPaper[]>([]);

    // --- Auth Guard ---
    useEffect(() => {
        if (!loading && !user) {
            router.push('/auth');
        }
    }, [user, loading, router]);

    // --- Persist Settings (Specialization & Language) ---
    useEffect(() => {
        if (!user) return;
        const fetchSettings = async () => {
            try {
                const settings = await api.getSettings();
                
                // Handle Specialization
                if (settings.specialization) {
                    setSpecialization(settings.specialization as Specialization);
                    localStorage.setItem('user_specialization', settings.specialization);
                } else {
                    const saved = localStorage.getItem('user_specialization') as Specialization;
                    if (saved) setSpecialization(saved);
                }

                // Handle Language
                if (settings.language) {
                    setLanguage(settings.language as Language);
                }
            } catch (e) {
                console.error("Failed to fetch settings", e);
                const savedSpec = localStorage.getItem('user_specialization') as Specialization;
                if (savedSpec) setSpecialization(savedSpec);
                
                const savedLang = localStorage.getItem('ui-language') as Language;
                if (savedLang) setLanguage(savedLang);
            }
        };
        fetchSettings();
    }, [user, setLanguage]);

    // Update backend when language changes (if it differs from what's likely on server)
    useEffect(() => {
        if (!user || loading) return;
        const syncLanguage = async () => {
            try {
                // This is a bit of a "silent" update to keep backend in sync with local storage/UI choice
                await api.updateSettings(undefined, language);
            } catch (e) {
                console.error("Failed to sync language to backend", e);
            }
        };
        syncLanguage();
    }, [language, user, loading]);

    // Sync papersRef with papers state
    useEffect(() => {
        papersRef.current = papers;
    }, [papers]);

    // Adaptive polling: fast cadence only while an exam is actively processing,
    // slow background cadence otherwise. Pauses entirely when the tab is hidden.
    useEffect(() => {
        if (!user) return; // skip polling when not authenticated

        let timer: ReturnType<typeof setTimeout> | null = null;
        let cancelled = false;

        const refreshPapersInner = async () => {
            try {
                const list = await api.getExams();

                setPapers((prev) => {
                    const prevById = new Map(prev.map((p) => [p.id, p]));
                    return list.map((p) => {
                        const cached = prevById.get(p.id);
                        if (cached?.solution && cached.status === 'completed' && p.status === 'completed') {
                            return { ...p, solution: cached.solution };
                        }
                        return p;
                    });
                });

                // Fire hydration for completed papers that don't yet have a solution cached
                const needsSolution = list.filter(
                    (p) => p.status === 'completed',
                );
                await Promise.all(
                    needsSolution.map(async (p) => {
                        // skip if we already have it in local state
                        const already = papersRef.current.find((x) => x.id === p.id && x.solution);
                        if (already) return;
                        try {
                            const sol = await api.getSolution(p.id);
                            setPapers((cur) => cur.map((x) => (x.id === p.id ? { ...x, solution: sol } : x)));
                        } catch (e) {
                            console.error(`Failed to load solution for ${p.id}`, e);
                        }
                    }),
                );
            } catch (e) {
                console.error('Failed to fetch exams', e);
            }
        };

        const tick = async () => {
            if (cancelled) return;
            if (typeof document !== 'undefined' && document.hidden) {
                timer = setTimeout(tick, 15000);
                return;
            }
            await refreshPapersInner();
            if (cancelled) return;
            const hasActive = papersRef.current.some(
                (p) => p.status === 'processing' || p.status === 'uploading',
            );
            timer = setTimeout(tick, hasActive ? 5000 : 30000);
        };

        tick();
        const onVisible = () => {
            if (!document.hidden && timer) {
                clearTimeout(timer);
                tick();
            }
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [user]);

    // --- Loading / Auth guard return ---
    if (loading || !user) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-500 font-medium">Authentifizierung...</p>
                </div>
            </div>
        );
    }

    // --- Data Fetching (wrapper for manual refresh calls) ---
    const refreshPapers = async () => {
        try {
            const list = await api.getExams();

            setPapers((prev) => {
                const prevById = new Map(prev.map((p) => [p.id, p]));
                return list.map((p) => {
                    const cached = prevById.get(p.id);
                    if (cached?.solution && cached.status === 'completed' && p.status === 'completed') {
                        return { ...p, solution: cached.solution };
                    }
                    return p;
                });
            });

            const needsSolution = list.filter(
                (p) => p.status === 'completed',
            );
            await Promise.all(
                needsSolution.map(async (p) => {
                    const already = papersRef.current.find((x) => x.id === p.id && x.solution);
                    if (already) return;
                    try {
                        const sol = await api.getSolution(p.id);
                        setPapers((cur) => cur.map((x) => (x.id === p.id ? { ...x, solution: sol } : x)));
                    } catch (e) {
                        console.error(`Failed to load solution for ${p.id}`, e);
                    }
                }),
            );
        } catch (e) {
            console.error('Failed to fetch exams', e);
        }
    };

    const handleSpecializationChange = async (spec: Specialization) => {
        setSpecialization(spec);
        localStorage.setItem('user_specialization', spec);
        try {
            await api.updateSettings(spec, language);
        } catch (e) {
            console.error('Failed to update settings', e);
            toast("Änderung fehlgeschlagen", "error");
        }
    };

    const handleDeletePaper = async (id: string) => {
        if (!confirm("Sind Sie sicher, dass Sie diese Prüfungsarbeit und alle zugehörigen Daten löschen möchten?")) return;
        
        try {
            toast("Lösche Dokument...", "loading");
            await api.deleteExam(id);
            setPapers(prev => prev.filter(p => p.id !== id));
            toast("Dokument erfolgreich gelöscht", "success");
            if (selectedPaperId === id) {
                setSelectedPaperId(undefined);
                setActiveView('dashboard');
            }
        } catch (e) {
            console.error("Delete failed", e);
            toast("Fehler beim Löschen des Dokuments", "error");
        }
    };

    // --- Action Handlers ---

    const handleFileUpload = async (files: File[]) => {
        try {
            setIsExtracting(true);
            await api.uploadExams(files);
            await refreshPapers(); // Immediate refresh
            
            // We keep it visible for a bit to show progress even if upload was fast
            setTimeout(() => {
                setIsExtracting(false);
            }, 5000);
        } catch (e) {
            setIsExtracting(false);
            toast("Upload fehlgeschlagen", "error");
        }
    };

    const handleRetryPaper = async (paperId: string) => {
        try {
            await api.retryExam(paperId);
            await refreshPapers();
        } catch (e) {
            console.error('Retry failed', e);
            toast("Retry fehlgeschlagen. Möglicherweise ist die Datei nicht mehr auf dem Server vorhanden.", "error");
        }
    };

    const handleCreateStudyPlan = async () => {
        const solvedPapers = papers.filter(p => p.status === 'completed' && p.solution);
        if (solvedPapers.length === 0) {
            toast("Bitte laden Sie zuerst mindestens eine Prüfungsarbeit hoch und lösen Sie diese.", "info");
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
            console.error('Failed to generate study plan', e);
            toast("Fehler beim Erstellen des Lernplans. Bitte versuchen Sie es erneut.", "error");
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
                        specialization={specialization}
                        onSpecializationChange={handleSpecializationChange}
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
            return <StudyGuides specialization={specialization} />;
        }

        if (activeView === 'fachgespraech') {
            return <FachgespraechBot />;
        }

        if (activeView === 'settings') {
            return (
                <Settings
                    specialization={specialization}
                    onSpecializationChange={handleSpecializationChange}
                />
            );
        }

        // Default to Dashboard
        return (
            <Dashboard
                papers={papers}
                studyPlan={studyPlan}
                onFileUpload={handleFileUpload}
                onViewPaper={handleSelectPaper}
                onRetryPaper={handleRetryPaper}
                onGeneratePlan={handleCreateStudyPlan}
                onNavigateToPlan={() => handleNavigate('study-plan')}
                onDeletePaper={handleDeletePaper}
                specialization={specialization}
                onNavigateToSettings={() => handleNavigate('settings')}
            />
        );
    };

    return (
        <div className="flex h-screen bg-white overflow-hidden font-sans text-gray-900 relative">
            <SmartLoadingOverlay 
                titleKey="processingAI" 
                steps={extractionSteps} 
                isProcessing={isExtracting} 
            />
            <Sidebar
                papers={papers}
                activeView={activeView}
                onNavigate={handleNavigate}
                onSelectPaper={handleSelectPaper}
                selectedPaperId={selectedPaperId}
                onImportClick={() => document.getElementById('fileInput')?.click()}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                userEmail={user?.email}
                onSignOut={signOut}
            />

            <main className="flex-1 bg-white relative overflow-hidden flex flex-col w-full">
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

const App: React.FC = () => {
    return <AppContent />;
};

export default App;
