"use client";

import React from 'react';
import { Specialization } from '../types';
import { Settings as SettingsIcon, GraduationCap, Briefcase, Info, Check, Globe, Sparkles } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface SettingsProps {
    specialization: Specialization;
    onSpecializationChange: (spec: Specialization) => void;
}

const Settings: React.FC<SettingsProps> = ({ specialization, onSpecializationChange }) => {
    const { language, setLanguage, t } = useLanguage();

    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-6 md:p-10 pb-20 animate-fade-in">
            <div className="mb-16">
                <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 tracking-tight mb-2">
                    {t('settings')}
                </h1>
                <p className="text-sm text-gray-500">{t('readyToStudy')}</p>
            </div>

            <div className="max-w-3xl space-y-16">
                {/* Language Section */}
                <section>
                    <div className="mb-6 flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                            <Globe size={18} />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-widest">
                                {t('language')}
                            </h2>
                        </div>
                    </div>

                    <div className="flex gap-4 p-1 bg-gray-100/50 rounded-xl w-fit">
                        <button
                            onClick={() => setLanguage('de')}
                            className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${language === 'de' 
                                ? 'bg-white text-indigo-600 shadow-sm' 
                                : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            {t('german')}
                        </button>
                        <button
                            onClick={() => setLanguage('en')}
                            className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${language === 'en' 
                                ? 'bg-white text-indigo-600 shadow-sm' 
                                : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            {t('english')}
                        </button>
                    </div>
                </section>

                {/* Specialization Section */}
                <section>
                    <div className="mb-6 flex items-center gap-3">
                        <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                            <GraduationCap size={18} />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-widest">
                                {t('specialization')} (HQ)
                            </h2>
                        </div>
                    </div>
                    
                    <p className="text-sm text-gray-500 max-w-xl mb-6">
                        Wählen Sie Ihre Fachrichtung für den Prüfungsteil "Handlungsspezifische Qualifikationen". Dies filtert Lernleitfäden und Übungen.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <button
                            onClick={() => onSpecializationChange('Infrastruktursysteme und Betriebstechnik')}
                            className={`p-6 text-left transition-all border-l-4 rounded-r-xl ${specialization === 'Infrastruktursysteme und Betriebstechnik'
                                ? 'border-indigo-600 bg-indigo-50/30'
                                : 'border-transparent bg-white hover:border-gray-200 hover:bg-gray-50/30 ring-1 ring-gray-100'
                                }`}
                        >
                            <h3 className={`font-semibold mb-2 ${specialization === 'Infrastruktursysteme und Betriebstechnik' ? 'text-indigo-600' : 'text-gray-900'}`}>
                                Infrastruktursysteme und Betriebstechnik
                            </h3>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                Fokus auf Energieversorgung, Betriebstechnik und Anlagensysteme. (Standard für IHK Ostbrandenburg)
                            </p>
                        </button>

                        <button
                            onClick={() => onSpecializationChange('Automatisierungs- und Informationstechnik')}
                            className={`p-6 text-left transition-all border-l-4 rounded-r-xl ${specialization === 'Automatisierungs- und Informationstechnik'
                                ? 'border-indigo-600 bg-indigo-50/30'
                                : 'border-transparent bg-white hover:border-gray-200 hover:bg-gray-50/30 ring-1 ring-gray-100'
                                }`}
                        >
                            <h3 className={`font-semibold mb-2 ${specialization === 'Automatisierungs- und Informationstechnik' ? 'text-indigo-600' : 'text-gray-900'}`}>
                                Automatisierungs- und Informationstechnik
                            </h3>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                Fokus auf Steuerungstechnik, Robotik und vernetzte IT-Systeme in der Produktion.
                            </p>
                        </button>
                    </div>

                    <div className="mt-8 pt-6 border-t border-gray-100 flex gap-4 max-w-2xl">
                        <Info className="text-gray-400 shrink-0 mt-0.5" size={16} />
                        <div className="text-xs text-gray-500 leading-relaxed">
                            <span className="font-semibold text-gray-900">Hinweis zur Wahl:</span> Die IHK Ostbrandenburg prüft aktuell überwiegend den Qualifikationsschwerpunkt <span className="font-medium text-gray-700">Infrastruktursysteme und Betriebstechnik</span>. Stellen Sie sicher, dass Ihre Auswahl mit der Prüfungsanmeldung übereinstimmt.
                        </div>
                    </div>
                </section>

                {/* About Section */}
                <section className="pt-16 border-t border-dashed border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                        <h2 className="text-lg font-semibold text-gray-900">ExamPilot AI</h2>
                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold">PRO</span>
                    </div>
                    <p className="text-sm text-gray-500 mb-6 max-w-md">
                        Optimiert für den Bachelor Professional (Industriemeister) Elektrotechnik IHK.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <span className="px-3 py-1 bg-gray-100/50 text-gray-500 rounded text-[10px] font-medium tracking-widest uppercase">DQR Level 6</span>
                        <span className="px-3 py-1 bg-gray-100/50 text-gray-500 rounded text-[10px] font-medium tracking-widest uppercase">IHK Rahmenplan 2024</span>
                        <span className="px-3 py-1 bg-gray-100/50 text-gray-500 rounded text-[10px] font-medium tracking-widest uppercase">Version 2.0 Pro Max</span>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default Settings;
