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
    return res;
  } catch (err) {
    // Proxy request failed, attempt direct
    const directUrl = `${DIRECT_GARMIN_URL}${endpoint}`;
    return fetch(directUrl, options);
  }
}

/**
 * Validates a Garmin Connect Personal API Key by exchanging it for an access token.
 * Garmin Connect Personal API documentation:
 * Endpoint: POST https://personal.connectapi.garmin.com/personalapitoken-service/personal-api/personal-api-key/token
 * Header: Authorization: ApiKey <your-personal-api-key>
 *
 * The endpoint returns the temporary access token (typically as a raw JWT string or JSON).
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
        'Accept': '*/*',
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return {
          isValid: false,
          error: 'Authentication failed. Please check that your Personal API Key is active and has not expired in Garmin Connect settings.',
        };
      }
      return {
        isValid: false,
        error: `Garmin API error (${response.status}). Please check your key or try again in a moment.`,
      };
    }

    const rawText = await response.text();
    let accessToken = rawText.trim();
    let expiresIn = 3600;

    // Check if response is JSON (either object or quoted string)
    try {
      const parsed = JSON.parse(rawText);
      if (typeof parsed === 'string') {
        accessToken = parsed.trim();
      } else if (parsed && typeof parsed === 'object') {
        accessToken = parsed.accessToken || parsed.access_token || parsed.token || accessToken;
        if (typeof parsed.expiresIn === 'number') expiresIn = parsed.expiresIn;
        else if (typeof parsed.expires_in === 'number') expiresIn = parsed.expires_in;
      }
    } catch {
      // Plain text token (raw JWT string from Garmin Personal API)
    }

    // Strip any surrounding quotes or whitespace
    accessToken = accessToken.replace(/^["']|["']$/g, '').trim();

    if (!accessToken) {
      return {
        isValid: false,
        error: 'Received empty response from Garmin Personal API token service.',
      };
    }

    // Try decoding JWT payload to extract actual expiration if available
    try {
      const parts = accessToken.split('.');
      if (parts.length === 3) {
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        const jwtData = JSON.parse(jsonPayload);
        if (jwtData.exp && typeof jwtData.exp === 'number') {
          const nowSec = Math.floor(Date.now() / 1000);
          expiresIn = Math.max(60, jwtData.exp - nowSec);
        }
      }
    } catch {
      // Non-critical: keep default expiresIn
    }

    return {
      isValid: true,
      accessToken,
      expiresIn,
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

export interface GarminPullOptions {
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  onProgress?: (totalFound: number, page: number, message: string) => void;
}

/**
 * Connects to Garmin Connect Personal API using the user's personal API key,
 * generates an access token, and pulls all authentic activities matching the date window
 * by automatically paginating through Garmin's history without an artificial 50-item limit.
 */
export async function pullGarminActivitiesWithPersonalKey(
  account: GarminCloudAccount,
  existingWorkouts: Workout[],
  optionsOrLimit?: GarminPullOptions | number
): Promise<GarminSyncResult> {
  const options: GarminPullOptions = typeof optionsOrLimit === 'object' && optionsOrLimit !== null
    ? optionsOrLimit
    : {};

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

  // Step 2: Auto-paginate through Garmin activity search endpoint
  // GET /activitylist-service/activities/search/activities?limit=100&start=0&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
  const pageSize = 100;
  let offset = 0;
  let page = 1;
  const maxPages = 100; // Safety guard for up to 10,000 historical activities
  const allRawItems: any[] = [];
  let hasMore = true;

  while (hasMore && page <= maxPages) {
    const params = new URLSearchParams();
    params.set('limit', pageSize.toString());
    params.set('start', offset.toString());
    if (options.startDate) params.set('startDate', options.startDate);
    if (options.endDate) params.set('endDate', options.endDate);

    const searchEndpoint = `/activitylist-service/activities/search/activities?${params.toString()}`;
    let response = await fetchGarminApi(searchEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        // Token might have expired during long sync, try re-authenticating once
        const retryToken = await validateGarminPersonalApiKey(apiKey);
        if (retryToken.isValid && retryToken.accessToken) {
          token = retryToken.accessToken;
          response = await fetchGarminApi(searchEndpoint, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
            },
          });
        }
      }
    }

    if (!response.ok) {
      if (allRawItems.length > 0) {
        // We already collected data from previous pages, proceed with what we have
        break;
      }
      throw new Error(`Garmin Connect returned status ${response.status}. Please check your key or try again.`);
    }

    const rawData = await response.json();
    let batchList: any[] = [];
    if (Array.isArray(rawData)) {
      batchList = rawData;
    } else if (rawData && Array.isArray(rawData.activities)) {
      batchList = rawData.activities;
    } else if (rawData && Array.isArray(rawData.activityList)) {
      batchList = rawData.activityList;
    }

    if (batchList.length === 0) {
      hasMore = false;
      break;
    }

    allRawItems.push(...batchList);
    options.onProgress?.(
      allRawItems.length,
      page,
      `Retrieved ${allRawItems.length} activities (Page ${page})...`
    );

    // If batch size is smaller than requested pageSize, we reached the end of history
    if (batchList.length < pageSize) {
      hasMore = false;
      break;
    }

    // Check if the oldest item in this batch is already before the requested startDate
    if (options.startDate) {
      const oldestItem = batchList[batchList.length - 1];
      const oldestDateStr = oldestItem.startTimeGMT || oldestItem.startTimeLocal || oldestItem.beginTimestamp;
      if (oldestDateStr) {
        const oldestIso = oldestDateStr.slice(0, 10);
        if (oldestIso < options.startDate) {
          hasMore = false;
          break;
        }
      }
    }

    offset += batchList.length;
    page++;
  }

  // Filter items client-side as well to ensure strict adherence to date boundaries
  let filteredItems = allRawItems;
  if (options.startDate) {
    filteredItems = filteredItems.filter(item => {
      const d = item.startTimeGMT || item.startTimeLocal || item.beginTimestamp;
      if (!d) return true;
      return d.slice(0, 10) >= options.startDate!;
    });
  }
  if (options.endDate) {
    filteredItems = filteredItems.filter(item => {
      const d = item.startTimeGMT || item.startTimeLocal || item.beginTimestamp;
      if (!d) return true;
      return d.slice(0, 10) <= options.endDate!;
    });
  }

  return processRawGarminActivities(filteredItems, existingWorkouts, options.startDate);
}

function processRawGarminActivities(
  rawData: any[],
  existingWorkouts: Workout[],
  startDate?: string
): GarminSyncResult {
  const parsedWorkouts: Workout[] = [];
  for (const item of rawData) {
    const workout = parseGarminPersonalActivity(item);
    if (workout) {
      parsedWorkouts.push(workout);
    }
  }

  if (parsedWorkouts.length === 0) {
    return {
      newActivities: [],
      duplicatesCount: 0,
      message: startDate
        ? `Garmin Connect checked: No running activities found on or after ${startDate}.`
        : 'Garmin Connect checked: No running activities found on your account.',
    };
  }

  // Deduplicate against existing workouts
  const { unique, duplicateCount } = deduplicateWorkouts(parsedWorkouts, existingWorkouts);

  const rangeNotice = startDate ? ` since ${startDate}` : '';
  return {
    newActivities: unique,
    duplicatesCount: duplicateCount,
    message: unique.length > 0
      ? `Successfully pulled ${unique.length} authentic run(s)${rangeNotice} from Garmin Connect (${duplicateCount} duplicate(s) skipped)!`
      : `All ${duplicateCount} activities${rangeNotice} are already present in your training log.`,
  };
}
