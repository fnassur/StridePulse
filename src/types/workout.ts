export type WorkoutType = 'easy' | 'tempo' | 'interval' | 'long' | 'recovery' | 'race' | 'trail';

export interface TrackPoint {
  time: number; // seconds from workout start
  timestamp?: string; // ISO date
  lat?: number;
  lon?: number;
  elevationM?: number;
  heartRate?: number;
  cadence?: number;
  distanceKm: number;
  paceSecKm: number;
}

export interface LapSplit {
  splitNumber: number;
  distanceKm: number;
  durationSec: number;
  paceSecKm: number;
  elevationDeltaM: number;
  avgHeartRate?: number;
  avgCadence?: number;
  movingDurationSec?: number;
  elapsedDurationSec?: number;
}

export interface Workout {
  id: string;
  title: string;
  date: string; // ISO date string
  type: WorkoutType;
  distanceKm: number;
  durationSec: number; // Moving duration in seconds (primary)
  movingDurationSec?: number;
  timerDurationSec?: number; // Active watch timer time (e.g. 53:51)
  elapsedDurationSec?: number; // Total elapsed clock duration in seconds (e.g. 57:48)
  avgPaceSecKm: number; // Moving pace in sec/km (primary, e.g. 7:37/mi)
  elapsedPaceSecKm?: number; // Elapsed pace in sec/km (e.g. 8:11/mi)
  stoppedDurationSec?: number; // Paused / idle time in seconds (e.g. 4:00)
  elevationGainM: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  avgCadence?: number;
  avgPower?: number; // Average Power in Watts (e.g. 308 W)
  maxPower?: number; // Max Power in Watts (e.g. 377 W)
  calories?: number;
  perceivedEffort?: number; // 1 - 10
  notes?: string;
  source: 'garmin_fit' | 'garmin_gpx' | 'garmin_tcx' | 'garmin_cloud' | 'manual';
  sourceFileName?: string;
  trackPoints: TrackPoint[];
  splits: LapSplit[];
  plannedWorkoutId?: string;
  executionScore?: number;
}

export interface GarminCloudAccount {
  isConnected: boolean;
  email: string;
  deviceName: string;
  lastSyncTime?: string;
  autoSync: boolean;
  pendingActivitiesCount: number;
  personalApiKey?: string;
  accessToken?: string;
  tokenExpiresAt?: number;
}

export type StepType = 'warmup' | 'interval' | 'recovery' | 'cooldown' | 'steady';

export interface WorkoutStep {
  id: string;
  name: string;
  stepType: StepType;
  durationType: 'distance' | 'time';
  durationValue: number; // meters (e.g. 1000) or seconds (e.g. 600)
  targetType: 'pace' | 'hr_zone' | 'open';
  targetPaceMinSecKm?: number; // e.g. 260 (4:20/km)
  targetPaceMaxSecKm?: number; // e.g. 275 (4:35/km)
  targetHrZone?: number; // 1 to 5
  notes?: string;
}

export interface PlannedWorkout {
  id: string;
  title: string;
  description: string;
  type: WorkoutType;
  scheduledDate: string; // ISO date
  steps: WorkoutStep[];
  repeatCount?: number; // for repeats block (e.g. 5x)
  repeatIntervalIndices?: number[]; // which step indices are repeated
  estimatedDistanceKm: number;
  estimatedDurationSec: number;
  targetPaceSummary: string;
  completedWorkoutId?: string;
  status: 'planned' | 'synced_to_garmin' | 'completed';
}

export interface StepExecutionResult {
  stepId: string;
  stepName: string;
  stepType: StepType;
  score: number; // 0 - 100
  plannedDistanceKm?: number;
  actualDistanceKm?: number;
  plannedDurationSec?: number;
  actualDurationSec?: number;
  targetPaceMinSecKm?: number;
  targetPaceMaxSecKm?: number;
  actualPaceSecKm?: number;
  actualAvgHr?: number;
  verdict: 'perfect' | 'on_target' | 'too_fast' | 'too_slow' | 'incomplete';
  feedback: string;
}

export interface WorkoutExecutionAnalysis {
  plannedWorkoutId: string;
  completedWorkoutId: string;
  overallScore: number; // 0 - 100
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C' | 'Needs Review';
  paceScore: number;
  durationScore: number;
  disciplineScore: number;
  coachFeedback: string;
  stepResults: StepExecutionResult[];
}

export interface HeartRateZones {
  z1: [number, number]; // Recovery (<125)
  z2: [number, number]; // Aerobic Base (125-144)
  z3: [number, number]; // Tempo (145-159)
  z4: [number, number]; // Threshold (160-174)
  z5: [number, number]; // Anaerobic (175+)
}

export interface RaceGoal {
  id: string;
  name: string;
  date: string; // ISO
  distanceKm: number;
  targetTimeSec: number;
  targetPaceSecKm: number;
  notes?: string;
}

export interface UserGoals {
  weeklyDistanceKm: number;
  activeRaceGoal: RaceGoal | null;
  maxHeartRate: number;
  restingHeartRate: number;
  hrZones: HeartRateZones;
  distanceUnit: 'km' | 'mi';
  weekStartDay?: 'monday' | 'sunday' | 'saturday';
}

export interface SimilarWorkoutMatch {
  workout: Workout;
  distanceDeltaKm: number;
  paceDeltaSecKm: number; // negative means faster
  hrDelta: number; // negative means lower HR
  efficiencyIndex: number; // speed (km/h) / avgHr * 100
  efficiencyDelta: number; // positive means improved efficiency
  relativeDaysAgo: number;
  verdict: 'faster_and_lower_hr' | 'faster_higher_hr' | 'same_pace_lower_hr' | 'slower';
}
