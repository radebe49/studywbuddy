"use client";

import React, { useState } from 'react';
import { ExamPaper, ViewState } from '../types';
import { FileText, Loader2, CheckCircle, AlertCircle, Plus, LayoutDashboard, Calendar, X, Search, ChevronDown, ChevronRight, GraduationCap, Briefcase, BookOpen, Settings as SettingsIcon, MessageSquare, LogOut } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface SidebarProps {
    papers: ExamPaper[];
    activeView: ViewState;
    onNavigate: (view: ViewState) => void;
    onSelectPaper: (paper: ExamPaper) => void;
    selectedPaperId?: string;
    onImportClick: () => void;
    isOpen: boolean;
    onClose: () => void;
    userEmail?: string;
    onSignOut: () => void;
}

// Helper to detect qualification area from subject/solution
const detectQualificationArea = (paper: ExamPaper): 'BQ' | 'HQ' | 'Unbekannt' => {
    const subject = paper.solution?.subject?.toLowerCase() || '';

    // BQ patterns
    if (subject.includes('ntg') || subject.includes('naturwissenschaft') ||
        subject.includes('recht') || subject.includes('bwl') ||
        subject.includes('betriebswirt') || subject.includes('basis')) {
        return 'BQ';
    }

    // HQ patterns
    if (subject.includes('technik') || subject.includes('automatisierung') ||
        subject.includes('personal') || subject.includes('führung') ||
        subject.includes('organisation') || subject.includes('handlung')) {
        return 'HQ';
    }

    return 'Unbekannt';
};

