"use client";

import React, { useState, useEffect } from 'react';
import { Sparkles, Loader2, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { TranslationKey } from '../lib/translations';

interface SmartLoadingOverlayProps {
    titleKey: TranslationKey;
    steps: TranslationKey[];
    isProcessing: boolean;
}

const SmartLoadingOverlay: React.FC<SmartLoadingOverlayProps> = ({ titleKey, steps, isProcessing }) => {
    const { t } = useLanguage();
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (!isProcessing) {
            setCurrentStepIndex(0);
            setProgress(0);
            return;
        }

        // Cycle through steps
        const stepInterval = setInterval(() => {
            setCurrentStepIndex((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
        }, 3500);

        // Smooth progress bar
        const progressInterval = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 95) return prev; // Hold at 95% until complete
                return prev + 0.5;
            });
        }, 100);

        return () => {
            clearInterval(stepInterval);
            clearInterval(progressInterval);
        };
    }, [isProcessing, steps.length]);

    if (!isProcessing) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-fade-in no-print">
            {/* Backdrop with heavy blur */}
            <div className="absolute inset-0 bg-white/70 backdrop-blur-xl transition-all duration-700"></div>

            {/* Floating Card */}
            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-gray-100 p-8 overflow-hidden group">
                {/* Decorative background element */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-100 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/2 group-hover:bg-indigo-100 transition-colors duration-1000"></div>
                
                <div className="relative z-10 flex flex-col items-center text-center">
                    {/* Pulsing AI Icon */}
                    <div className="relative mb-8">
                        <div className="absolute inset-0 bg-purple-600 rounded-full blur-xl opacity-20 animate-pulse"></div>
                        <div className="relative w-20 h-20 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-full flex items-center justify-center shadow-lg transform transition-transform group-hover:scale-105 duration-500">
                            <Sparkles className="text-white animate-pulse" size={40} />
                        </div>
                        {/* Orbiting dots */}
                        <div className="absolute inset-0 animate-spin-slow">
                            <div className="absolute top-0 left-1/2 w-2 h-2 bg-purple-400 rounded-full -translate-x-1/2"></div>
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 mb-2">
                        {t(titleKey)}
                    </h2>
                    <p className="text-gray-400 text-sm font-medium tracking-wide uppercase mb-8">
                        {t('processingAI')}
                    </p>

                    {/* Progress Bar Container */}
                    <div className="w-full h-2 bg-gray-100 rounded-full mb-10 overflow-hidden relative">
                        <div 
                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-500 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>

                    {/* Steps List */}
                    <div className="w-full space-y-4">
                        {steps.map((step, idx) => {
                            const isCompleted = idx < currentStepIndex;
                            const isActive = idx === currentStepIndex;

                            return (
                                <div 
                                    key={idx}
                                    className={`flex items-center gap-4 transition-all duration-500 ${
                                        isActive ? 'opacity-100 translate-x-1' : isCompleted ? 'opacity-50' : 'opacity-20 grayscale'
                                    }`}
                                >
                                    <div className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                                        isCompleted ? 'bg-green-100 text-green-600' : isActive ? 'bg-purple-100 text-purple-600' : 'bg-gray-100'
                                    }`}>
                                        {isCompleted ? (
                                            <CheckCircle2 size={12} />
                                        ) : isActive ? (
                                            <Loader2 size={12} className="animate-spin" />
                                        ) : (
                                            <div className="w-1.5 h-1.5 bg-gray-300 rounded-full"></div>
                                        )}
                                    </div>
                                    <span className={`text-sm font-medium text-left ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                                        {t(step)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Bottom Shine */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-purple-500/20 to-transparent"></div>
            </div>
        </div>
    );
};

export default SmartLoadingOverlay;
