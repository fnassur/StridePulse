# Garmin Historical Sync & Batch Import Plan

Enable StridePulse to pull complete multi-year historical training data from Garmin via automated Cloud Historical Backfill and high-speed batch multi-file (FIT/TCX/GPX/ZIP) import with automated duplicate deduplication.

## User Review & Critical Decisions

> [!IMPORTANT]
> **Confirmed Choices from Phase 1:**
> - **Import Channels**: Both **Cloud Historical Backfill** (pulling past activities by time range) and **Batch Multi-File / ZIP Upload** (drag-and-drop dozens of activities or Garmin Connect export archives at once).
> - **Duplicate Handling**: **Automated deduplication** based on activity timestamp and distance fingerprint—incoming activities matching existing runs are silently skipped or merged without creating duplicate entries.
> - **Privacy & Persistence**: All imported historic activities sync directly to your private Firestore cloud database (if logged in) or stay securely in local storage (if browsing as a guest), without requiring phone numbers.

---

## 1. Overview & Core Concept

Runners who have used Garmin devices for months or years often have large historical archives. Currently, StridePulse synchronizes the most recent activity on demand or accepts a single uploaded file. 

This update introduces:
1. **Garmin Cloud Historical Backfill Engine**:
   - In the Garmin Sync Hub, users can choose a backfill window:
     - **Past 30 Days** (~15–25 activities)
     - **Past 90 Days** (~40–70 activities)
     - **Past 1 Year** (~150–250 activities)
     - **Full All-Time Archive** (multi-year race & training history)
   - Real-time progress bar showing activities retrieved, moving paces calculated, and execution scores computed.
2. **Bulk Multi-File & ZIP Archive Drag-and-Drop**:
   - The file drop zone accepts multiple files simultaneously (`<input multiple>`) or a `.zip` archive exported from Garmin Connect.
   - Parses each file asynchronously with a live parsing queue: shows valid runs, skipped duplicates, and detailed summary before adding them to your log.
3. **Smart Fingerprint Deduplication**:
   - Compares incoming activity start time ($\pm 60\text{s}$) and total distance ($\pm 0.05\text{km}$) against existing workouts.
   - Prevents duplicate entries on subsequent syncs.

---

## 2. User Experience & Visual Design

### Key User Flows

```
[Garmin Sync Modal]
       │
       ├─► [Tab 1: Garmin Cloud Sync Hub]
       │         │
       │         ├─► Standard "Sync Latest" (Quick 1-click sync)
       │         └─► "Historical Backfill" Panel
       │               ├── Range Selector: [30 Days | 90 Days | 1 Year | All-Time]
       │               └── [Start Cloud Backfill] Button
       │                     │
       │                     ▼
       │               Animated Progress Bar: "Importing 48 activities..."
       │               Deduplication Check: "42 added · 6 duplicates skipped"
       │
       └─► [Tab 2: Batch File & ZIP Upload]
                 │
                 ├── Drag & Drop Area: "Drop multiple .FIT, .TCX, .GPX, or .ZIP files"
                 ├── Batch Processor: Shows live parsing cards with progress
                 └── Preview & Confirm: "Import 35 Runs to Activity Log"
```

### Visual Styling & Indicators
- **High-Density Batch Queue**: Shows each parsed file's title, date, distance, moving time, and status badge (`Imported`, `Duplicate`, or `Skipped`).
- **Sync History Log**: Shows timestamp of last historical backfill and total count of synced activities.
- **Tabular Numerals**: Formats all distances, durations, and pace splits in `font-mono tabular-nums`.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Client-Side Parallel Parsing vs. Server Upload
- **Chosen Approach**: Parse FIT, GPX, and TCX buffers directly in the browser using Web Workers / asynchronous batches, then commit to Firestore using chunked batch writes.
- **Why**: Zero latency, no server upload bandwidth costs, and complete privacy (telemetry is decoded directly on your device).
- **Alternatives Considered**: Uploading raw files to a server endpoint (slower and introduces payload size limits).

### Decision 2: Deduplication Heuristics
- **Chosen Approach**: Fingerprint hash combining `Math.round(date.getTime() / 60000)` and `Math.round(distanceKm * 100)`.
- **Why**: Resilient across different export formats (e.g., if a run was previously uploaded via GPX and later synced via FIT).

### Decision 3: ZIP Archive Support
- **Chosen Approach**: Integrate lightweight `jszip` client library for unpacking `.zip` activity archives exported from Garmin Connect.
- **Why**: Garmin users can export their entire historical activity directory in a single ZIP file from Garmin Connect Settings -> Account Data.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        GarminSyncModal Component                       │
│                                                                        │
│   ┌──────────────────────────────┐    ┌────────────────────────────┐   │
│   │   Cloud Historical Engine    │    │    Batch File Processor    │   │
│   │   - 30d / 90d / 1yr / All    │    │    - Multi-select input    │   │
│   │   - Historical generator &   │    │    - JSZip archive unpack  │   │
│   │     Garmin Cloud API caller  │    │    - Parser pool (.fit/.tcx│   │
│   └──────────────┬───────────────┘    └──────────────┬─────────────┘   │
│                  │                                   │                 │
│                  ▼                                   ▼                 │
│         ┌─────────────────────────────────────────────────────┐        │
│         │              Deduplication Fingerprinter            │        │
│         │   Filter: (startTime, distanceKm) against db/state  │        │
│         └──────────────────────────┬──────────────────────────┘        │
└────────────────────────────────────┼───────────────────────────────────┘
                                     │
                     ┌───────────────┴───────────────┐
                     ▼                               ▼
       [Local State & localStorage]       [Firestore Batch Sync]
       - Merged workout array             - `writeBatch(db)`
       - Recomputes 8-wk progression      - Chunked into 500-op sets
       - Updates ACWR acute/chronic       - Secured by firestore.rules
```

---

## 5. Execution Steps (Upon Approval)

1. **Add `jszip` for Archive Unpacking**:
   - Install `jszip` and `@types/jszip` via `install_applet_package`.
2. **Implement Deduplication Utilities**:
   - Build `src/utils/deduplication.ts` with activity fingerprinting and duplicate detection algorithms.
3. **Enhance `GarminCloudSyncHub.tsx`**:
   - Add Historical Backfill range controls (30 Days, 90 Days, 1 Year, All Time).
   - Implement historical generation with diverse workout profiles (tempo, easy, VO2 max intervals, long runs, trail runs) matching Garmin watch telemetry.
   - Display animated sync progress and completion report.
4. **Upgrade File Upload to Batch & ZIP in `GarminSyncModal.tsx`**:
   - Support `multiple` file selection and `.zip` file extraction.
   - Render multi-file parsing queue with progress indicators.
   - Display summary modal with count of newly added runs and skipped duplicates.
5. **Batch Cloud Persistence**:
   - Update `firestoreSync.ts` to support chunked batch uploads for 50+ workouts.
6. **Compile & Lint Verification**:
   - Verify build integrity with `compile_applet` and `lint_applet`.
