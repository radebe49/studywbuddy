"use client";

import React, { useCallback, useState } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { useToast } from './Toast';
import { useLanguage } from '../context/LanguageContext';

interface FileUploadProps {
    onFileUpload: (files: File[]) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload }) => {
    const { toast } = useToast();
    const { t } = useLanguage();

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const allFiles = Array.from(e.dataTransfer.files);
            const pdfFiles = allFiles.filter((f: File) => f.type === 'application/pdf');
            
            if (pdfFiles.length !== allFiles.length) {
                toast(t('onlyPdfError'), "error");
            }
            
            if (pdfFiles.length > 0) {
                onFileUpload(pdfFiles);
            } else {
                toast(t('atLeastOnePdf'), "error");
            }
        }
    }, [onFileUpload, toast]);

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const pdfFiles = Array.from(e.target.files).filter((f: File) => f.type === 'application/pdf');
            onFileUpload(pdfFiles);
        }
    };

    return (
        <div
            className="w-full h-48 md:h-64 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center bg-white hover:bg-gray-50 hover:border-gray-400 transition-all cursor-pointer group"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => document.getElementById('fileInput')?.click()}
        >
            <input
                type="file"
                id="fileInput"
                multiple
                accept=".pdf"
                className="hidden"
                onChange={handleFileInput}
            />

            <div className="p-3 md:p-4 rounded-full bg-indigo-50 group-hover:scale-110 transition-transform duration-300 mb-3 md:mb-4">
                <Upload className="w-6 h-6 md:w-8 md:h-8 text-indigo-600" />
            </div>

            <h3 className="text-base md:text-lg font-semibold text-gray-700 mb-1">{t('importExams')}</h3>
            <p className="text-xs md:text-sm text-gray-500 px-4 text-center">{t('dragDropHint')}</p>

            <div className="mt-3 md:mt-4 flex gap-2">
                <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-500 flex items-center gap-1">
                    <FileText size={12} /> PDF
                </span>
            </div>
        </div>
    );
};

export default FileUpload;
