# Research Verdict: Optimizing for "Industriemeister Elektrotechnik IHK"

## Executive Summary
The "Industriemeister Elektrotechnik" examination follows a strict, standardized structure defined by the *Rahmenplan* of the DIHK. The current application architecture uses a loose, generative approach to topics ("bottom-up"), which leads to fragmented study data. 

To optimize for this specific qualification, we must shift to a **structured, top-down taxonomy** that mirrors the official exam regulations. This will improve the AI's classification accuracy and provide a familiar navigation structure for the user.

---

## 1. Official Exam Structure (The Taxonomy)

The examination is strictly divided into two main parts. The application should reflect this hierarchy:

### Part A: Fachrichtungsübergreifende Basisqualifikationen (BQ)
*Shared across all technical master craftsman qualifications.*
1. **Rechtsbewusstes Handeln** (Law, Labor Law, Environmental Law)
2. **Betriebswirtschaftliches Handeln** (Economics, Accounting, Costing)
3. **Anwendung von Methoden der Information, Kommunikation und Planung** (Project Management, Presentation)
4. **Zusammenarbeit im Betrieb** (HR, Leadership, Social Systems)
5. **Berücksichtigung naturwissenschaftlicher und technischer Gesetzmäßigkeiten (NTG)** (Math, Physics, Chemistry, Statistics)

### Part B: Handlungsspezifische Qualifikationen (HQ)
*Specific to Electrical Engineering.*
1. **Handlungsbereich "Technik"**:
   - Infrastruktursysteme und Betriebstechnik
   - Automatisierungs- und Informationstechnik
2. **Handlungsbereich "Organisation"**:
   - Betriebliches Kostenwesen
   - Planungs-, Steuerungs- und Kommunikationssysteme
   - Arbeits-, Umwelt- und Gesundheitsschutz
3. **Handlungsbereich "Führung und Personal"**:
   - Personalführung
   - Personalentwicklung
   - Qualitätsmanagement

---

## 2. Proposed Architectural Optimizations

### A. Backend & AI Prompts (Immediate Impact)
Instead of asking the LLM to "guess" the subject, we will inject the official taxonomy into the System Prompt.

*   **Action**: Update `EXAM_SYSTEM_PROMPT` in `backend/main.py`.
*   **Change**: Add a directive: *"Classify each question strictly into one of the following official IHK subjects: [List of BQ/HQ subjects]."*
*   **Result**: Every processed exam questions will automatically index into the correct bucket.

### B. Database Schema (Standardization)
The current `topics` are unconstrained strings. We should enforce the metadata.

*   **Action**: Add a `qualification_area` field (BQ vs HQ) and standard `subject` field.
*   **Refinement**: Ensure `topic_summaries` are children of these official subjects.

### C. Frontend / UI (User Experience)
The current "Study Guides" list is flat. It should be hierarchical to match the user's mental model of the exam.

*   **Action**: Update `StudyGuides.tsx` to group guides by **Qualification Area** (`Basisqualifikationen` vs `Handlungsspezifische Qualifikationen`) -> **Subject** (`NTG`, `Rechtsbewusstes Handeln`...) -> **Specific Topic**.
*   **Feature**: Add a "Formelsammlung" (Formula Collection) view for NTG and Technik subjects, as this is a permitted exam aid.

---

## 3. Plan of Action

1.  **Modify Prompts**: Update `backend/main.py` with the official IHK taxonomy.
2.  **Refactor Frontend**: Update `Sidebar.tsx` and `StudyGuides.tsx` to visualize this hierarchy.
3.  **Tagging**: (Optional) Allow users to manually re-tag existing "unknown" questions into this new structure.

**Recommendation**: Start by updating the Backend Prompt to ensure all *future* uploads are correctly classified, then update the UI to reflect this structure.
