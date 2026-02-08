# Advanced Research Verdict: "Bachelor Professional" Optimization

## Status: APPROVED for Implementation

**Context**: You have effectively implemented the core **BQ/HQ Taxonomy**. The application now correctly buckets content into the official IHK structure. 

**The Next Leap**: To truly reflect the "Bachelor Professional" (DQR Level 6) standard, we must move beyond *content organization* to **process simulation**. The "Industriemeister" is not just about answering questions; it is about solving complex, interlinked **Situationsaufgaben** (Situational Tasks) and defending them in the **Fachgespräch** (Technical Discussion).

---

## 1. Deep-Dive Findings (IHK Ostbrandenburg & DQR 6)
*   **The "Specialization Trap"**: IHK Ostbrandenburg *only* tests the Schwerpunkt **"Infrastruktursysteme und Betriebstechnik"**. Other IHKs might strictly test "Automatisierungstechnik". The current app attempts to cover everything, which dilutes the user's focus.
*   **The "Situationsaufgabe" Structure**: Unlike BQ (which is often granular), HQ exams consist of **integrated scenarios**. A single "Project Description" (e.g., "New production hall planning") governs 5-10 subsequent questions. Treating these queries in isolation (as the current AI does) destroys context and makes study ineffective.
*   **Evaluation Criteria**: At Master level, points are awarded for **Justification** and **Process**, not just the result. "Why did you choose this fuse rating?" is more important than the rating itself.

---

## 2. Advanced Optimization Strategy

### A. Feature: "Profil-Schwerpunkt" (Specialization Select)
The application must allow the user to explicitly lock their specialization.
*   **Why**: If a user is at IHK Ostbrandenburg, questions about "Automatisierungstechnik" are noise.
*   **Implementation**: 
    - a Toggle/Select in `Settings` or `Dashboard`. 
    - *Filter* the "Handlungsspezifisch" UI to strictly show only the selected sub-branch.

### B. Architecture: "Scenario-Based" Data Model
We need to handle the "Situationsaufgabe".
*   **Current Model**: `Exam -> Question`.
*   **New Model**: `Exam -> Scenario -> Question`.
*   **AI Prompt Update**: Modify the extraction prompt to detect **Scenario Context Blocks** (long texts describing a facility/problem) and link subsequent questions to this context.

### C. Feature: "Fachgespräch" Simulator (The Oral Defense)
The "Fachgespräch" is the final hurdle. It requires verbal defense of a solution.
*   **Proposal**: An interactive Chat Mode.
    1. User submits a solution to a study plan task.
    2. AI (Persona: "Prüfungsausschuss") does *not* correct it immediately but asks: *"Warum haben Sie sich für diese Schutzklasse entschieden?"* (Why this protection class?).
    3. User must justify.
    4. AI grades the *argumentation*.

### D. Content: "Punkteschlüssel" (Grading Key)
The AI solutions currently provide a text answer. They should approximate the IHK grading key.
*   **Prompt Update**: Ask the AI to estimate point distribution.
    *   *Example*: "Lösungsvorschlag (10 Pkt): 3 Pkt für Skizze, 4 Pkt für Berechnung, 3 Pkt für Begründung."

---

## 3. Implementation Roadmap

### Phase 1: Context & Precision (Immediate)
1.  **Refine BQ/HQ Prompts**: Update `backend/main.py` to recognize "Scenario Text" vs "Question Text".
2.  **Add Point Estimation**: Instruct LLM to output estimated points per step.

### Phase 2: User Customization (Short Term)
1.  **Settings Profile**: Add "Selected Specialization" (e.g., Infrastruktursysteme).
2.  **Filtered View**: Hide irrelevant HQ subjects in `StudyGuides.tsx`.

### Phase 3: The "Master" Modules (Long Term)
1.  **Fachgespräch Bot**: A dedicated chat interface for oral exam prep.
2.  **Time-Trial Mode**: "Situationsaufgabe" simulation with a 4-hour timer.

## Final Verdict
**PROCEED**. The current baseline is good for *knowledge*, but the proposed changes are necessary for *competence*. The shift to "Scenario-based" questions is the single highest-value change we can make for an IHK Master candidate.
