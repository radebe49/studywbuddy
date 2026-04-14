# Product Specification — ExamPilot AI (DadTutor)

**Version**: 1.0
**Date**: 2026-04-13
**Status**: Near-production (95% readiness)
**Live URL**: https://studywbuddy.vercel.app

---

## 1. Purpose

ExamPilot AI is a single-user web application that helps a candidate prepare for the **Geprüfter Industriemeister Fachrichtung Elektrotechnik (IHK)** — a German Bachelor-Professional (DQR Level 6) technical masters qualification.

The candidate uploads past exam PDFs; the system extracts, classifies, solves, and converts them into structured study material aligned to the official IHK exam taxonomy. It then simulates the real exam shape — including multi-question Situationsaufgaben, the 4-hour written paper, and the oral Fachgespräch defense.

### Primary user
A working adult (the user's father) preparing for the IHK Industriemeister exam, studying on an iPad in German, with limited time and no technical background. The app must be reliable, simple, and forgiving.

### Success definition
The user can upload real IHK past papers, receive accurate German solutions aligned to the official Rahmenplan taxonomy, practice under timed conditions, and defend answers in a simulated Fachgespräch — all without technical help.

---

## 2. Domain Context (Why This Isn't a Generic Study App)

The Industriemeister Elektrotechnik exam is rigidly structured by the DIHK Rahmenplan. A generic question-extractor produces fragmented, unusable data. The product is therefore built around the **official taxonomy**:

### Part A — Basisqualifikationen (BQ)
1. Rechtsbewusstes Handeln
2. Betriebswirtschaftliches Handeln
3. Anwendung von Methoden der Information, Kommunikation und Planung
4. Zusammenarbeit im Betrieb
5. Berücksichtigung naturwissenschaftlicher und technischer Gesetzmäßigkeiten (NTG)

### Part B — Handlungsspezifische Qualifikationen (HQ)
- **Technik**: Infrastruktursysteme und Betriebstechnik *or* Automatisierungs- und Informationstechnik
- **Organisation**: Betriebliches Kostenwesen, Planungs-/Steuerungs-/Kommunikationssysteme, Arbeits-/Umwelt-/Gesundheitsschutz
- **Führung und Personal**: Personalführung, Personalentwicklung, Qualitätsmanagement

### Key domain realities
- **Situationsaufgabe**: one long scenario text governs 5–10 linked questions. Treating them in isolation destroys meaning.
- **Punkteschlüssel**: points are awarded for *justification* and *process*, not just results.
- **Specialization**: each IHK chamber tests only one Schwerpunkt; unrelated HQ content is noise.
- **Language**: all content, UI, and AI output must be in German (Sie-form for Fachgespräch).

---

## 3. Core Features

### 3.1 PDF Upload & Analysis
- User uploads one or more PDF past-papers from iPad Files / iCloud Drive.
- File is persisted to Supabase Storage (durable across restarts).
- A background worker extracts text via `pypdf`, runs a regex-based NLP pre-pass to identify candidate questions, then calls Google Gemini with the official IHK taxonomy injected into the system prompt.
- AI returns a fully classified, solved JSON payload: every question tagged with `qualificationArea` (BQ/HQ), `subject`, `topic`, `type`, `solution`, `explanation`, and `points` (`total` + `breakdown`).
- **Scenarios** are extracted as first-class objects and linked to their child questions via `scenario_id`.
- Status lifecycle: `uploading` → `processing` → `completed` / `failed`.
- Failed exams show a **retry** button; stuck jobs auto-fail after 15 min via pg_cron sweep.

### 3.2 Dashboard
- Bento-grid overview: weekly velocity, cognitive load (difficulty spread), library size, practice mastery rate, learning streak, recent sessions.
- "Heutiger Fokus" card surfaces today's task from the active study plan.
- "Neueste Dateien" list with status, error message, and retry.
- All copy in German with `de-DE` date formatting.

### 3.3 Exam Viewer & Practice Mode
- Question-by-question practice with scenario context shown when applicable.
- Per-question point breakdown visible (Punkteschlüssel transparency).
- Mark each question ✅ correct / ❌ incorrect / ⏭ skipped — session saved to `practice_sessions`.
- **Time-Trial Mode**: 4-hour countdown matching the real IHK written paper; solution reveal is disabled; auto-finish on timeout.

### 3.4 Study Plan
- Generates a 7-day personalised plan (German) based on weak areas inferred from past "Hard" papers.
- JSON schedule with `day`, `date`, `focus`, `tasks[]`, `durationMinutes`.

### 3.5 Study Guides ("Lernleitfäden")
- Per-topic guides aggregated from all extracted questions.
- Include: summary, key concepts, formulas (LaTeX), common mistakes, worked examples with **IHK-compliant point breakdowns**, and a Punkte-Strategie section.
- Organised hierarchically: BQ / HQ → Handlungsbereich → Subject → Topic.
- Filtered by the user's selected specialization — unrelated HQ guides are hidden.

### 3.6 Fachgespräch Bot (Oral Defense Simulator)
- Chat interface persona: "Prüfungsausschuss" examiner, formal "Sie".
- Does not correct; probes: *"Warum haben Sie sich für diese Schutzklasse entschieden?"* / *"Welche VDE-Vorschrift liegt hier zugrunde?"*
- Uses `system_instruction` on chat-session creation (context persists efficiently across turns).
- Provides a Handlungskompetenz evaluation after several exchanges.

### 3.7 Settings
- Specialization selector (Infrastruktursysteme / Automatisierungstechnik / None).
- Stored in Supabase `user_settings` — syncs across iPad + laptop.

---

## 4. Data Model

| Table | Purpose |
|---|---|
| `exams` | PDF metadata, storage path, status, error, qualification area |
| `scenarios` | Situationsaufgabe context blocks, FK to exam, ordered |
| `questions` | Individual questions, FK to scenario (nullable), solution, points_total, points_breakdown |
| `study_plans` | Legacy table holding the full AI JSON output per exam |
| `topic_summaries` | Generated study guides per topic |
| `practice_sessions` | Per-session practice results for progress tracking |
| `user_settings` | Single-row specialization preference |

Automated maintenance: pg_cron job `exam-timeout-sweep` runs every 5 min, marking any exam stuck in `processing` >15 min as `failed` with a German error message.

---

## 5. Architecture

```
iPad Safari
    │
    ▼
Next.js 16 frontend (Vercel)  ──── X-App-Secret header ────┐
  • React 19, Tailwind 4                                    │
  • axios client with baseURL = NEXT_PUBLIC_API_URL         ▼
                                                      FastAPI backend
                                                       • Python 3.11
                                                       • google-genai SDK
                                                       • BackgroundTasks
                                                              │
                                                              ├──► Supabase Postgres
                                                              ├──► Supabase Storage (exams bucket)
                                                              └──► Gemini 2.x API
```

### Tech stack
- **Frontend**: Next.js 16, React 19, Tailwind CSS 4, lucide-react icons, react-markdown, canvas-confetti
- **Backend**: FastAPI, Pydantic, pypdf, google-genai, supabase-py
- **Database & Storage**: Supabase (Postgres + Storage + pg_cron)
- **AI**: Google Gemini (2.0-flash default, 2.5 for harder tasks via smart routing)
- **Hosting**: Vercel (frontend), backend host TBD (Render/Fly recommended with persistent worker)

---

## 6. Security & Privacy

- **Auth**: shared-secret `X-App-Secret` header middleware on every non-public route. Single-user app, no accounts.
- **CORS**: explicit origin list — `studywbuddy.vercel.app` + `localhost:3000`.
- **Secret management**: `GOOGLE_API_KEY`, `SUPABASE_KEY`, `APP_SECRET` via environment variables only.
- **Data**: PDF content never leaves the Supabase project; Gemini receives extracted text only.
- **Known limitation**: `NEXT_PUBLIC_APP_SECRET` is visible in the browser bundle — sufficient for bot-blocking, not for hostile attacker defence. Acceptable for single-user scope.

---

## 7. UX Principles

1. **German-first**: every label, error, date, and AI output in German. `Sie` form throughout.
2. **iPad-first**: touch targets ≥44px; file picker accepts iCloud/Files PDFs; no hover-dependent UI.
3. **Forgiving**: every failure state has a retry path; stuck jobs auto-fail with a readable German message.
4. **Simple**: the dashboard is the home; all major actions reachable in ≤2 taps.
5. **Professional tone**: matches the seriousness of a Master-level qualification — no gamification kitsch.

---

## 8. User Flows

### Flow A — First Upload
1. User opens https://studywbuddy.vercel.app on iPad.
2. Taps "Erste Arbeit hochladen" → Files app → selects a PDF from iCloud Drive.
3. Card appears in "Neueste Dateien" with status *Verarbeitung…*.
4. Polling refreshes every 5s; within ~30–90s status flips to *completed*.
5. User taps the card → ExamViewer opens with classified questions and Punkteschlüssel.

### Flow B — Time-Trial Simulation
1. User opens a completed exam.
2. Toggles "Prüfung simulieren" (Time-Trial).
3. Taps "Übung beginnen" → 4-hour countdown starts, solutions hidden.
4. User answers each question, marking result; progress saved live.
5. At finish (manual or timeout) → confetti + score + session saved to `practice_sessions`.

### Flow C — Fachgespräch Defense
1. User navigates to Fachgespräch from sidebar.
2. Selects topic context (e.g. "Infrastruktursysteme").
3. Types their initial answer/solution.
4. Bot probes with *Warum…?* / *Welche VDE…?*.
5. User justifies; after ~5 exchanges, bot gives Handlungskompetenz evaluation.

### Flow D — Study Guide Generation
1. User picks a topic from "Lernleitfäden" (filtered by their specialization).
2. System aggregates all related questions → Gemini generates summary, formulas, examples with Punkteschlüssel, quick tips.
3. Guide saved to `topic_summaries`; re-generation updates in place.

---

## 9. Non-Functional Requirements

| Attribute | Target |
|---|---|
| Upload → analysis latency | < 2 min for a typical 10-page IHK paper |
| Frontend Time-to-Interactive | < 3s on iPad Safari / LTE |
| Availability | Best-effort; single-user tolerances |
| Durability | PDFs survive backend restarts (Supabase Storage) |
| Failure visibility | Every `failed` exam shows German error + retry button |
| Data portability | Raw AI JSON preserved in `study_plans.raw_json` |

---

## 10. Out of Scope (v1)

- Multi-user accounts, sharing, collaboration
- Native iOS app (web-only)
- OCR for image-only / scanned PDFs (relies on embedded text layer)
- Offline mode
- Billing / paywalls
- Generating brand-new practice questions (only extracts + solves existing ones)
- Other IHK qualifications (Industriemeister Metall, etc.)

---

## 11. Success Metrics

- **Functional**: candidate can upload, analyse, practice, and defend a real IHK past paper without technical intervention.
- **Accuracy**: ≥90% of questions correctly classified into BQ/HQ taxonomy on manual spot-check.
- **Reliability**: zero exams stuck in `processing` state >15 min (guaranteed by pg_cron).
- **Engagement**: daily practice streak maintained during exam-prep window.
- **Terminal goal**: candidate passes the Industriemeister Elektrotechnik IHK exam.

---

## 12. Implementation Status

| Phase | Scope | Status |
|---|---|---|
| Immediate | Model name fix, SDK migration, Python 3.11 pin, CORS, retry button | ✅ 5/5 complete |
| Short-term | Supabase Storage, timeout sweep + pg_cron, schema migrations, shared-secret auth, specialization sync | ✅ 5/5 complete |
| Medium-term | Scenario data model, Punkteschlüssel, specialization filter, Fachgespräch refactor, Time-Trial mode | ✅ 5/5 complete |

**Overall production readiness: ~95%.** Remaining items are operational polish: iPad smoke test, production secret rotation, pg_cron extension enabled in Supabase dashboard, optional model upgrade to Gemini 2.5.

---

## 13. Open Questions / Future Enhancements

- Add OCR (Gemini vision or Tesseract) for scanned PDFs.
- Formelsammlung view — curated permitted-aid formulas for NTG and Technik.
- Anki-style spaced-repetition scheduling for weak questions.
- Exportable PDF study guide for offline review.
- Multi-candidate mode if the app is ever shared with other IHK students.
