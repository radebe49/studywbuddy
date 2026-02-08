import React from 'react';
import { Specialization } from '../types';
import { Settings as SettingsIcon, GraduationCap, Briefcase, Info, Check } from 'lucide-react';

interface SettingsProps {
    specialization: Specialization;
    onSpecializationChange: (spec: Specialization) => void;
}

const Settings: React.FC<SettingsProps> = ({ specialization, onSpecializationChange }) => {
    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-6 pb-20 animate-fade-in">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                    <SettingsIcon className="text-gray-400" />
                    Profil & Einstellungen
                </h1>
                <p className="text-gray-500 mt-2">Personalisieren Sie Ihren Lernplan nach Ihrem gewählten Schwerpunkt.</p>
            </div>

            <div className="max-w-4xl space-y-8">
                {/* Specialization Section */}
                <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <GraduationCap className="text-indigo-600" />
                            Qualifikationsschwerpunkt (HQ)
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Wählen Sie Ihre Fachrichtung für den Prüfungsteil "Handlungsspezifische Qualifikationen".
                            Dies filtert Lernleitfäden und Übungen.
                        </p>
                    </div>

                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button
                            onClick={() => onSpecializationChange('Infrastruktursysteme und Betriebstechnik')}
                            className={`p-5 rounded-xl border-2 text-left transition-all ${specialization === 'Infrastruktursysteme und Betriebstechnik'
                                    ? 'border-indigo-600 bg-indigo-50 shadow-md ring-1 ring-indigo-100'
                                    : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
                                }`}
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className={`p-2 rounded-lg ${specialization === 'Infrastruktursysteme und Betriebstechnik'
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-gray-100 text-gray-400'
                                    }`}>
                                    <Briefcase size={20} />
                                </div>
                                {specialization === 'Infrastruktursysteme und Betriebstechnik' && (
                                    <div className="bg-indigo-600 text-white rounded-full p-1">
                                        <Check size={12} />
                                    </div>
                                )}
                            </div>
                            <h3 className="font-bold text-gray-900 mb-1">Infrastruktursysteme und Betriebstechnik</h3>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                Fokus auf Energieversorgung, Betriebstechnik und Anlagensysteme.
                                (Standard für IHK Ostbrandenburg)
                            </p>
                        </button>

                        <button
                            onClick={() => onSpecializationChange('Automatisierungs- und Informationstechnik')}
                            className={`p-5 rounded-xl border-2 text-left transition-all ${specialization === 'Automatisierungs- und Informationstechnik'
                                    ? 'border-indigo-600 bg-indigo-50 shadow-md ring-1 ring-indigo-100'
                                    : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
                                }`}
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className={`p-2 rounded-lg ${specialization === 'Automatisierungs- und Informationstechnik'
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-gray-100 text-gray-400'
                                    }`}>
                                    <GraduationCap size={20} />
                                </div>
                                {specialization === 'Automatisierungs- und Informationstechnik' && (
                                    <div className="bg-indigo-600 text-white rounded-full p-1">
                                        <Check size={12} />
                                    </div>
                                )}
                            </div>
                            <h3 className="font-bold text-gray-900 mb-1">Automatisierungs- und Informationstechnik</h3>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                Fokus auf Steuerungstechnik, Robotik und vernetzte IT-Systeme in der Produktion.
                            </p>
                        </button>
                    </div>

                    <div className="p-4 bg-amber-50 mx-6 mb-6 rounded-xl border border-amber-100 flex gap-4">
                        <Info className="text-amber-500 shrink-0 mt-0.5" size={18} />
                        <div className="text-xs text-amber-800 leading-relaxed">
                            <span className="font-bold">Hinweis:</span> Die IHK Ostbrandenburg prüft aktuell
                            <span className="font-bold"> überwiegend den Qualifikationsschwerpunkt Infrastruktursysteme und Betriebstechnik</span>.
                            Stellen Sie sicher, dass Ihre Wahl mit Ihrer Prüfungsanmeldung übereinstimmt.
                        </div>
                    </div>
                </section>

                {/* About Section */}
                <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
                    <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                        <GraduationCap size={40} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">ExamPilot AI v2.0</h2>
                    <p className="text-gray-500 mb-8 max-w-md mx-auto">
                        Optimiert für den Bachelor Professional (Industriemeister) Elektrotechnik IHK.
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                        <span className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">DQR Level 6</span>
                        <span className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">IHK Rahmenplan 2024</span>
                        <span className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">Batch-Processing Ready</span>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default Settings;
