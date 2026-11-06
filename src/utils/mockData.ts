import { Workout, UserGoals, PlannedWorkout } from '../types/workout';

// Strictly empty workouts list — all activities enter via Garmin sync
export function generateSeedWorkouts(): Workout[] {
  return [];
}

export const defaultUserGoals: UserGoals = {
  weeklyDistanceKm: 40.0,
  activeRaceGoal: null,
  maxHeartRate: 185,
  restingHeartRate: 50,
  hrZones: {
    z1: [95, 120],   // Recovery
    z2: [121, 142],  // Aerobic Base
    z3: [143, 157],  // Tempo
    z4: [158, 172],  // Threshold
    z5: [173, 185],  // Anaerobic
  },
  distanceUnit: 'km',
  weekStartDay: 'monday',
};

export const defaultPlannedWorkouts: PlannedWorkout[] = [];
