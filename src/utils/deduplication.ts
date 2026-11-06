import { Workout } from '../types/workout';

/**
 * Checks if two activities represent the same physical run.
 * Evaluates whether timestamps are within 3 minutes and distance within 0.08 km.
 */
export function isSameRun(
  w1: { id?: string; date: string; distanceKm: number },
  w2: { id?: string; date: string; distanceKm: number }
): boolean {
  if (w1.id && w2.id && w1.id === w2.id) {
    return true;
  }

  const t1 = new Date(w1.date).getTime();
  const t2 = new Date(w2.date).getTime();
  const timeDiffSec = Math.abs(t1 - t2) / 1000;

  const distDiffKm = Math.abs(w1.distanceKm - w2.distanceKm);

  // If start time is within 3 minutes (180s) and distance within 80m (0.08km)
  if (timeDiffSec <= 180 && distDiffKm <= 0.08) {
    return true;
  }

  // Exact same day, same distance within 20m, and similar distance
  const day1 = new Date(w1.date).toISOString().slice(0, 10);
  const day2 = new Date(w2.date).toISOString().slice(0, 10);
  if (day1 === day2 && distDiffKm <= 0.03) {
    return true;
  }

  return false;
}

/**
 * Filters out incoming activities that already exist in the user's workout collection.
 */
export function deduplicateWorkouts(
  incoming: Workout[],
  existing: Workout[]
): {
  unique: Workout[];
  duplicateCount: number;
  duplicateTitles: string[];
} {
  const existingSet = [...existing];
  const unique: Workout[] = [];
  const duplicateTitles: string[] = [];

  for (const inc of incoming) {
    const isDuplicate = existingSet.some(ex => isSameRun(inc, ex));
    if (isDuplicate) {
      duplicateTitles.push(inc.title);
    } else {
      unique.push(inc);
      existingSet.push(inc); // also prevent duplicates within incoming batch itself
    }
  }

  return {
    unique,
    duplicateCount: duplicateTitles.length,
    duplicateTitles,
  };
}
