# Production Readiness Verdict — DadTutor / ExamPilot

**Date**: 2026-04-13
**Project**: Study app for Industriemeister Elektrotechnik IHK (Bachelor Professional)
**Target user**: Single user (Dad), on iPad Safari
**Frontend**: https://studywbuddy.vercel.app (Next.js 16, React 19, Tailwind)
**Backend**: FastAPI + Supabase + Google Gemini

---

## 1. What's Actually Built

| Layer | State | Reference |
|---|---|---|
| PDF upload + async processing | Working | `backend/main.py:469-497` |
| NLP pre-extraction (regex) + Gemini parse | Working | `backend/main.py:97-176` |
| IHK BQ/HQ taxonomy in extraction prompt | Phase 1 done | `backend/main.py:204-300` |
| Study plan generation (7-day) | Working | `backend/main.py:513-536` |
| Practice session tracking | Working | `practice_sessions` table + endpoints |
| Topic summaries / study guides | Working | `/study-guides/*` endpoints |
| Fachgespräch chat bot | Working | `backend/main.py:741-775` |
| Dashboard / bento UI / German i18n | Working | `frontend/components/Dashboard.tsx` |
| Specialization filter | localStorage only (partial) | `frontend/app/page.tsx:24-35` |

---

## 2. Critical Gaps & Broken Pieces

### Blocker 1 — Hallucinated model name (CRITICAL)
`backend/main.py:32`: `SELECTED_MODEL = "gemini-3-flash-preview"` does not exist. Valid options: `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-1.5-flash`. **Every upload 404s at the model call.** This is why Dad's 3 uploads all reported "Analyse fehlgeschlagen".

### Blocker 2 — Deprecated SDK
`google-generativeai` is officially end-of-life (runtime warnings confirm). Must migrate to `google-genai` (`from google import genai`). Python 3.9 is also EOL — deployment base must be 3.11+.

### Blocker 3 — Local filesystem for PDFs
`backend/main.py:475` writes uploads to `temp/`. On any serverless / scale-to-zero host, the file is gone before the background task runs. Must use Supabase Storage.

### Blocker 4 — Background task lost on restart
`FastAPI BackgroundTasks` runs in-process. A deploy, crash, or cold start leaves exams stuck in `processing` forever. No retry, no queue, no timeout sweep.

### Blocker 5 — Schema vs. code mismatch
`frontend/lib/api.ts:92-93` references `qualification_area`, `handlungsbereich` on `StudyGuide`, but `backend/schema.sql:36-48` has no such columns. Persisted guides lose those fields even though the AI returns them.

### Blocker 6 — CORS + no auth
`allow_origins=["*"]` with `allow_credentials=True` is an invalid combination (browsers reject it). No auth at all means anyone who finds the API can read/wipe Dad's data.

### Blocker 7 — Error surface in UI is weak
Dashboard shows `error_message` as a truncated 1-line span with no retry button. When uploads fail, Dad has no next step.

---

## 3. Gaps vs. Own Research Verdicts

From `RESEARCH_VERDICT_ADVANCED.md`:

| Promised | Delivered | Gap |
|---|---|---|
| Phase 1: Scenario-based data model (`Exam → Scenario → Question`) | Not done | Still flat `Exam → Question`; Situationsaufgabe sub-questions treated in isolation — highest-value miss |
| Phase 1: Punkteschlüssel (point estimation per solution) | Not done | Missing from extraction prompt |
| Phase 2: Specialization actually filters HQ views | Partial | Stored in localStorage; `StudyGuides.tsx` doesn't hide other Schwerpunkte |
| Phase 3: Fachgespräch Bot | Built | System prompt prefixed on every turn — should use `system_instruction` on model init |
| Phase 3: Time-Trial Mode (4-hour Situationsaufgabe sim) | Not started | — |

Commit `b342519` claims Phase 3 complete, but Phase 1 — rated highest-value in the verdict — was skipped.

---

## 4. Implementation Plan

### Immediate (~2 hours) — unblock uploads
1. Fix model name → `gemini-2.5-flash` (or `gemini-2.5-pro` for harder BQ math).
2. Swap SDK: `pip install google-genai`; replace `genai.GenerativeModel(...).generate_content(...)` with `client.models.generate_content(model=..., contents=..., config=...)`.
3. Pin Python 3.11 in deploy config (`runtime.txt` or Dockerfile).
4. Fix CORS: explicit list `["https://studywbuddy.vercel.app", "http://localhost:3000"]`.
5. Add retry button on failed exam cards.

### Short-term (~1 day) — make it durable
6. Supabase Storage for PDFs: upload to `exams/{exam_id}.pdf` bucket; worker downloads to `/tmp`.
7. Queue the processing: Supabase Edge Function on insert, or move backend to Fly/Render with persistent worker. Interim: timeout sweep marking exams stuck >10min as `failed_timeout`.
8. Schema migrations: add `qualification_area`, `handlungsbereich`, `specialization` to `topic_summaries` and `exams`.
9. Shared-secret auth: `X-App-Secret` header checked in FastAPI middleware.
10. Sync specialization to Supabase (`user_settings` table, one row) — iPad + laptop agree.

### Medium-term (~2–3 days) — deliver the "Master" experience
11. Scenario model: new `scenarios` table (`exam_id`, `context_text`, `order`); `questions` gets `scenario_id` FK. Update extraction prompt to emit `scenarios[]` alongside `questions[]`.
12. Punkteschlüssel in `EXAM_SYSTEM_PROMPT`: add `"points": {"total": 10, "breakdown": [{"step":"Skizze","pts":3},...]}` to the JSON schema.
13. Wire specialization filter: in `/study-guides` and exam question lists, filter by user's Schwerpunkt.
14. Fachgespräch refactor: pass system prompt via `system_instruction` on model init (saves tokens + improves coherence).
15. Time-Trial mode: timer + locked scenario view.

### iPad-specific polish
- Test PDF uploads from iCloud Drive / Files app.
- Viewport meta + touch targets ≥44px.
- Smoke test `backdrop-blur` combos on Safari 17.

---

## 5. Success Rate

| Dimension | Score | Why |
|---|---|---|
| Feature completeness vs. brief | 75% | All four major capabilities scaffolded; scenario + points gaps hurt master-level fit |
| Correctness / will-it-run today | 30% | Blocker 1 breaks uploads. After 30-min fix: ~85%. |
| Durability / production-grade | 40% | No persistent file storage, no queue, no auth, schema drift |
| UX for a non-technical user | 80% | German, clean, simple. Error recovery is the main miss. |
| Domain precision (Industriemeister IHK) | 65% | Taxonomy good; scenario handling — the actual exam shape — missing |

**Overall production readiness: ~55%.**

---

## 6. Final Verdict

**CONDITIONAL GO.**

The architecture is sound and a large surface area is already built. But right now the app is broken for the exact flow Dad tested. Do the **Immediate** list (~2 hours) today → he can actually use it. Do **Short-term** this week → it survives a redeploy. Do **Medium-term** → it becomes the Bachelor-Professional-grade tool `RESEARCH_VERDICT_ADVANCED.md` promised.

**Confidence: ~90%** — based on reading the backend, schema, prompts, frontend entry, both research docs, and matching them against the reported symptom (3 failed uploads → caused by invalid model name in `backend/main.py:32`).

**Recommended next action**: start with Immediate fixes 1–4. Single highest-leverage hour of work on this project.
