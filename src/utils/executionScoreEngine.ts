import { PlannedWorkout, Workout, WorkoutExecutionAnalysis, StepExecutionResult, WorkoutStep } from '../types/workout';
import { formatPace, formatDuration } from './parsers';

/**
 * Evaluates how accurately a completed run adhered to the planned workout structure.
 * Calculates the Execution Score (0 - 100%) and provides granular step-by-step diagnostics.
 */
export function analyzeWorkoutExecution(
  planned: PlannedWorkout,
  completed: Workout
): WorkoutExecutionAnalysis {
  const steps = planned.steps;
  const splits = completed.splits;
  const trackPoints = completed.trackPoints;

  const stepResults: StepExecutionResult[] = [];

  let totalStepScore = 0;
  let workIntervalCount = 0;
  let workIntervalPaceScoreSum = 0;

  // Map each planned step to actual performance segments
  // We divide the completed splits / distance among the planned steps
  let accumulatedDistKm = 0;

  steps.forEach((step, idx) => {
    const plannedDistKm = step.durationType === 'distance'
      ? step.durationValue / 1000
      : (step.durationValue / (step.targetPaceMinSecKm || 300));

    const stepStartDist = accumulatedDistKm;
    const stepEndDist = accumulatedDistKm + plannedDistKm;
    accumulatedDistKm = stepEndDist;

    // Find trackpoints within this segment window
    const segmentPoints = trackPoints.filter(
      p => p.distanceKm >= stepStartDist - 0.05 && p.distanceKm <= stepEndDist + 0.1
    );

    // Fallback to closest lap split if trackpoints are sparse
    const matchingSplit = splits[idx] || splits[splits.length - 1];

    let actualPace = matchingSplit?.paceSecKm || completed.avgPaceSecKm;
    let actualDist = matchingSplit?.distanceKm || plannedDistKm;
    let actualDur = matchingSplit?.durationSec || Math.round(actualDist * actualPace);
    let actualHr = matchingSplit?.avgHeartRate || completed.avgHeartRate;

    if (segmentPoints.length >= 2) {
      const pFirst = segmentPoints[0];
      const pLast = segmentPoints[segmentPoints.length - 1];
      const segTime = Math.max(1, pLast.time - pFirst.time);
      const segDist = Math.max(0.05, pLast.distanceKm - pFirst.distanceKm);
      actualPace = Math.round(segTime / segDist);
      actualDist = Number(segDist.toFixed(2));
      actualDur = Math.round(segTime);

      const hrs = segmentPoints.map(p => p.heartRate).filter((h): h is number => typeof h === 'number' && h > 0);
      if (hrs.length > 0) {
        actualHr = Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length);
      }
    }

    let score = 100;
    let verdict: StepExecutionResult['verdict'] = 'on_target';
    let feedback = 'Executed right on target.';

    if (step.stepType === 'interval' || step.stepType === 'steady') {
      workIntervalCount++;
      const minPace = step.targetPaceMinSecKm || 260; // faster bound
      const maxPace = step.targetPaceMaxSecKm || 275; // slower bound

      if (actualPace >= minPace && actualPace <= maxPace) {
        score = 100;
        verdict = 'perfect';
        feedback = `Nailed target pace window (${formatPace(minPace, 'km').split(' ')[0]} - ${formatPace(maxPace, 'km').split(' ')[0]}).`;
      } else if (actualPace < minPace) {
        // Ran faster than target
        const delta = minPace - actualPace;
        if (delta <= 8) {
          score = 92;
          verdict = 'too_fast';
          feedback = `Slightly hot (-${delta}s/km faster than planned). Strong push, but watch for early lactic buildup.`;
        } else {
          score = 80;
          verdict = 'too_fast';
          feedback = `Surged ${delta}s/km faster than planned. Be careful not to blow through threshold targets.`;
        }
      } else {
        // Ran slower than target
        const delta = actualPace - maxPace;
        if (delta <= 10) {
          score = 88;
          verdict = 'too_slow';
          feedback = `Missed target window by +${delta}s/km. High aerobic effort maintained.`;
        } else {
          score = 72;
          verdict = 'too_slow';
          feedback = `Fell +${delta}s/km off planned pace. Adjust recovery or target pacing for next block.`;
        }
      }
      workIntervalPaceScoreSum += score;
    } else if (step.stepType === 'recovery') {
      // For recovery, runner should slow down and allow HR to drop
      if (actualPace > 330 || (actualHr && actualHr < 148)) {
        score = 98;
        verdict = 'perfect';
        feedback = 'Disciplined recovery. Allowed heart rate and respiration to recover before next interval.';
      } else {
        score = 82;
        verdict = 'too_fast';
        feedback = 'Jogged recovery too quickly. Give your muscles time to clear lactate.';
      }
    } else {
      // Warmup / Cooldown
      score = 95;
      verdict = 'on_target';
      feedback = 'Steady progressive warmup / cooldown.';
    }

    stepResults.push({
      stepId: step.id,
      stepName: step.name,
      stepType: step.stepType,
      score,
      plannedDistanceKm: Number(plannedDistKm.toFixed(2)),
      actualDistanceKm: actualDist,
      plannedDurationSec: step.durationType === 'time' ? step.durationValue : Math.round(plannedDistKm * (step.targetPaceMinSecKm || 300)),
      actualDurationSec: actualDur,
      targetPaceMinSecKm: step.targetPaceMinSecKm,
      targetPaceMaxSecKm: step.targetPaceMaxSecKm,
      actualPaceSecKm: actualPace,
      actualAvgHr: actualHr,
      verdict,
      feedback,
    });

    totalStepScore += score;
  });

  const rawAverageScore = stepResults.length > 0 ? Math.round(totalStepScore / stepResults.length) : 85;

  // Pace score
  const paceScore = workIntervalCount > 0
    ? Math.round(workIntervalPaceScoreSum / workIntervalCount)
    : rawAverageScore;

  // Duration / Volume score
  const plannedTotalDist = planned.estimatedDistanceKm || 5.0;
  const distRatio = completed.distanceKm / Math.max(0.1, plannedTotalDist);
  const durationScore = Math.min(100, Math.round(Math.max(0, 100 - Math.abs(1 - distRatio) * 60)));

  // Discipline score
  const recoverySteps = stepResults.filter(s => s.stepType === 'recovery');
  const disciplineScore = recoverySteps.length > 0
    ? Math.round(recoverySteps.reduce((a, b) => a + b.score, 0) / recoverySteps.length)
    : 92;

  // Overall Execution Score (weighted)
  const overallScore = Math.min(100, Math.max(40, Math.round(paceScore * 0.5 + durationScore * 0.3 + disciplineScore * 0.2)));

  // Grade
  let grade: WorkoutExecutionAnalysis['grade'] = 'A';
  if (overallScore >= 95) grade = 'A+';
  else if (overallScore >= 90) grade = 'A';
  else if (overallScore >= 84) grade = 'B+';
  else if (overallScore >= 78) grade = 'B';
  else if (overallScore >= 70) grade = 'C';
  else grade = 'Needs Review';

  // Coach Feedback summary
  let coachFeedback = '';
  if (overallScore >= 92) {
    coachFeedback = `Masterclass pacing execution! You hit ${stepResults.filter(s => s.verdict === 'perfect' || s.verdict === 'on_target').length} of ${stepResults.length} target windows with outstanding interval consistency.`;
  } else if (overallScore >= 84) {
    coachFeedback = `Solid training stimulus delivered. Maintained strong aerobic focus with minor pacing variance on later repeats.`;
  } else {
    coachFeedback = `Workout completed with high training load. Pacing drifted slightly off targets; consider adjusting target zones or lengthening rest intervals next session.`;
  }

  return {
    plannedWorkoutId: planned.id,
    completedWorkoutId: completed.id,
    overallScore,
    grade,
    paceScore,
    durationScore,
    disciplineScore,
    coachFeedback,
    stepResults,
  };
}
