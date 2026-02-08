import React, { useState } from 'react';
import { ExamPaper, ViewState } from '../types';
import { FileText, Loader2, CheckCircle, AlertCircle, Plus, LayoutDashboard, Calendar, X, Search, ChevronDown, ChevronRight, GraduationCap, Briefcase, BookOpen, Settings as SettingsIcon, MessageSquare } from 'lucide-react';

interface SidebarProps {
    papers: ExamPaper[];
    activeView: ViewState;
    onNavigate: (view: ViewState) => void;
    onSelectPaper: (paper: ExamPaper) => void;
    selectedPaperId?: string;
    onImportClick: () => void;
    isOpen: boolean;
    onClose: () => void;
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
    onClose
}) => {

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
            className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-all border group ${selectedPaperId === paper.id
                ? 'bg-white border-indigo-200 shadow-sm ring-1 ring-indigo-100'
                : 'bg-transparent border-transparent hover:bg-gray-50'
                }`}
        >
            <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${paper.status === 'completed' ? 'bg-green-100 text-green-600' :
                paper.status === 'processing' ? 'bg-blue-100 text-blue-600' :
                    paper.status === 'failed' ? 'bg-red-100 text-red-600' :
                        'bg-gray-100 text-gray-500'
                }`}>
                {paper.status === 'processing' ? <Loader2 size={16} className="animate-spin" /> :
                    paper.status === 'completed' ? <CheckCircle size={16} /> :
                        paper.status === 'failed' ? <AlertCircle size={16} /> :
                            <FileText size={16} />}
            </div>
            <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium truncate ${selectedPaperId === paper.id ? 'text-indigo-900' : 'text-gray-700 group-hover:text-gray-900'}`}>
                    {paper.name}
                </p>
                <p className="text-xs text-gray-400 truncate">
                    {paper.solution ? paper.solution.subject :
                        paper.status === 'processing' ? 'Verarbeitung...' :
                            paper.status === 'failed' ? 'Analyse fehlgeschlagen' : 'Bereit'}
                </p>
            </div>
        </button>
    );

    // Helper to determine active state style
    const getNavItemClass = (isActive: boolean) =>
        `w-full text-left px-3 py-3 rounded-lg flex items-center gap-3 transition-all font-medium ${isActive
            ? 'bg-indigo-50 text-indigo-700 shadow-sm'
            : 'text-gray-600 hover:bg-gray-50'
        }`;

    return (
        <>
            {/* Mobile Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm transition-opacity no-print"
                    onClick={onClose}
                />
            )}

            <div className={`
        fixed inset-y-0 left-0 z-40 bg-white border-r border-gray-200 flex flex-col h-full shrink-0
        transition-transform duration-300 ease-in-out w-80
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0
        no-print
      `}>
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 mb-1">
                            ExamPilot
                        </h1>
                        <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">KI-Lernbegleiter</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="md:hidden p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="px-4 pt-4 pb-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Arbeiten, Fächer suchen..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-gray-400"
                        />
                    </div>
                </div>

                <div className="p-4 space-y-2">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">Menü</div>

                    <button
                        onClick={() => onNavigate('dashboard')}
                        className={getNavItemClass(activeView === 'dashboard')}
                    >
                        <LayoutDashboard size={18} />
                        Dashboard
                    </button>

                    <button
                        onClick={() => onNavigate('study-plan')}
                        className={getNavItemClass(activeView === 'study-plan')}
                    >
                        <Calendar size={18} />
                        Lernplan
                    </button>

                    <button
                        onClick={() => onNavigate('study-guides')}
                        className={getNavItemClass(activeView === 'study-guides')}
                    >
                        <FileText size={18} />
                        Lernleitfäden
                    </button>

                    <button
                        onClick={() => onNavigate('fachgespraech')}
                        className={getNavItemClass(activeView === 'fachgespraech')}
                    >
                        <MessageSquare size={18} />
                        Fachgespräch Bot
                    </button>

                    <button
                        onClick={() => onNavigate('settings')}
                        className={getNavItemClass(activeView === 'settings')}
                    >
                        <SettingsIcon size={18} />
                        Profil & Setup
                    </button>

                    <button
                        onClick={onImportClick}
                        className="mt-4 w-full py-3 px-4 bg-gray-900 hover:bg-black text-white rounded-xl font-medium shadow-md transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                        <Plus size={18} /> Arbeiten importieren
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 custom-scrollbar">
                    <div className="flex items-center justify-between px-2 mb-2 mt-6">
                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            {searchTerm ? 'Suchergebnisse' : 'Prüfungsarbeiten'}
                        </div>
                        <button
                            onClick={() => setGroupByQualification(!groupByQualification)}
                            className={`text-xs px-2 py-1 rounded transition-colors ${groupByQualification ? 'bg-indigo-100 text-indigo-700' : 'text-gray-400 hover:text-gray-600'}`}
                            title="Nach IHK-Struktur gruppieren"
                        >
                            <BookOpen size={14} />
                        </button>
                    </div>

                    {filteredPapers.length === 0 && (
                        <div className="text-center py-8 px-4 text-gray-400 text-sm italic">
                            {searchTerm ? 'Keine Treffer gefunden.' : 'Noch keine Arbeiten.'}
                        </div>
                    )}

                    {/* Grouped View */}
                    {groupByQualification && filteredPapers.length > 0 && (
                        <div className="space-y-3">
                            {/* BQ Group */}
                            {groupedPapers.BQ.length > 0 && (
                                <div className="bg-blue-50/50 rounded-lg border border-blue-100 overflow-hidden">
                                    <button
                                        onClick={() => toggleGroup('BQ')}
                                        className="w-full flex items-center justify-between p-2 hover:bg-blue-50 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <GraduationCap size={14} className="text-blue-600" />
                                            <span className="text-xs font-semibold text-gray-700">Basisqualifikationen</span>
                                            <span className="text-xs text-gray-400">({groupedPapers.BQ.length})</span>
                                        </div>
                                        {expandedGroups.BQ ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </button>
                                    {expandedGroups.BQ && groupedPapers.BQ.map(paper => renderPaperButton(paper))}
                                </div>
                            )}

                            {/* HQ Group */}
                            {groupedPapers.HQ.length > 0 && (
                                <div className="bg-amber-50/50 rounded-lg border border-amber-100 overflow-hidden">
                                    <button
                                        onClick={() => toggleGroup('HQ')}
                                        className="w-full flex items-center justify-between p-2 hover:bg-amber-50 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Briefcase size={14} className="text-amber-600" />
                                            <span className="text-xs font-semibold text-gray-700">Handlungsspezifisch</span>
                                            <span className="text-xs text-gray-400">({groupedPapers.HQ.length})</span>
                                        </div>
                                        {expandedGroups.HQ ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </button>
                                    {expandedGroups.HQ && groupedPapers.HQ.map(paper => renderPaperButton(paper))}
                                </div>
                            )}

                            {/* Unbekannt Group */}
                            {groupedPapers.Unbekannt.length > 0 && (
                                <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                                    <button
                                        onClick={() => toggleGroup('Unbekannt')}
                                        className="w-full flex items-center justify-between p-2 hover:bg-gray-100 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <FileText size={14} className="text-gray-500" />
                                            <span className="text-xs font-semibold text-gray-700">Nicht klassifiziert</span>
                                            <span className="text-xs text-gray-400">({groupedPapers.Unbekannt.length})</span>
                                        </div>
                                        {expandedGroups.Unbekannt ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </button>
                                    {expandedGroups.Unbekannt && groupedPapers.Unbekannt.map(paper => renderPaperButton(paper))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Flat View (default) */}
                    {!groupByQualification && filteredPapers.map(paper => renderPaperButton(paper))}
                </div>

                <div className="p-4 border-t border-gray-100 text-center">
                    <p className="text-xs text-gray-300">v2.0 • Enterprise Edition</p>
                </div>
            </div>
        </>
    );
};

export default Sidebar;
