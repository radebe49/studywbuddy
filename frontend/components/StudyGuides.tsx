import React, { useState, useEffect } from 'react';
import { StudyGuide, listAvailableTopics, listStudyGuides, generateStudyGuide, getStudyGuide, IHK_TAXONOMY } from '../lib/api';
import { Specialization } from '../types';
import { BookOpen, Sparkles, ChevronRight, ChevronDown, FileText, AlertCircle, Loader2, ArrowLeft, Bookmark, Zap, CheckCircle2, GraduationCap, Briefcase } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// Helper to categorize a topic/subject into the IHK taxonomy
const categorizeSubject = (subject: string): { area: 'BQ' | 'HQ' | 'Sonstige'; handlungsbereich?: string } => {
    const subjectLower = subject.toLowerCase();

    // Check BQ subjects
    for (const bqSubject of IHK_TAXONOMY.BQ.subjects) {
        if (subjectLower.includes(bqSubject.toLowerCase().slice(0, 10)) ||
            bqSubject.toLowerCase().includes(subjectLower.slice(0, 10))) {
            return { area: 'BQ' };
        }
    }

    // Check HQ subjects by Handlungsbereich
    for (const [hb, subjects] of Object.entries(IHK_TAXONOMY.HQ.handlungsbereiche)) {
        for (const hqSubject of subjects) {
            if (subjectLower.includes(hqSubject.toLowerCase().slice(0, 10)) ||
                hqSubject.toLowerCase().includes(subjectLower.slice(0, 10))) {
                return { area: 'HQ', handlungsbereich: hb };
            }
        }
    }

    // Fallback heuristics
    if (subjectLower.includes('ntg') || subjectLower.includes('naturwissenschaft') ||
        subjectLower.includes('physik') || subjectLower.includes('mathematik') ||
        subjectLower.includes('recht') || subjectLower.includes('bwl') ||
        subjectLower.includes('betriebswirt')) {
        return { area: 'BQ' };
    }

    if (subjectLower.includes('technik') || subjectLower.includes('automatisierung') ||
        subjectLower.includes('infrastruktur') || subjectLower.includes('elektro')) {
        return { area: 'HQ', handlungsbereich: 'Technik' };
    }

    if (subjectLower.includes('personal') || subjectLower.includes('führung') ||
        subjectLower.includes('qualität')) {
        return { area: 'HQ', handlungsbereich: 'Führung und Personal' };
    }

    if (subjectLower.includes('kosten') || subjectLower.includes('planung') ||
        subjectLower.includes('organisation') || subjectLower.includes('umwelt')) {
        return { area: 'HQ', handlungsbereich: 'Organisation' };
    }

    return { area: 'Sonstige' };
};

interface GroupedGuides {
    BQ: Partial<StudyGuide>[];
    HQ: {
        'Technik': Partial<StudyGuide>[];
        'Organisation': Partial<StudyGuide>[];
        'Führung und Personal': Partial<StudyGuide>[];
    };
    Sonstige: Partial<StudyGuide>[];
}

interface StudyGuidesProps {
    specialization: Specialization;
}

