"use client";

import React from 'react';
import { Specialization } from '../types';
import { Settings as SettingsIcon, GraduationCap, Briefcase, Info, Check } from 'lucide-react';

interface SettingsProps {
    specialization: Specialization;
    onSpecializationChange: (spec: Specialization) => void;
}

const Settings: React.FC<SettingsProps> = ({ specialization, onSpecializationChange }) => {
    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-6 md:p-10 pb-20 animate-fade-in">
            <div className="mb-16">
                <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 tracking-tight mb-2">
                    Profil & Einstellungen
                </h1>
                <p className="text-sm text-gray-500">Personalisieren Sie Ihren Lernplan nach Ihrem gewählten Schwerpunkt.</p>
            </div>

            <div className="max-w-3xl space-y-16">
                {/* Specialization Section */}
                <section>
                    <div className="mb-6">
                        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-widest mb-2">
                            Qualifikationsschwerpunkt (HQ)
                        </h2>
                        <p className="text-sm text-gray-500 max-w-xl">
                            Wählen Sie Ihre Fachrichtung für den Prüfungsteil "Handlungsspezifische Qualifikationen". Dies filtert Lernleitfäden und Übungen.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <button
                            onClick={() => onSpecializationChange('Infrastruktursysteme und Betriebstechnik')}
                            className={`p-6 text-left transition-all border-l-4 ${specialization === 'Infrastruktursysteme und Betriebstechnik'
                                ? 'border-indigo-600 bg-gray-50/50'
                                : 'border-transparent hover:border-gray-200 hover:bg-gray-50/30'
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
                            className={`p-6 text-left transition-all border-l-4 ${specialization === 'Automatisierungs- und Informationstechnik'
                                ? 'border-indigo-600 bg-gray-50/50'
                                : 'border-transparent hover:border-gray-200 hover:bg-gray-50/30'
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
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">ExamPilot AI</h2>
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
