import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Bot, Loader2, RefreshCw, GraduationCap, ArrowLeft, MessageSquare, AlertCircle } from 'lucide-react';
import { ChatMessage, chatFachgespraech, listAvailableTopics } from '../lib/api';

const FachgespraechBot: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [topics, setTopics] = useState<string[]>([]);
    const [selectedTopic, setSelectedTopic] = useState<string>('');
    const [isStarted, setIsStarted] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadTopics();
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const loadTopics = async () => {
        try {
            const fetchedTopics = await listAvailableTopics();
            setTopics(fetchedTopics);
            if (fetchedTopics.length > 0) {
                setSelectedTopic(fetchedTopics[0]);
            }
        } catch (e) {
            console.error('Failed to load topics:', e);
        }
    };

    const handleStart = async () => {
        if (!selectedTopic) return;

        setIsStarted(true);
        setIsLoading(true);

        const initialMessage: ChatMessage = {
            role: 'assistant',
            content: `Guten Tag. Ich bin Ihr Prüfer für das heutige Fachgespräch zum Thema "${selectedTopic}". Bitte stellen Sie sich kurz vor oder erklären Sie mir Ihre Herangehensweise an eine technische Problemstellung in diesem Bereich.`
        };

        setMessages([initialMessage]);
        setIsLoading(false);
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg: ChatMessage = { role: 'user', content: input };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setInput('');
        setIsLoading(true);

        try {
            const assistantResponse = await chatFachgespraech(newMessages, selectedTopic);
            setMessages([...newMessages, { role: 'assistant', content: assistantResponse }]);
        } catch (e) {
            console.error('Chat failed:', e);
            setMessages([...newMessages, {
                role: 'assistant',
                content: 'Entschuldigung, es gab ein technisches Problem. Könnten Sie das bitte noch einmal sagen?'
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleReset = () => {
        setMessages([]);
        setIsStarted(false);
        setInput('');
    };

    if (!isStarted) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-6 animate-fade-in">
                <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-gray-100 p-8 text-center">
                    <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <GraduationCap size={40} />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Fachgespräch Simulator</h1>
                    <p className="text-gray-500 mb-8">
                        Bereiten Sie sich auf Ihren mündlichen Prüfungsteil vor. Die KI simuliert den Prüfungsausschuss und stellt vertiefende Fragen.
                    </p>

                    <div className="space-y-4 text-left mb-8">
                        <label className="block text-sm font-semibold text-gray-700 ml-1">Themenbereich wählen</label>
                        <select
                            value={selectedTopic}
                            onChange={(e) => setSelectedTopic(e.target.value)}
                            className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none cursor-pointer"
                        >
                            {topics.map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                            {topics.length === 0 && <option value="">Keine Themen verfügbar</option>}
                        </select>
                    </div>

                    <button
                        onClick={handleStart}
                        disabled={!selectedTopic}
                        className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                    >
                        Simulation starten
                    </button>

                    <div className="mt-6 flex items-start gap-3 p-4 bg-amber-50 rounded-xl text-left border border-amber-100">
                        <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700">
                            <strong>Hinweis:</strong> Der Prüfer wird versuchen, Ihre Entscheidungen zu hinterfragen. Argumentieren Sie technisch fundiert (z.B. nach VDE).
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="p-4 md:p-6 border-b border-gray-100 bg-white flex items-center justify-between z-10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleReset}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h2 className="font-bold text-gray-900 flex items-center gap-2">
                            <MessageSquare size={18} className="text-indigo-600" />
                            Simulation: Fachgespräch
                        </h2>
                        <p className="text-xs text-gray-500">Thema: {selectedTopic}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-600 rounded-full text-xs font-bold ring-1 ring-green-100">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        Prüfer Aktiv
                    </span>
                    <button
                        onClick={handleReset}
                        className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-all"
                        title="Simulation beenden"
                    >
                        <RefreshCw size={18} />
                    </button>
                </div>
            </div>

            {/* Chat Messages */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar bg-gray-50/30"
            >
                {messages.map((msg, i) => (
                    <div
                        key={i}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}
                    >
                        <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center shadow-sm ${msg.role === 'user'
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-white border border-gray-200 text-gray-600'
                                }`}>
                                {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
                            </div>
                            <div className={`p-4 rounded-2xl shadow-sm ${msg.role === 'user'
                                    ? 'bg-indigo-600 text-white rounded-tr-none'
                                    : 'bg-white border border-gray-100 text-gray-800 rounded-tl-none'
                                }`}>
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                            </div>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start animate-slide-up">
                        <div className="flex gap-3">
                            <div className="shrink-0 w-9 h-9 rounded-xl bg-white border border-gray-200 text-gray-600 flex items-center justify-center">
                                <Bot size={18} />
                            </div>
                            <div className="p-4 bg-white border border-gray-100 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                                <Loader2 size={16} className="animate-spin text-indigo-600" />
                                <span className="text-xs text-gray-400 font-medium italic">Prüfer überlegt...</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="p-4 md:p-6 bg-white border-t border-gray-100">
                <div className="relative flex items-end gap-3 max-w-4xl mx-auto">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder="Ihre Antwort eingeben..."
                        className="flex-1 p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none min-h-[56px] max-h-32 text-sm"
                        rows={1}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="shrink-0 w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 transition-all shadow-lg active:scale-90 disabled:opacity-50"
                    >
                        <Send size={18} />
                    </button>
                </div>
                <p className="text-[10px] text-center text-gray-400 mt-4">
                    Verwenden Sie technische Begriffe und begründen Sie Ihre Aussagen für ein besseres Ergebnis.
                </p>
            </div>
        </div>
    );
};

export default FachgespraechBot;
