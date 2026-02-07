"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { FileText, CheckCircle, Clock, XCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Exam {
    id: string;
    filename: string;
    upload_date: string;
    status: "uploading" | "processing" | "completed" | "failed";
}

export function ExamList() {
    const [exams, setExams] = useState<Exam[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchExams = async () => {
        try {
            const res = await axios.get("http://localhost:8000/exams");
            setExams(res.data);
        } catch (error) {
            console.error("Failed to fetch exams:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchExams();
        const interval = setInterval(fetchExams, 5000); // Poll every 5s
        return () => clearInterval(interval);
    }, []);

    if (loading && exams.length === 0) {
        return <div className="text-center py-10 text-gray-400">Loading exams...</div>;
    }

    if (exams.length === 0) {
        return (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <h3 className="text-lg font-medium text-slate-900">No exams yet</h3>
                <p className="text-slate-500">Upload your first PDF to get started.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-semibold text-slate-900">Your Study Plans</h2>
                <button
                    onClick={fetchExams}
                    className="p-2 text-slate-400 hover:text-blue-600 transition-colors rounded-full hover:bg-blue-50"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            <div className="grid gap-3">
                {exams.map((exam) => (
                    <div
                        key={exam.id}
                        className="group relative bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-between"
                    >
                        <div className="flex items-center gap-4">
                            <div className={cn("p-2 rounded-lg", {
                                "bg-blue-50 text-blue-600": exam.status === "processing",
                                "bg-green-50 text-green-600": exam.status === "completed",
                                "bg-red-50 text-red-600": exam.status === "failed",
                                "bg-slate-100 text-slate-500": exam.status === "uploading",
                            })}>
                                {exam.status === "processing" && <Clock className="w-5 h-5 animate-pulse" />}
                                {exam.status === "completed" && <CheckCircle className="w-5 h-5" />}
                                {exam.status === "failed" && <XCircle className="w-5 h-5" />}
                                {exam.status === "uploading" && <RefreshCw className="w-5 h-5 animate-spin" />}
                            </div>

                            <div>
                                <h3 className="font-medium text-slate-900 truncate max-w-[200px] sm:max-w-md">
                                    {exam.filename}
                                </h3>
                                <p className="text-xs text-slate-500 flex items-center gap-2">
                                    <span>{new Date(exam.upload_date).toLocaleDateString()}</span>
                                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                    <span className="capitalize">{exam.status}</span>
                                </p>
                            </div>
                        </div>

                        {exam.status === "completed" ? (
                            <Link
                                href={`/plan/${exam.id}`}
                                className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                            >
                                View Plan
                            </Link>
                        ) : (
                            <span className="text-xs text-slate-400 px-3">
                                {exam.status === "processing" ? "AI is analysing..." : "Waiting..."}
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