const StudyGuides: React.FC<StudyGuidesProps> = ({ specialization }) => {
    const [view, setView] = useState<'list' | 'detail'>('list');
    const [topics, setTopics] = useState<string[]>([]);
    const [guides, setGuides] = useState<Partial<StudyGuide>[]>([]);
    const [selectedGuide, setSelectedGuide] = useState<StudyGuide | null>(null);
    const [loading, setLoading] = useState(false);
    const [generatingTopic, setGeneratingTopic] = useState<string | null>(null);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        BQ: true,
        HQ: true,
        'HQ-Technik': true,
        'HQ-Organisation': true,
        'HQ-Führung und Personal': true,
        Sonstige: false
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [fetchedTopics, fetchedGuides] = await Promise.all([
                listAvailableTopics(),
                listStudyGuides()
            ]);
            setTopics(fetchedTopics);
            setGuides(fetchedGuides);
        } catch (e) {
            console.error('Failed to load study guide data:', e);
        }
    };

    const handleGenerate = async (topic: string) => {
        setGeneratingTopic(topic);
        try {
            const newGuide = await generateStudyGuide(topic);
            setGuides(prev => [newGuide, ...prev]);
            setSelectedGuide(newGuide);
            setView('detail');
        } catch (e) {
            console.error('Failed to generate guide:', e);
            alert('Fehler beim Erstellen des Lernleitfadens. Bitte versuchen Sie es erneut.');
        } finally {
            setGeneratingTopic(null);
        }
    };

    const handleViewGuide = async (id: string) => {
        setLoading(true);
        try {
            const guide = await getStudyGuide(id);
            setSelectedGuide(guide);
            setView('detail');
        } catch (e) {
            console.error('Failed to load guide:', e);
        } finally {
            setLoading(false);
        }
    };

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    // Group guides by qualification area
    const groupedGuides: GroupedGuides = {
        BQ: [],
        HQ: {
            'Technik': [],
            'Organisation': [],
            'Führung und Personal': []
        },
        Sonstige: []
    };

    guides.forEach(guide => {
        const category = categorizeSubject(guide.subject || guide.topic || '');

        // Phase 2 Filtering Logic
        if (category.area === 'HQ' && category.handlungsbereich === 'Technik') {
            const guideSubject = (guide.subject || '').toLowerCase();
            const infraSpec = 'Infrastruktursysteme und Betriebstechnik'.toLowerCase();
            const autoSpec = 'Automatisierungs- und Informationstechnik'.toLowerCase();

            // Filter out non-matching specialized guides if a specialization is selected
            if (specialization === 'Infrastruktursysteme und Betriebstechnik' && guideSubject.includes('automatisierung')) {
                return; // Skip this guide
            }
            if (specialization === 'Automatisierungs- und Informationstechnik' && guideSubject.includes('infrastruktur')) {
                return; // Skip this guide
            }
        }

        if (category.area === 'BQ') {
            groupedGuides.BQ.push(guide);
        } else if (category.area === 'HQ' && category.handlungsbereich) {
            groupedGuides.HQ[category.handlungsbereich as keyof typeof groupedGuides.HQ].push(guide);
        } else {
            groupedGuides.Sonstige.push(guide);
        }
    });

    const renderGuideCard = (guide: Partial<StudyGuide>) => (
        <div
            key={guide.id}
            onClick={() => guide.id && handleViewGuide(guide.id)}
            className="bg-white p-4 rounded-xl border border-gray-200 hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer group"
        >
            <div className="flex justify-between items-start mb-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <FileText size={18} />
                </div>
                <span className="text-xs text-gray-400 font-medium">
                    {new Date(guide.created_at || '').toLocaleDateString('de-DE')}
                </span>
            </div>
            <h3 className="font-bold text-gray-900 mb-1 group-hover:text-indigo-600 transition-colors text-sm">
                {guide.topic}
            </h3>
            <p className="text-xs text-gray-500">{guide.subject}</p>
        </div>
    );

    if (view === 'detail' && selectedGuide) {
        const guideCategory = categorizeSubject(selectedGuide.subject || selectedGuide.topic);

        return (
            <div className="h-full overflow-y-auto custom-scrollbar p-6 pb-20 animate-fade-in">
                <button
                    onClick={() => setView('list')}
                    className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-6 transition-colors"
                >
                    <ArrowLeft size={18} /> Zurück zu Leitfäden
                </button>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-8 text-white">
                        <div className="flex items-center gap-3 mb-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${guideCategory.area === 'BQ'
                                ? 'bg-blue-500/30 text-blue-100'
                                : 'bg-amber-500/30 text-amber-100'
                                }`}>
                                {guideCategory.area === 'BQ' ? 'Basisqualifikation' : 'Handlungsspezifisch'}
                            </span>
                            {guideCategory.handlungsbereich && (
                                <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/20">
                                    {guideCategory.handlungsbereich}
                                </span>
                            )}
                        </div>
                        <h1 className="text-3xl font-bold">{selectedGuide.topic}</h1>
                        <p className="text-indigo-100 mt-2">{selectedGuide.subject}</p>
                    </div>

                    <div className="p-8 space-y-8">
                        {/* Summary Section */}
                        <section>
                            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <FileText className="text-indigo-600" />
                                Überblick
                            </h2>
                            <div className="prose prose-indigo max-w-none text-gray-600 bg-gray-50 p-6 rounded-xl border border-gray-100">
                                <ReactMarkdown>{selectedGuide.summary_markdown}</ReactMarkdown>
                            </div>
                        </section>

                        {/* Key Concepts */}
                        <section>
                            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <Zap className="text-amber-500" />
                                Wichtige Konzepte
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {selectedGuide.key_concepts.map((concept, i) => (
                                    <div key={i} className="flex gap-3 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                                        <div className="shrink-0 mt-1">
                                            <CheckCircle2 size={18} className="text-green-500" />
                                        </div>
                                        <p className="text-gray-700 font-medium">{concept}</p>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Formulas */}
                        {selectedGuide.formulas.length > 0 && (
                            <section>
                                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <span className="font-serif italic text-2xl text-indigo-600">f(x)</span>
                                    Formeln & Regeln (Formelsammlung)
                                </h2>
                                <div className="grid gap-4">
                                    {selectedGuide.formulas.map((f, i) => (
                                        <div key={i} className="p-5 bg-gray-900 text-white rounded-xl shadow-lg">
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="font-bold text-lg text-indigo-300">{f.name}</h3>
                                            </div>
                                            <div className="font-mono text-xl py-2 overflow-x-auto">
                                                {f.formula}
                                            </div>
                                            <p className="text-gray-400 text-sm mt-2">{f.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Common Mistakes */}
                        {selectedGuide.common_mistakes.length > 0 && (
                            <section>
                                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <AlertCircle className="text-red-500" />
                                    Häufige Fehler
                                </h2>
                                <div className="space-y-3">
                                    {selectedGuide.common_mistakes.map((m, i) => (
                                        <div key={i} className="p-4 bg-red-50 border border-red-100 rounded-lg flex gap-4">
                                            <div className="shrink-0 text-red-500 mt-1">
                                                <AlertCircle size={20} />
                                            </div>
                                            <div>
                                                <p className="font-medium text-red-800 mb-1">Fehler: {m.mistake}</p>
                                                <p className="text-red-600 text-sm">Korrektur: {m.correction}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-6 pb-20 animate-fade-in">
            <div className="mb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Lernleitfäden</h1>
                    <p className="text-gray-500 mt-2">KI-generierte Spickzettel und Zusammenfassungen nach IHK-Struktur.</p>
                </div>
                {specialization !== 'None' && (
                    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-lg text-xs font-medium text-indigo-700">
                        <CheckCircle2 size={14} />
                        Gefiltert nach: {specialization}
                    </div>
                )}
            </div>

            {/* Hierarchical Guide Library */}
            {guides.length > 0 && (
                <div className="mb-10 space-y-6">
                    <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <Bookmark size={18} className="text-indigo-600" />
                        Ihre Bibliothek
                    </h2>

                    {/* BQ Section */}
                    {groupedGuides.BQ.length > 0 && (
                        <div className="bg-blue-50/50 rounded-xl border border-blue-100 overflow-hidden">
                            <button
                                onClick={() => toggleSection('BQ')}
                                className="w-full flex items-center justify-between p-4 hover:bg-blue-50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                        <GraduationCap size={20} />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="font-bold text-gray-900">Basisqualifikationen (BQ)</h3>
                                        <p className="text-xs text-gray-500">{groupedGuides.BQ.length} Leitfäden</p>
                                    </div>
                                </div>
                                {expandedSections.BQ ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                            </button>
                            {expandedSections.BQ && (
                                <div className="p-4 pt-0 grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {groupedGuides.BQ.map(renderGuideCard)}
                                </div>
                            )}
                        </div>
                    )}

                    {/* HQ Section */}
                    {(groupedGuides.HQ.Technik.length > 0 ||
                        groupedGuides.HQ.Organisation.length > 0 ||
                        groupedGuides.HQ['Führung und Personal'].length > 0) && (
                            <div className="bg-amber-50/50 rounded-xl border border-amber-100 overflow-hidden">
                                <button
                                    onClick={() => toggleSection('HQ')}
                                    className="w-full flex items-center justify-between p-4 hover:bg-amber-50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                                            <Briefcase size={20} />
                                        </div>
                                        <div className="text-left">
                                            <h3 className="font-bold text-gray-900">Handlungsspezifische Qualifikationen (HQ)</h3>
                                            <p className="text-xs text-gray-500">
                                                {groupedGuides.HQ.Technik.length + groupedGuides.HQ.Organisation.length + groupedGuides.HQ['Führung und Personal'].length} Leitfäden
                                            </p>
                                        </div>
                                    </div>
                                    {expandedSections.HQ ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                </button>
                                {expandedSections.HQ && (
                                    <div className="p-4 pt-0 space-y-4">
                                        {/* Technik */}
                                        {groupedGuides.HQ.Technik.length > 0 && (
                                            <div>
                                                <button
                                                    onClick={() => toggleSection('HQ-Technik')}
                                                    className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3"
                                                >
                                                    {expandedSections['HQ-Technik'] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                    Handlungsbereich Technik ({groupedGuides.HQ.Technik.length})
                                                </button>
                                                {expandedSections['HQ-Technik'] && (
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 ml-6">
                                                        {groupedGuides.HQ.Technik.map(renderGuideCard)}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Organisation */}
                                        {groupedGuides.HQ.Organisation.length > 0 && (
                                            <div>
                                                <button
                                                    onClick={() => toggleSection('HQ-Organisation')}
                                                    className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3"
                                                >
                                                    {expandedSections['HQ-Organisation'] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                    Handlungsbereich Organisation ({groupedGuides.HQ.Organisation.length})
                                                </button>
                                                {expandedSections['HQ-Organisation'] && (
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 ml-6">
                                                        {groupedGuides.HQ.Organisation.map(renderGuideCard)}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Führung und Personal */}
                                        {groupedGuides.HQ['Führung und Personal'].length > 0 && (
                                            <div>
                                                <button
                                                    onClick={() => toggleSection('HQ-Führung und Personal')}
                                                    className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3"
                                                >
                                                    {expandedSections['HQ-Führung und Personal'] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                    Handlungsbereich Führung und Personal ({groupedGuides.HQ['Führung und Personal'].length})
                                                </button>
                                                {expandedSections['HQ-Führung und Personal'] && (
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 ml-6">
                                                        {groupedGuides.HQ['Führung und Personal'].map(renderGuideCard)}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                    {/* Sonstige Section */}
                    {groupedGuides.Sonstige.length > 0 && (
                        <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                            <button
                                onClick={() => toggleSection('Sonstige')}
                                className="w-full flex items-center justify-between p-4 hover:bg-gray-100 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-gray-200 text-gray-600 rounded-lg">
                                        <FileText size={20} />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="font-bold text-gray-900">Sonstige Themen</h3>
                                        <p className="text-xs text-gray-500">{groupedGuides.Sonstige.length} Leitfäden</p>
                                    </div>
                                </div>
                                {expandedSections.Sonstige ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                            </button>
                            {expandedSections.Sonstige && (
                                <div className="p-4 pt-0 grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {groupedGuides.Sonstige.map(renderGuideCard)}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Create New Guide */}
            <div>
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <Sparkles size={18} className="text-amber-500" />
                    Neuen Leitfaden erstellen
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {topics.filter(t => !guides.some(g => g.topic === t)).map((topic) => (
                        <div
                            key={topic}
                            className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 transition-all"
                        >
                            <span className="font-medium text-gray-700">{topic}</span>
                            <button
                                onClick={() => handleGenerate(topic)}
                                disabled={generatingTopic === topic}
                                className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-sm font-medium rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-colors flex items-center gap-2"
                            >
                                {generatingTopic === topic ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" />
                                        Erstellen...
                                    </>
                                ) : (
                                    <>
                                        Erstellen <ChevronRight size={14} />
                                    </>
                                )}
                            </button>
                        </div>
                    ))}
                    {topics.length === 0 && (
                        <div className="col-span-full p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-500">
                            Noch keine Themen gefunden. Laden Sie Prüfungsarbeiten hoch und analysieren Sie diese, um Themen zu erkennen.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StudyGuides;
