import React, { useState, useEffect } from 'react';
import { StudyGuide, listAvailableTopics, listStudyGuides, generateStudyGuide, getStudyGuide } from '../lib/api';
import { BookOpen, Sparkles, ChevronRight, FileText, AlertCircle, Loader2, ArrowLeft, Bookmark, Zap, CheckCircle2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const StudyGuides: React.FC = () => {
    const [view, setView] = useState<'list' | 'detail'>('list');
    const [topics, setTopics] = useState<string[]>([]);
    const [guides, setGuides] = useState<Partial<StudyGuide>[]>([]);
    const [selectedGuide, setSelectedGuide] = useState<StudyGuide | null>(null);
    const [loading, setLoading] = useState(false);
    const [generatingTopic, setGeneratingTopic] = useState<string | null>(null);

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

    if (view === 'detail' && selectedGuide) {
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
                        <div className="flex items-center gap-2 text-indigo-200 text-sm font-medium mb-2 uppercase tracking-wide">
                            <BookOpen size={16} />
                            Lernleitfaden
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
                                    Formeln & Regeln
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
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Lernleitfäden</h1>
                <p className="text-gray-500 mt-2">KI-generierte Spickzettel und Zusammenfassungen zu bestimmten Themen.</p>
            </div>

            {/* Existing Guides */}
            {guides.length > 0 && (
                <div className="mb-10">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <Bookmark size={18} className="text-indigo-600" />
                        Ihre Bibliothek
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {guides.map((guide) => (
                            <div
                                key={guide.id}
                                onClick={() => guide.id && handleViewGuide(guide.id)}
                                className="bg-white p-6 rounded-xl border border-gray-200 hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer group"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                        <FileText size={20} />
                                    </div>
                                    <span className="text-xs text-gray-400 font-medium">
                                        {new Date(guide.created_at || '').toLocaleDateString('de-DE')}
                                    </span>
                                </div>
                                <h3 className="font-bold text-gray-900 mb-1 group-hover:text-indigo-600 transition-colors">
                                    {guide.topic}
                                </h3>
                                <p className="text-sm text-gray-500">{guide.subject}</p>
                            </div>
                        ))}
                    </div>
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
