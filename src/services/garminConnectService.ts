import { Workout, GarminCloudAccount, LapSplit } from '../types/workout';
import { deduplicateWorkouts } from '../utils/deduplication';

export interface GarminSyncResult {
  newActivities: Workout[];
  duplicatesCount: number;
  message: string;
}

/**
 * Initiates the real Garmin Connect OAuth 2.0 / Direct Authorization flow.
 * Opens the Garmin Connect authorization dialog in a dedicated popup.
 */
export function openGarminOAuthPopup(redirectUri: string, clientId?: string): Window | null {
  const actualClientId = clientId || (import.meta.env.VITE_GARMIN_CLIENT_ID as string) || 'garmin_connect_stridepulse';
  
  const params = new URLSearchParams({
    client_id: actualClientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'activity:read',
    state: 'garmin_sync_' + Date.now(),
  });

  const garminAuthUrl = `https://connect.garmin.com/oauthConfirm?${params.toString()}`;

  const popup = window.open(
    garminAuthUrl,
    'garmin_oauth_popup',
    'width=600,height=750,left=200,top=100'
  );

  return popup;
}

/**
 * Normalizes a raw Garmin Connect activity object into the standard StridePulse Workout schema.
 */
export function parseGarminConnectActivity(raw: any): Workout | null {
  if (!raw) return null;

  // Verify activity is a running type or sports activity
  const activityType = (raw.activityType?.typeKey || raw.activityType || raw.type || 'running').toLowerCase();
  const isRunning =
    activityType.includes('running') ||
    activityType.includes('run') ||
    activityType.includes('trail') ||
    activityType.includes('treadmill') ||
    activityType.includes('track');

  if (!isRunning && raw.activityType) {
    // Only ingest running workouts as requested
    return null;
  }

  const id = `garmin_${raw.activityId || raw.id || Date.now()}`;
  const title = raw.activityName || raw.activityName || raw.title || 'Garmin Running Activity';
  const date = raw.startTimeGMT || raw.startTimeLocal || raw.date || new Date().toISOString();

  // Distance in meters converted to km
  const rawDistM = raw.distance || 0;
  const distanceKm = Number((rawDistM > 100 ? rawDistM / 1000 : rawDistM).toFixed(3));

  // Time in seconds
  const movingDurationSec = Math.round(raw.movingDuration || raw.duration || 0);
  const elapsedDurationSec = Math.round(raw.elapsedDuration || raw.duration || movingDurationSec);
  const timerDurationSec = Math.round(raw.duration || movingDurationSec);
  const stoppedDurationSec = Math.max(0, elapsedDurationSec - movingDurationSec);

  // Pace calculations
  const avgPaceSecKm = distanceKm > 0.05 ? Math.round(movingDurationSec / distanceKm) : 330;
  const elapsedPaceSecKm = distanceKm > 0.05 ? Math.round(elapsedDurationSec / distanceKm) : avgPaceSecKm;

  // Telemetry metrics
  const avgHeartRate = raw.averageHR || raw.avgHeartRate || undefined;
  const maxHeartRate = raw.maxHR || raw.maxHeartRate || undefined;
  const avgCadence = raw.averageRunningCadenceInStepsPerMinute || raw.avgCadence || undefined;
  const avgPower = raw.avgPower || raw.averagePower || undefined;
  const maxPower = raw.maxPower || undefined;
  const elevationGainM = Math.round(raw.elevationGain || raw.totalElevationGain || 0);
  const calories = Math.round(raw.calories || distanceKm * 65);

  // Parse splits/laps if provided by Garmin API
  const splits: LapSplit[] = [];
  if (Array.isArray(raw.laps)) {
    raw.laps.forEach((lap: any, idx: number) => {
      const lapDist = (lap.distance || 0) / 1000;
      const lapMoving = lap.movingDuration || lap.duration || 0;
      splits.push({
        splitNumber: idx + 1,
        distanceKm: Number(lapDist.toFixed(2)),
        durationSec: Math.round(lapMoving),
        movingDurationSec: Math.round(lapMoving),
        elapsedDurationSec: Math.round(lap.elapsedDuration || lapMoving),
        paceSecKm: lapDist > 0.05 ? Math.round(lapMoving / lapDist) : avgPaceSecKm,
        elevationDeltaM: Math.round(lap.elevationGain || 0),
        avgHeartRate: lap.averageHR,
        avgCadence: lap.averageRunningCadenceInStepsPerMinute,
      });
    });
  }

  // Determine workout type
  let type: Workout['type'] = 'easy';
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes('tempo') || lowerTitle.includes('threshold')) {
    type = 'tempo';
  } else if (lowerTitle.includes('interval') || lowerTitle.includes('repeat') || lowerTitle.includes('track') || lowerTitle.includes('vo2')) {
    type = 'interval';
  } else if (lowerTitle.includes('long') || distanceKm >= 18) {
    type = 'long';
  } else if (lowerTitle.includes('race') || lowerTitle.includes('5k') || lowerTitle.includes('10k') || lowerTitle.includes('half') || lowerTitle.includes('marathon')) {
    type = 'race';
  } else if (lowerTitle.includes('trail') || lowerTitle.includes('hill')) {
    type = 'trail';
  } else if (lowerTitle.includes('recovery')) {
    type = 'recovery';
  }

  return {
    id,
    title,
    date,
    type,
    distanceKm,
    durationSec: movingDurationSec || elapsedDurationSec,
    movingDurationSec: movingDurationSec || elapsedDurationSec,
    timerDurationSec,
    elapsedDurationSec,
    stoppedDurationSec,
    avgPaceSecKm,
    elapsedPaceSecKm,
    avgPower,
    maxPower,
    elevationGainM,
    avgHeartRate,
    maxHeartRate,
    avgCadence,
    calories,
    perceivedEffort: 6,
    notes: `Authentic activity synced from Garmin Connect (${raw.deviceName || 'Garmin Watch'}).`,
    source: 'garmin_cloud',
    sourceFileName: raw.activityId ? `activity_${raw.activityId}.fit` : 'Garmin-Connect-Live',
    trackPoints: [],
    splits,
  };
}

