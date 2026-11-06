import { Workout, SimilarWorkoutMatch } from '../types/workout';

/**
 * Calculates aerobic efficiency index:
 * Speed (km/h) divided by Average Heart Rate, scaled by 100.
 * A higher value means the athlete produces more forward speed per heartbeat.
 */
export function calculateEfficiencyIndex(avgPaceSecKm: number, avgHr?: number): number {
  if (!avgPaceSecKm || avgPaceSecKm <= 0 || !avgHr || avgHr <= 0) return 0;
  const speedKmh = 3600 / avgPaceSecKm;
  return Number(((speedKmh / avgHr) * 100).toFixed(2));
}

/**
 * Finds and ranks historical workouts that are similar to the selected workout.
 * Looks back across the workout history for runs of similar distance or workout type.
 */
export function findSimilarWorkouts(
  targetWorkout: Workout,
  allWorkouts: Workout[],
  maxDaysAgo: number = 60
): SimilarWorkoutMatch[] {
  const targetDate = new Date(targetWorkout.date).getTime();
  const targetDist = targetWorkout.distanceKm;
  const targetPace = targetWorkout.avgPaceSecKm;
  const targetHr = targetWorkout.avgHeartRate ?? 150;
  const targetEfficiency = calculateEfficiencyIndex(targetPace, targetHr);

  const matches: SimilarWorkoutMatch[] = [];

  for (const w of allWorkouts) {
    if (w.id === targetWorkout.id) continue;

    const wDate = new Date(w.date).getTime();
    const diffTimeMs = targetDate - wDate;

    // We only compare against workouts that happened BEFORE or around this run
    const diffDays = Math.round(diffTimeMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0 || diffDays > maxDaysAgo) continue;

    // Check similarity:
    // Distance within +/- 20% OR difference within 1.5 km
    const distDiff = Math.abs(w.distanceKm - targetDist);
    const distRatio = Math.abs(w.distanceKm - targetDist) / Math.max(0.1, targetDist);

    const isSameType = w.type === targetWorkout.type;
    const isDistanceSimilar = distRatio <= 0.22 || distDiff <= 1.5;

    if (!isDistanceSimilar && !isSameType) continue;

    // Pace delta: negative = current run is faster
    const paceDelta = targetPace - w.avgPaceSecKm;

    // HR delta: negative = current run had lower heart rate
    const wHr = w.avgHeartRate ?? 150;
    const hrDelta = targetHr - wHr;

    // Efficiency delta
    const wEfficiency = calculateEfficiencyIndex(w.avgPaceSecKm, wHr);
    const efficiencyDelta = Number((targetEfficiency - wEfficiency).toFixed(2));

    // Determine verdict
    let verdict: SimilarWorkoutMatch['verdict'] = 'slower';
    if (paceDelta < 0 && hrDelta <= 0) {
      verdict = 'faster_and_lower_hr';
    } else if (paceDelta < 0 && hrDelta > 0) {
      verdict = 'faster_higher_hr';
    } else if (Math.abs(paceDelta) <= 5 && hrDelta < 0) {
      verdict = 'same_pace_lower_hr';
    } else if (paceDelta < 0) {
      verdict = 'faster_higher_hr';
    }

    matches.push({
      workout: w,
      distanceDeltaKm: Number((targetDist - w.distanceKm).toFixed(2)),
      paceDeltaSecKm: paceDelta,
      hrDelta,
      efficiencyIndex: wEfficiency,
      efficiencyDelta,
      relativeDaysAgo: diffDays,
      verdict,
    });
  }

  // Sort matches by most relevant: closest in distance, then most recent
  matches.sort((a, b) => {
    const distDiffA = Math.abs(a.distanceDeltaKm);
    const distDiffB = Math.abs(b.distanceDeltaKm);
    if (Math.abs(distDiffA - distDiffB) > 0.5) {
      return distDiffA - distDiffB;
    }
    return a.relativeDaysAgo - b.relativeDaysAgo;
  });

  return matches;
}
