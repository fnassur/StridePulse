import { Workout, GarminCloudAccount, LapSplit, WorkoutType } from '../types/workout';
import { deduplicateWorkouts } from '../utils/deduplication';

export interface GarminSyncResult {
  newActivities: Workout[];
  duplicatesCount: number;
  message: string;
}

export interface GarminTokenResponse {
  accessToken: string;
  tokenType?: string;
  expiresIn?: number;
  refreshToken?: string;
}

const BASE_PROXY_URL = '/api/garmin';
const DIRECT_GARMIN_URL = 'https://personal.connectapi.garmin.com';

/**
 * Helper to make requests to Garmin Personal API, preferring the local proxy to bypass CORS,
 * with fallback to direct API if running in an environment without proxy.
 */
async function fetchGarminApi(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const proxyUrl = `${BASE_PROXY_URL}${endpoint}`;
  try {
    const res = await fetch(proxyUrl, options);
    // If proxy responds (even with 4xx/5xx from Garmin), return it
    if (res.status !== 404 && res.status !== 502) {
      return res;
    }
  } catch {
    // Proxy request failed, attempt direct
  }

  // Direct fetch fallback
  const directUrl = `${DIRECT_GARMIN_URL}${endpoint}`;
  return fetch(directUrl, options);
}

/**
 * Validates a Garmin Connect Personal API Key by attempting to generate a temporary access token.
 * Garmin Connect Personal API documentation:
 * POST /personalapitoken-service/personal-api/personal-api-key/token
 * Header: Authorization: ApiKey <your-personal-api-key>
 */
