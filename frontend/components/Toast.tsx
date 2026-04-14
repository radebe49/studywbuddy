"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, Info, Loader2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Helper for Tailwind classes
function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type ToastType = 'success' | 'error' | 'info' | 'loading';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const toast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { id, message, type }]);

        if (type !== 'loading') {
            setTimeout(() => {
                removeToast(id);
            }, 4000);
        }
    }, [removeToast]);

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}
            <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none w-full max-w-sm">
                {toasts.map((t) => (
                    <div
                        key={t.id}
                        className={cn(
                            "pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl shadow-lg border animate-slide-up transition-all",
                            t.type === 'success' && "bg-emerald-50 border-emerald-100 text-emerald-800",
                            t.type === 'error' && "bg-rose-50 border-rose-100 text-rose-800",
                            t.type === 'info' && "bg-indigo-50 border-indigo-100 text-indigo-800",
                            t.type === 'loading' && "bg-white border-gray-100 text-gray-800"
                        )}
                    >
                        <div className="flex items-center gap-3">
                            {t.type === 'success' && <CheckCircle size={18} className="text-emerald-500" />}
                            {t.type === 'error' && <AlertCircle size={18} className="text-rose-500" />}
                            {t.type === 'info' && <Info size={18} className="text-indigo-500" />}
                            {t.type === 'loading' && <Loader2 size={18} className="animate-spin text-gray-400" />}
                            <span className="text-sm font-medium">{t.message}</span>
                        </div>
                        <button
                            onClick={() => removeToast(t.id)}
                            className="p-1 hover:bg-black/5 rounded-full transition-colors"
                        >
                            <X size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
