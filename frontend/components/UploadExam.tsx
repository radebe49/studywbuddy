"use client";

import { useState } from "react";
import axios from "axios";
import { UploadCloud, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function UploadExam() {
    const [dragActive, setDragActive] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFiles(e.dataTransfer.files);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            handleFiles(e.target.files);
        }
    };

    const handleFiles = async (files: FileList) => {
        const file = files[0];
        if (file.type !== "application/pdf") {
            setError("Please upload a PDF file.");
            return;
        }

        setUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append("file", file);

        try {
            await axios.post("http://localhost:8000/upload", formData);
            // Wait a sec for UI feel
            setTimeout(() => {
                setUploading(false);
                // Ideally trigger refresh of list
                window.location.reload();
            }, 1000);
        } catch (err: any) {
            console.error(err);
            setError("Upload failed. Is the backend running?");
            setUploading(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">New Exam Upload</h2>

            <div
                className={cn(
                    "relative h-64 rounded-xl border-2 border-dashed transition-all duration-200 ease-in-out flex flex-col items-center justify-center cursor-pointer overflow-hidden",
                    dragActive
                        ? "border-blue-500 bg-blue-50 scale-[1.02]"
                        : "border-slate-300 hover:border-blue-400 hover:bg-slate-50",
                    uploading && "pointer-events-none opacity-50"
                )}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById("file-upload")?.click()}
            >
                <input
                    id="file-upload"
                    type="file"
                    className="hidden"
                    accept="application/pdf"
                    onChange={handleChange}
                />

                {uploading ? (
                    <div className="text-center">
                        <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
                        <p className="text-slate-600 font-medium">Uploading & Analyzing...</p>
                        <p className="text-slate-400 text-sm mt-1">This might take a minute</p>
                    </div>
                ) : (
                    <div className="text-center p-6">
                        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <UploadCloud className="w-8 h-8" />
                        </div>
                        <p className="text-lg font-medium text-slate-900 mb-2">
                            Tap to upload PDF
                        </p>
                        <p className="text-slate-500 text-sm">
                            or drag and drop here
                        </p>
                    </div>
                )}

                {dragActive && (
                    <div className="absolute inset-0 bg-blue-500/10 pointer-events-none" />
                )}
            </div>

            {error && (
                <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm text-center">
                    {error}
                </div>
            )}
        </div>
    );
}