export async function validateGarminPersonalApiKey(apiKey: string): Promise<{
  isValid: boolean;
  accessToken?: string;
  expiresIn?: number;
  error?: string;
}> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return { isValid: false, error: 'Please enter a valid Personal API Key.' };
  }

  try {
    const response = await fetchGarminApi('/personalapitoken-service/personal-api/personal-api-key/token', {
      method: 'POST',
      headers: {
        'Authorization': `ApiKey ${cleanKey}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return {
          isValid: false,
          error: 'Authentication failed. Please check that your Personal API Key is active and has not expired.',
        };
      }
      return {
        isValid: false,
        error: `Garmin API error (${response.status}). Please check your key or try again in a moment.`,
      };
    }

    const data = await response.json();
    const accessToken = data.accessToken || data.access_token || data.token;

    if (!accessToken) {
      return {
        isValid: false,
        error: 'Received unexpected response format from Garmin Personal API.',
      };
    }

    return {
      isValid: true,
      accessToken,
      expiresIn: data.expiresIn || data.expires_in || 3600,
    };
  } catch (err: any) {
    return {
      isValid: false,
      error: err.message || 'Network error reaching Garmin Connect Personal API.',
    };
  }
}

/**
 * Normalizes a raw Garmin Personal API activity object into the standard StridePulse Workout schema.
 */
export function parseGarminPersonalActivity(raw: any): Workout | null {
  if (!raw) return null;

  // Filter for running activity types
  const rawType = (
    raw.activityType?.typeKey ||
    raw.activityTypeDTO?.typeKey ||
    raw.activityType ||
    raw.sportType ||
    'running'
  ).toString().toLowerCase();

  const isRunning =
    rawType.includes('run') ||
    rawType.includes('trail') ||
    rawType.includes('treadmill') ||
    rawType.includes('track');

  // Skip non-running workouts if activityType is clearly specified
  if (!isRunning && raw.activityType) {
    return null;
  }

  const id = `garmin_${raw.activityId || raw.id || Date.now()}`;
  const title = raw.activityName || raw.name || raw.title || 'Garmin Running Activity';
  const date = raw.startTimeGMT || raw.startTimeLocal || raw.beginTimestamp || new Date().toISOString();

  // Distance in meters to km
  const rawDistM = raw.distance || 0;
  const distanceKm = Number((rawDistM > 100 ? rawDistM / 1000 : rawDistM).toFixed(3));

  // Durations in seconds
  const movingDurationSec = Math.round(raw.movingDuration || raw.duration || 0);
  const elapsedDurationSec = Math.round(raw.elapsedDuration || raw.duration || movingDurationSec);
  const timerDurationSec = Math.round(raw.duration || movingDurationSec);
  const stoppedDurationSec = Math.max(0, elapsedDurationSec - movingDurationSec);

  // Moving pace as primary
  const avgPaceSecKm = distanceKm > 0.05
    ? Math.round(movingDurationSec / distanceKm)
    : (raw.averageSpeed ? Math.round(1000 / raw.averageSpeed) : 330);

  const elapsedPaceSecKm = distanceKm > 0.05
    ? Math.round(elapsedDurationSec / distanceKm)
    : avgPaceSecKm;

  // Telemetry metrics
  const avgHeartRate = raw.averageHR ? Math.round(raw.averageHR) : (raw.avgHeartRate ? Math.round(raw.avgHeartRate) : undefined);
  const maxHeartRate = raw.maxHR ? Math.round(raw.maxHR) : (raw.maxHeartRate ? Math.round(raw.maxHeartRate) : undefined);
  const avgCadence = raw.averageRunningCadenceInStepsPerMinute
    ? Math.round(raw.averageRunningCadenceInStepsPerMinute)
    : (raw.avgCadence ? Math.round(raw.avgCadence) : undefined);
  const avgPower = raw.avgPower ? Math.round(raw.avgPower) : (raw.averagePower ? Math.round(raw.averagePower) : undefined);
  const maxPower = raw.maxPower ? Math.round(raw.maxPower) : undefined;
  const elevationGainM = Math.round(raw.elevationGain || raw.totalElevationGain || 0);
  const calories = Math.round(raw.calories || distanceKm * 65);

  // Parse splits / laps if present
  const splits: LapSplit[] = [];
  const rawLaps = raw.laps || raw.splitSummaries || raw.lapDTOs;
  if (Array.isArray(rawLaps)) {
    rawLaps.forEach((lap: any, idx: number) => {
      const lapDist = (lap.distance || 0) > 100 ? (lap.distance || 0) / 1000 : (lap.distance || 0);
      const lapMoving = Math.round(lap.movingDuration || lap.duration || 0);
      splits.push({
        splitNumber: idx + 1,
        distanceKm: Number(lapDist.toFixed(2)),
        durationSec: lapMoving,
        movingDurationSec: lapMoving,
        elapsedDurationSec: Math.round(lap.elapsedDuration || lapMoving),
        paceSecKm: lapDist > 0.05 ? Math.round(lapMoving / lapDist) : avgPaceSecKm,
        elevationDeltaM: Math.round(lap.elevationGain || 0),
        avgHeartRate: lap.averageHR ? Math.round(lap.averageHR) : undefined,
        avgCadence: lap.averageRunningCadenceInStepsPerMinute ? Math.round(lap.averageRunningCadenceInStepsPerMinute) : undefined,
      });
    });
  }

  // Infer workout type
  let type: WorkoutType = 'easy';
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes('tempo') || lowerTitle.includes('threshold')) {
    type = 'tempo';
  } else if (lowerTitle.includes('interval') || lowerTitle.includes('repeat') || lowerTitle.includes('vo2') || lowerTitle.includes('track')) {
    type = 'interval';
  } else if (lowerTitle.includes('long') || distanceKm >= 18) {
    type = 'long';
  } else if (lowerTitle.includes('race') || lowerTitle.includes('marathon') || lowerTitle.includes('10k') || lowerTitle.includes('5k')) {
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
    notes: `Authentic run pulled via Garmin Connect Personal API (Activity ID: ${raw.activityId || 'N/A'}).`,
    source: 'garmin_cloud',
    sourceFileName: raw.activityId ? `garmin_personal_${raw.activityId}.fit` : 'Garmin-Personal-API',
    trackPoints: [],
    splits,
  };
}

/**
 * Connects to Garmin Connect Personal API using the user's personal API key,
 * generates an access token, fetches authentic activities, and parses them.
 */
export async function pullGarminActivitiesWithPersonalKey(
  account: GarminCloudAccount,
  existingWorkouts: Workout[],
  limit: number = 50
): Promise<GarminSyncResult> {
  const apiKey = account.personalApiKey?.trim();
  if (!apiKey) {
    throw new Error('No Garmin Personal API Key provided. Please paste your Personal API Key to sync.');
  }

  // Step 1: Obtain active access token
  let token = account.accessToken;
  const isTokenExpired = !account.tokenExpiresAt || Date.now() > account.tokenExpiresAt - 60000;

  if (!token || isTokenExpired) {
    const tokenResult = await validateGarminPersonalApiKey(apiKey);
    if (!tokenResult.isValid || !tokenResult.accessToken) {
      throw new Error(tokenResult.error || 'Failed to authenticate with your Garmin Personal API Key.');
    }
    token = tokenResult.accessToken;
  }

  // Step 2: Query Garmin activity search endpoint
  // GET /activitylist-service/activities/search/activities?limit=50&start=0
  const searchEndpoint = `/activitylist-service/activities/search/activities?limit=${limit}&start=0`;
  const response = await fetchGarminApi(searchEndpoint, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      // Token might be rejected, try re-authenticating once with the API key
      const retryToken = await validateGarminPersonalApiKey(apiKey);
      if (retryToken.isValid && retryToken.accessToken) {
        const retryRes = await fetchGarminApi(searchEndpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${retryToken.accessToken}`,
            'Accept': 'application/json',
          },
        });
        if (retryRes.ok) {
          const rawData = await retryRes.json();
          return processRawGarminActivities(rawData, existingWorkouts);
        }
      }
      throw new Error('Garmin session expired. Please verify or update your Personal API Key.');
    }
    throw new Error(`Garmin Connect returned status ${response.status}. Please try again.`);
  }

  const rawData = await response.json();
  return processRawGarminActivities(rawData, existingWorkouts);
}

function processRawGarminActivities(rawData: any, existingWorkouts: Workout[]): GarminSyncResult {
  let list: any[] = [];
  if (Array.isArray(rawData)) {
    list = rawData;
  } else if (rawData && Array.isArray(rawData.activities)) {
    list = rawData.activities;
  } else if (rawData && Array.isArray(rawData.activityList)) {
    list = rawData.activityList;
  }

  const parsedWorkouts: Workout[] = [];
  for (const item of list) {
    const workout = parseGarminPersonalActivity(item);
    if (workout) {
      parsedWorkouts.push(workout);
    }
  }

  if (parsedWorkouts.length === 0) {
    return {
      newActivities: [],
      duplicatesCount: 0,
      message: 'Garmin Connect Personal API checked: No running activities found on your account.',
    };
  }

  // Deduplicate against existing workouts
  const { unique, duplicateCount } = deduplicateWorkouts(parsedWorkouts, existingWorkouts);

  return {
    newActivities: unique,
    duplicatesCount: duplicateCount,
    message: unique.length > 0
      ? `Successfully pulled ${unique.length} authentic run(s) from your Garmin Connect account!`
      : `All ${duplicateCount} activities from your Garmin account are already present in your training log.`,
  };
}