const Sidebar: React.FC<SidebarProps> = ({
    papers,
    activeView,
    onNavigate,
    onSelectPaper,
    selectedPaperId,
    onImportClick,
    isOpen,
    onClose,
    userEmail,
    onSignOut
}) => {
    const { t } = useLanguage();

    // --- State for Search ---
    const [searchTerm, setSearchTerm] = useState('');
    const [groupByQualification, setGroupByQualification] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
        BQ: true,
        HQ: true,
        Unbekannt: true
    });

    // --- Filtering Logic ---
    const filteredPapers = papers.filter(paper => {
        if (!searchTerm) return true;
        const lowerTerm = searchTerm.toLowerCase();
        return (
            paper.name.toLowerCase().includes(lowerTerm) ||
            paper.solution?.subject?.toLowerCase().includes(lowerTerm) ||
            paper.solution?.difficulty?.toLowerCase().includes(lowerTerm)
        );
    });

    // Group papers by qualification area
    const groupedPapers = {
        BQ: filteredPapers.filter(p => detectQualificationArea(p) === 'BQ'),
        HQ: filteredPapers.filter(p => detectQualificationArea(p) === 'HQ'),
        Unbekannt: filteredPapers.filter(p => detectQualificationArea(p) === 'Unbekannt')
    };

    const toggleGroup = (group: string) => {
        setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
    };

    // Helper to render a paper button
    const renderPaperButton = (paper: ExamPaper) => (
        <button
            key={paper.id}
            onClick={() => onSelectPaper(paper)}
            className={`w-full text-left p-2.5 rounded-lg flex items-start gap-3 transition-all group ${selectedPaperId === paper.id
                ? 'bg-gray-50/50'
                : 'bg-transparent hover:bg-gray-50/50'
                }`}
        >
            <div className={`mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full transition-colors ${paper.status === 'completed' ? 'bg-emerald-400' :
                paper.status === 'processing' ? 'bg-blue-400 animate-pulse' :
                    paper.status === 'failed' ? 'bg-red-400' :
                        'bg-gray-300'
                }`} />
            <div className="min-w-0 flex-1">
                <p className={`text-sm leading-snug truncate ${selectedPaperId === paper.id ? 'font-medium text-gray-900' : 'text-gray-600 group-hover:text-gray-900'}`}>
                    {paper.name}
                </p>
                <p className="text-[10px] text-gray-400 truncate mt-0.5 tracking-wide">
                    {paper.status === 'completed' ? (paper.solution?.subject || t('ready')) : paper.status === 'processing' ? t('processing') : paper.status === 'failed' ? t('failed') : t('ready')}
                </p>
            </div>
        </button>
    );

    // Helper to determine active state style
    const getNavItemClass = (isActive: boolean) =>
        `w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 transition-colors text-sm ${isActive
            ? 'font-medium text-gray-900 bg-gray-50/80'
            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50/50'
        }`;

    return (
        <>
            {/* Mobile Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/30 z-30 md:hidden backdrop-blur-sm transition-opacity no-print"
                    onClick={onClose}
                />
            )}

            <div className={`
        fixed inset-y-0 left-0 z-40 bg-white border-r border-gray-100 flex flex-col h-full shrink-0
        transition-transform duration-300 ease-in-out w-72 md:w-80
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0
        no-print
      `}>
                <div className="p-6 md:px-8 pb-4 flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900 tracking-tight mb-1">
                            ExamPilot
                        </h1>
                        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">{t('welcomeBack').replace(',', '')}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="md:hidden text-gray-400 hover:text-gray-900 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="px-6 md:px-8 pb-4 pt-2">
                    <div className="relative group">
                        <Search className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
                        <input
                            type="text"
                            placeholder="Suchen..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-8 py-2 bg-transparent border-b border-gray-200 text-sm focus:outline-none focus:border-indigo-500 transition-all placeholder:text-gray-400"
                        />
                    </div>
                </div>

                <div className="px-4 md:px-6 space-y-1 mt-2">
                    <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-2 mb-3">Menü</div>

                    <button onClick={() => onNavigate('dashboard')} className={getNavItemClass(activeView === 'dashboard')}>
                        <LayoutDashboard size={16} className={activeView === 'dashboard' ? 'text-indigo-600' : 'text-gray-400'} />
                        {t('dashboard')}
                    </button>

                    <button onClick={() => onNavigate('study-plan')} className={getNavItemClass(activeView === 'study-plan')}>
                        <Calendar size={16} className={activeView === 'study-plan' ? 'text-indigo-600' : 'text-gray-400'} />
                        {t('learningPath')}
                    </button>

                    <button onClick={() => onNavigate('study-guides')} className={getNavItemClass(activeView === 'study-guides')}>
                        <BookOpen size={16} className={activeView === 'study-guides' ? 'text-indigo-600' : 'text-gray-400'} />
                        {t('studyGuides')}
                    </button>

                    <button onClick={() => onNavigate('fachgespraech')} className={getNavItemClass(activeView === 'fachgespraech')}>
                        <MessageSquare size={16} className={activeView === 'fachgespraech' ? 'text-indigo-600' : 'text-gray-400'} />
                        {t('fachgespraech')}
                    </button>

                    <button onClick={() => onNavigate('settings')} className={getNavItemClass(activeView === 'settings')}>
                        <SettingsIcon size={16} className={activeView === 'settings' ? 'text-indigo-600' : 'text-gray-400'} />
                        {t('settings')}
                    </button>

                    <div className="pt-4 pb-2 px-2">
                        <button
                            onClick={onImportClick}
                            className="w-full py-2.5 text-xs bg-gray-900 hover:bg-black text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2 active:scale-95"
                        >
                            <Plus size={14} /> {t('uploadExams')}
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 md:px-6 space-y-2 custom-scrollbar mt-4">
                    <div className="flex items-center justify-between px-2 mb-4">
                        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                            {searchTerm ? 'Suchergebnisse' : 'Dokumente'}
                        </div>
                        <button
                            onClick={() => setGroupByQualification(!groupByQualification)}
                            className={`text-gray-400 hover:text-gray-800 transition-colors ${groupByQualification ? 'text-indigo-600' : ''}`}
                            title="Formatierte Struktur"
                        >
                            <LayoutDashboard size={14} />
                        </button>
                    </div>

                    {filteredPapers.length === 0 && (
                        <div className="text-left px-2 text-gray-400 text-sm">
                            {searchTerm ? 'Keine Treffer.' : 'Keine Dokumente.'}
                        </div>
                    )}

                    {/* Grouped View */}
                    {groupByQualification && filteredPapers.length > 0 && (
                        <div className="space-y-6">
                            {/* BQ Group */}
                            {groupedPapers.BQ.length > 0 && (
                                <div>
                                    <button onClick={() => toggleGroup('BQ')} className="w-full flex items-center justify-between px-2 pb-2 mb-2 border-b border-gray-100 group">
                                        <span className="text-[11px] font-semibold text-gray-900 uppercase tracking-wider group-hover:text-indigo-600 transition-colors">Basisqualifikationen</span>
                                        <span className="text-[10px] text-gray-400 font-medium">{groupedPapers.BQ.length}</span>
                                    </button>
                                    {expandedGroups.BQ && <div className="space-y-1">{groupedPapers.BQ.map(paper => renderPaperButton(paper))}</div>}
                                </div>
                            )}

                            {/* HQ Group */}
                            {groupedPapers.HQ.length > 0 && (
                                <div>
                                    <button onClick={() => toggleGroup('HQ')} className="w-full flex items-center justify-between px-2 pb-2 mb-2 border-b border-gray-100 group">
                                        <span className="text-[11px] font-semibold text-gray-900 uppercase tracking-wider group-hover:text-amber-600 transition-colors">Handlungsspezifisch</span>
                                        <span className="text-[10px] text-gray-400 font-medium">{groupedPapers.HQ.length}</span>
                                    </button>
                                    {expandedGroups.HQ && <div className="space-y-1">{groupedPapers.HQ.map(paper => renderPaperButton(paper))}</div>}
                                </div>
                            )}

                            {/* Unbekannt Group */}
                            {groupedPapers.Unbekannt.length > 0 && (
                                <div>
                                    <button onClick={() => toggleGroup('Unbekannt')} className="w-full flex items-center justify-between px-2 pb-2 mb-2 border-b border-gray-100 group">
                                        <span className="text-[11px] font-semibold text-gray-900 uppercase tracking-wider group-hover:text-gray-600 transition-colors">Nicht Klassifiziert</span>
                                        <span className="text-[10px] text-gray-400 font-medium">{groupedPapers.Unbekannt.length}</span>
                                    </button>
                                    {expandedGroups.Unbekannt && <div className="space-y-1">{groupedPapers.Unbekannt.map(paper => renderPaperButton(paper))}</div>}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Flat View (default) */}
                    {!groupByQualification && <div className="space-y-1">{filteredPapers.map(paper => renderPaperButton(paper))}</div>}
                </div>

                <div className="p-6 md:px-8 border-t border-gray-100 bg-white space-y-4">
                    {userEmail && (
                        <div className="flex flex-col gap-1">
                            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Angemeldet als</p>
                            <p className="text-xs text-gray-600 truncate font-medium">{userEmail}</p>
                        </div>
                    )}
                    <button 
                        onClick={onSignOut}
                        className="w-full py-2.5 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg font-medium transition-all flex items-center gap-2 active:scale-95"
                    >
                        <LogOut size={14} /> {t('logout')}
                    </button>
                    <div className="pt-2">
                        <p className="text-[10px] font-medium tracking-widest text-gray-300 uppercase">v2.1 • Multi-User Secure</p>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Sidebar;
