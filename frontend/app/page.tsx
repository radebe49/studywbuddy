import { ExamList } from "@/components/ExamList";
import { UploadExam } from "@/components/UploadExam";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
              D
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
              DadTutor
            </h1>
          </div>
          <div className="text-sm font-medium text-slate-500">
            For iPad
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 pt-10 space-y-8">
        {/* Welcome Section */}
        <div className="text-center space-y-2 mb-10">
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
            Ready to study?
          </h2>
          <p className="text-slate-500 text-lg">
            Upload an exam paper to get a personalized study plan.
          </p>
        </div>

        {/* Upload Section */}
        <section>
          <UploadExam />
        </section>

        {/* History Section */}
        <section>
          <ExamList />
        </section>
      </div>
    </main>
  );
}
