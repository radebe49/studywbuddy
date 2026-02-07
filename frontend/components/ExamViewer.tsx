import React from 'react';
import { ExamPaper, QuestionAnalysis } from '../types';
import { BookOpen, CheckCircle, BrainCircuit, BarChart3, Clock, ChevronLeft, Download, Printer } from 'lucide-react';

interface ExamViewerProps {
    paper: ExamPaper;
    onClose: () => void;
}

const ExamViewer: React.FC<ExamViewerProps> = ({ paper, onClose }) => {
    if (!paper.solution) return null;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-2xl shadow-xl overflow-hidden animate-fade-in border border-gray-100">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white flex flex-col md:flex-row justify-between md:items-start shrink-0 gap-4">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 opacity-90 flex-wrap">
                        <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2 py-1 rounded">
                            {paper.solution.year || 'Unknown Year'}
                        </span>
                        <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded ${paper.solution.difficulty === 'Hard' ? 'bg-red-500/50' :
                            paper.solution.difficulty === 'Medium' ? 'bg-yellow-500/50' : 'bg-green-500/50'
                            }`}>
                            {paper.solution.difficulty}
                        </span>
                    </div>
                    <h2 className="text-2xl font-bold leading-tight">{paper.name}</h2>
                    <p className="text-indigo-100 text-sm mt-1 max-w-xl">{paper.solution.summary}</p>
                </div>

                <div className="flex items-center gap-2 self-start md:self-auto">
                    <button
                        onClick={handlePrint}
                        className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 no-print"
                    >
                        <Download size={16} />
                        Export PDF
                    </button>

                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 no-print"
                    >
                        <ChevronLeft size={16} />
                        Back
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto bg-gray-50 p-4 md:p-6 custom-scrollbar">
                <div className="max-w-4xl mx-auto space-y-6">

                    {/* Topics Badge Cloud */}
                    <div className="flex flex-wrap gap-2 mb-6">
                        {paper.solution?.topics?.map((topic, idx) => (
                            <span key={idx} className="px-3 py-1 bg-white border border-indigo-100 text-indigo-700 rounded-full text-sm font-medium shadow-sm flex items-center gap-1">
                                <BrainCircuit size={14} />
                                {topic}
                            </span>
                        ))}
                    </div>

                    {/* Questions */}
                    <div className="space-y-6 pb-20 md:pb-0">
                        {paper.solution?.questions?.map((q, idx) => (
                            <QuestionCard key={idx} question={q} index={idx} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const QuestionCard: React.FC<{ question: QuestionAnalysis; index: number }> = ({ question, index }) => {
    const [showExplanation, setShowExplanation] = React.useState(false);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all hover:shadow-md break-inside-avoid">
            <div className="p-4 md:p-5 border-b border-gray-100">
                <div className="flex justify-between items-start mb-3">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 font-bold text-sm shrink-0">
                        {question.questionNumber}
                    </span>
                    <span className="text-xs text-gray-400 font-medium px-2 py-1 bg-gray-50 rounded-full ml-2 text-right">
                        {question.topic}
                    </span>
                </div>
                <p className="text-gray-800 font-medium text-lg leading-relaxed">
                    {question.questionText}
                </p>
            </div>

            <div className="bg-gray-50/50 p-4 md:p-5">
                <div className="mb-4">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                        <CheckCircle size={14} className="text-green-500" />
                        Solution
                    </h4>
                    <div className="text-gray-900 font-mono text-sm bg-white p-3 rounded border border-gray-200 overflow-x-auto">
                        {question.solution}
                    </div>
                </div>

                <button
                    onClick={() => setShowExplanation(!showExplanation)}
                    className="text-indigo-600 text-sm font-medium flex items-center gap-1 hover:text-indigo-800 transition-colors no-print"
                >
                    <BookOpen size={16} />
                    {showExplanation ? 'Hide Explanation' : 'View Explanation'}
                </button>

                {/* Always show explanation when printing */}
                <div className={`mt-3 p-4 bg-blue-50 text-blue-900 rounded-lg text-sm leading-relaxed border border-blue-100 ${!showExplanation ? 'hidden print:block' : ''}`}>
                    <span className="font-semibold block mb-1">Why?</span>
                    {question.explanation}
                </div>
            </div>
        </div>
    );
};

export default ExamViewer;
