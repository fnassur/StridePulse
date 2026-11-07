# Garmin Personal API Key & Authentic Activity Sync Plan

Enable StridePulse to pull authentic training and running activity data directly from Garmin Connect using the **Garmin Connect Personal API Key flow** (`https://developer.garmin.com/gc-developer-program/personal/personal-api/`), store activities in per-user Firestore records, preserve the multi-file/ZIP archive ingestion flow, and purge all mock, synthetic, and hardcoded data.

## Critical Specifications & Architecture

- **Garmin Personal API Flow**:
  - Each user creates their own Personal API Key from Garmin Connect: `https://connect.garmin.com/modern/settings/personal-api-key`
  - Users paste their key into StridePulse.
  - StridePulse exchanges the API key for a temporary bearer token (`POST /personalapitoken-service/personal-api/personal-api-key/token` with header `Authorization: ApiKey [personal-api-key]`).
  - StridePulse searches and pulls authentic Garmin activities (`GET /activitylist-service/activities/search/activities?limit=50&start=0` with `Authorization: Bearer [access-token]`).
  - Activities are mapped authentically from Garmin JSON telemetry (splits, distance, moving time, elapsed time, heart rate, cadence, power, elevation gain) into StridePulse's `Workout` schema.
- **ZIP & Batch File Archive**:
  - Remained intact as requested: drag-and-drop `.ZIP`, `.FIT`, `.TCX`, or `.GPX` files with real client-side parsing via `JSZip` and fit/tcx/gpx decoders.
- **Duplicate Prevention**:
  - Deduplication fingerprinting based on activity start timestamp and distance ensures runs are not duplicated on re-sync.
- **User Isolation**:
  - Workouts and Garmin account settings are stored under `/users/{uid}/workouts` and `/users/{uid}/settings/garmin` in Cloud Firestore.
- **Mock Data Elimination**:
  - All synthetic workout generators, mock data arrays, and hardcoded run overrides have been completely removed.

## Completed Tasks

1. **Garmin Personal API Service Layer (`src/services/garminConnectService.ts`)**:
   - `validateGarminPersonalApiKey(apiKey)`: Validates key and requests access token.
   - `pullGarminActivitiesWithPersonalKey(...)`: Fetches authentic activities and maps them.
   - Robust proxy with `/api/garmin` in `vite.config.ts` and `server.js` to eliminate browser CORS obstacles.
2. **Personal API Key UI (`src/components/GarminCloudSyncHub.tsx`)**:
   - Clean interface for entering and validating Personal API keys with password visibility toggle.
   - Step-by-step guidance linking directly to Garmin Connect's Personal API Key settings page.
   - Pull Activities button with status feedback and deduplication counter.
3. **Modal & Navigation (`src/components/GarminSyncModal.tsx`)**:
   - Updated tab to "Garmin Personal API" with key icon.
   - Preserved "Batch Files & ZIP Archive" tab with JSZip support.
4. **Cloud Firestore Sync (`src/services/firestoreSync.ts` & `src/App.tsx`)**:
   - Saves Personal API credentials under user's private cloud document.
   - Real-time batch writing to user-isolated Firestore collections.
7. **Firestore Sanitization & Batch Write Fix**:
   - Fixed Firestore document rejection caused by optional `undefined` telemetry fields (power, HR, cadence) in workout and split objects using recursive `sanitizeWorkoutForFirestore` stripping.
   - Decoupled `saveBatchWorkoutsToCloud` from the React `setWorkouts` state updater callback to guarantee asynchronous batch execution.
   - Added automatic migration of in-memory local workouts to Firestore upon sign-in.
   - Embedded real-time Firestore persistence status badge in `GarminCloudSyncHub.tsx` showing active sync profile (`faiz.ali.nassur.93@gmail.com`).
8. **Garmin SplitSummaries Pace Spike Resolution**:
   - Diagnosed root cause of the vertical spike to `0'01"` pace and the `"Fastest Split: Mi 4 (0'01" /mi)"` anomaly shown in the Progress Comparison chart.
   - Fixed parser in `garminConnectService.ts` to strictly exclude Garmin's `splitSummaries` (which contain overall Run/Walk/Stand category durations like 6.38 meters in 7s) from being misinterpreted as sequential distance laps.
   - Added pace sanity boundaries (`120s/km` to `1200s/km`) in `getUniformSplits`, `normalizeStoredWorkouts`, and `SimilarRunsCard.tsx` so existing Firestore records automatically render authentic, clean mile-by-mile pace lines.
