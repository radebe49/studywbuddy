'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import { useToast } from '../../components/Toast';
import { Mail, Lock, Loader2, Sparkles, ArrowRight } from 'lucide-react';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    // If already logged in, redirect to dashboard
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/');
      }
    };
    checkUser();
  }, [router]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          }
        });
        if (error) throw error;
        toast("Registrierung erfolgreich! Bitte prüfen Sie Ihre E-Mails.", "success");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/');
      }
    } catch (error: any) {
      toast(error.message || "Authentifizierung fehlgeschlagen", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background decoration - matching dashboard */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-200 rounded-full blur-3xl opacity-30 -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-200 rounded-full blur-3xl opacity-30 translate-y-1/3 -translate-x-1/4 pointer-events-none"></div>

      <div className="w-full max-w-md z-10 animate-fade-in">
        <div className="bg-white/60 backdrop-blur-xl rounded-2xl shadow-sm border border-gray-100 p-10 md:p-12">
          <div className="flex flex-col mb-10">
            <h2 className="text-[10px] tracking-widest text-gray-400 uppercase mb-4 flex items-center gap-2">
              <Sparkles size={14} className="text-purple-500" /> AUTHENTIFIZIERUNG
            </h2>
            <h1 className="text-4xl font-semibold text-gray-900 tracking-tight">
              {isSignUp ? 'Konto erstellen' : 'Willkommen'}
            </h1>
            <p className="text-gray-500 mt-3 text-sm leading-relaxed">
              {isSignUp 
                ? 'Beginnen Sie Ihre Reise mit präziser Prüfungsvorbereitung.' 
                : 'Melden Sie sich an, um auf Ihre Lernmaterialien zuzugreifen.'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] tracking-widest text-gray-400 uppercase ml-1 font-semibold">E-Mail Adresse</label>
              <div className="relative group">
                <Mail className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-gray-900 transition-colors w-4 h-4" />
                <input
                  type="email"
                  placeholder="name@beispiel.de"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-7 pr-0 py-3 bg-transparent border-b border-gray-200 focus:outline-none focus:border-gray-900 transition-all text-gray-900 placeholder:text-gray-300"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] tracking-widest text-gray-400 uppercase ml-1 font-semibold">Passwort</label>
              <div className="relative group">
                <Lock className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-gray-900 transition-colors w-4 h-4" />
                <input
                  type="password"
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-7 pr-0 py-3 bg-transparent border-b border-gray-200 focus:outline-none focus:border-gray-900 transition-all text-gray-900 placeholder:text-gray-300"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 text-white text-sm font-medium py-4 rounded-lg hover:bg-black active:scale-[0.98] transition-all disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center gap-2 mt-6 shadow-sm"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>{isSignUp ? 'Konto erstellen' : 'Anmelden'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-gray-50 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-gray-400 hover:text-gray-900 text-xs font-medium transition-colors tracking-wide"
            >
              {isSignUp 
                ? 'Bereits ein Konto? Hier anmelden' 
                : 'Noch kein Konto? Hier registrieren'}
            </button>
          </div>
        </div>
        
        <p className="mt-8 text-center text-gray-300 text-[10px] tracking-wide uppercase px-4">
          Präzision in der Ausbildung &middot; ExamPilot AI
        </p>
      </div>
    </div>
  );
}