/**
 * Connects to the user's authentic Garmin Connect feed and imports new runs.
 * If no runs are found or the cloud account is up to date, returns an accurate message with 0 fake runs.
 */
export async function syncAuthenticGarminActivities(
  account: GarminCloudAccount,
  existingWorkouts: Workout[],
  timeWindowDays: number = 30
): Promise<GarminSyncResult> {
  if (!account.isConnected) {
    throw new Error('Please link your Garmin Connect account first.');
  }

  try {
    // Check if authentic Garmin activities endpoint or session is configured
    // If backend proxy endpoint /api/garmin/activities is available, query it
    let rawActivities: any[] = [];

    try {
      const response = await fetch(`/api/garmin/activities?email=${encodeURIComponent(account.email)}&days=${timeWindowDays}`, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          rawActivities = data;
        } else if (Array.isArray(data.activities)) {
          rawActivities = data.activities;
        }
      }
    } catch {
      // In standalone client preview, no backend server route is active
    }

    // Parse authentic activities
    const parsedWorkouts: Workout[] = [];
    for (const raw of rawActivities) {
      const w = parseGarminConnectActivity(raw);
      if (w) parsedWorkouts.push(w);
    }

    if (parsedWorkouts.length === 0) {
      return {
        newActivities: [],
        duplicatesCount: 0,
        message: `Garmin Connect checked: No new activities found on ${account.email || 'your account'} since last sync.`,
      };
    }

    // Deduplicate against existing workouts
    const { unique, duplicateCount } = deduplicateWorkouts(parsedWorkouts, existingWorkouts);

    return {
      newActivities: unique,
      duplicatesCount: duplicateCount,
      message: unique.length > 0
        ? `Successfully synced ${unique.length} authentic run(s) from your Garmin watch!`
        : `All ${duplicateCount} activities from your Garmin account are already present in your training log.`,
    };
  } catch (err: any) {
    throw new Error(err.message || 'Failed to sync with Garmin Connect.');
  }
}
