import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../context/AuthContext";
import { LanguageProvider } from "../context/LanguageContext";
import { ToastProvider } from "../components/Toast";

export const metadata: Metadata = {
    title: "ExamPilot AI",
    description: "Ihr KI-Lernbegleiter",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="de" suppressHydrationWarning>
            <head>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
            </head>
            <body className="antialiased" suppressHydrationWarning>
                <AuthProvider>
                    <LanguageProvider>
                        <ToastProvider>
                            {children}
                        </ToastProvider>
                    </LanguageProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
