import { Workout, HeartRateZones, UserGoals } from '../types/workout';

export interface WeeklySummary {
  weekStart: string; // ISO date string
  weekEnd: string;
  totalDistanceKm: number;
  totalDurationSec: number;
  totalElevationM: number;
  avgPaceSecKm: number;
  workoutCount: number;
  goalDistanceKm: number;
  progressPercent: number;
  dailyDistances: { dayName: string; dateStr: string; distanceKm: number; workouts: Workout[] }[];
}

export interface TrainingLoadStatus {
  acuteDistanceKm: number; // Last 7 days
  chronicAvgDistanceKm: number; // Avg weekly over last 28 days
  acwrRatio: number;
  status: 'under_training' | 'optimal' | 'building' | 'high_fatigue';
  label: string;
  description: string;
}

export interface HrZoneDistribution {
  zone: 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5';
  label: string;
  rangeBpm: [number, number];
  minutes: number;
  percentage: number;
}

// Get the start date of a given date's week according to user cycle preference
export function getStartOfWeek(d: Date, startDay: 'monday' | 'sunday' | 'saturday' = 'monday'): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  let diff = 0;
  if (startDay === 'monday') {
    diff = date.getDate() - day + (day === 0 ? -6 : 1);
  } else if (startDay === 'sunday') {
    diff = date.getDate() - day;
  } else if (startDay === 'saturday') {
    diff = date.getDate() - (day === 6 ? 0 : day + 1);
  }
  const start = new Date(date.setDate(diff));
  start.setHours(0, 0, 0, 0);
  return start;
}

// Retain getMondayOfWeek for backwards compatibility
export function getMondayOfWeek(d: Date): Date {
  return getStartOfWeek(d, 'monday');
}

// Compute weekly statistics for current week based on chosen weekly cycle
export function computeWeeklySummary(
  workouts: Workout[],
  goalDistanceKm: number,
  referenceDate: Date = new Date(),
  weekStartDay: 'monday' | 'sunday' | 'saturday' = 'monday'
): WeeklySummary {
  const startOfWeek = getStartOfWeek(referenceDate, weekStartDay);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  let daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  if (weekStartDay === 'sunday') {
    daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  } else if (weekStartDay === 'saturday') {
    daysOfWeek = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  }

  const dailyDistances = daysOfWeek.map((dayName, idx) => {
    const curDate = new Date(startOfWeek);
    curDate.setDate(startOfWeek.getDate() + idx);
    const dateStr = curDate.toISOString().split('T')[0];
    return {
      dayName,
      dateStr,
      distanceKm: 0,
      workouts: [] as Workout[],
    };
  });

  let totalDist = 0;
  let totalDur = 0;
  let totalEle = 0;
  const weekWorkouts: Workout[] = [];

  for (const w of workouts) {
    const wDate = new Date(w.date);
    if (wDate >= startOfWeek && wDate <= endOfWeek) {
      weekWorkouts.push(w);
      totalDist += w.distanceKm;
      totalDur += w.durationSec;
      totalEle += w.elevationGainM;

      // Assign to day in cycle
      const diffMs = wDate.getTime() - startOfWeek.getTime();
      const dayOffset = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (dayOffset >= 0 && dayOffset < 7) {
        dailyDistances[dayOffset].distanceKm = Number((dailyDistances[dayOffset].distanceKm + w.distanceKm).toFixed(2));
        dailyDistances[dayOffset].workouts.push(w);
      }
    }
  }

  const avgPace = totalDist > 0 ? Math.round(totalDur / totalDist) : 0;
  const progressPercent = goalDistanceKm > 0 ? Math.min(100, Math.round((totalDist / goalDistanceKm) * 100)) : 0;

  return {
    weekStart: startOfWeek.toISOString(),
    weekEnd: endOfWeek.toISOString(),
    totalDistanceKm: Number(totalDist.toFixed(1)),
    totalDurationSec: totalDur,
    totalElevationM: Math.round(totalEle),
    avgPaceSecKm: avgPace,
    workoutCount: weekWorkouts.length,
    goalDistanceKm,
    progressPercent,
    dailyDistances,
  };
}

// Compute 8-week history for the volume progression trend
export function computeEightWeekTrend(
  workouts: Workout[],
  referenceDate: Date = new Date(),
  weekStartDay: 'monday' | 'sunday' | 'saturday' = 'monday'
): { weekLabel: string; distanceKm: number; isCurrentWeek: boolean }[] {
  const currentStart = getStartOfWeek(referenceDate, weekStartDay);
  const weeks: { weekLabel: string; distanceKm: number; isCurrentWeek: boolean }[] = [];

  for (let i = 7; i >= 0; i--) {
    const start = new Date(currentStart);
    start.setDate(currentStart.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    const monthName = start.toLocaleDateString('en-US', { month: 'short' });
    const dayNum = start.getDate();
    const weekLabel = `${monthName} ${dayNum}`;

    let dist = 0;
    for (const w of workouts) {
      const wDate = new Date(w.date);
      if (wDate >= start && wDate <= end) {
        dist += w.distanceKm;
      }
    }

    weeks.push({
      weekLabel,
      distanceKm: Number(dist.toFixed(1)),
      isCurrentWeek: i === 0,
    });
  }

  return weeks;
}

// Compute ACWR (Acute:Chronic Workload Ratio)
export function computeTrainingLoad(workouts: Workout[], referenceDate: Date = new Date()): TrainingLoadStatus {
  const nowMs = referenceDate.getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const twentyEightDaysMs = 28 * 24 * 60 * 60 * 1000;

  let acuteDist = 0;
  let chronicDist = 0;

  for (const w of workouts) {
    const wDateMs = new Date(w.date).getTime();
    const diff = nowMs - wDateMs;

    if (diff >= 0 && diff <= sevenDaysMs) {
      acuteDist += w.distanceKm;
    }
    if (diff >= 0 && diff <= twentyEightDaysMs) {
      chronicDist += w.distanceKm;
    }
  }

  // Chronic average weekly load is total 28-day distance divided by 4
  const chronicAvgDist = chronicDist > 0 ? chronicDist / 4 : acuteDist || 30;
  const acwr = chronicAvgDist > 0 ? Number((acuteDist / chronicAvgDist).toFixed(2)) : 1.0;

  let status: TrainingLoadStatus['status'] = 'optimal';
  let label = 'Optimal Progression';
  let description = 'Workload is safely building aerobic endurance without excessive spike.';

  if (acwr < 0.8) {
    status = 'under_training';
    label = 'Recovery / Tapering';
    description = 'Training volume is reduced. Great for race-week taper or active recovery.';
  } else if (acwr <= 1.25) {
    status = 'optimal';
    label = 'Optimal Progression';
    description = 'Productive sweet spot (0.8–1.25). Fitness is steadily compounding with low injury risk.';
  } else if (acwr <= 1.5) {
    status = 'building';
    label = 'High Workload Building';
    description = 'Volume has surged (+25-50%). Focus on quality sleep, nutrition, and easy recovery days.';
  } else {
    status = 'high_fatigue';
    label = 'Overreaching / Fatigue Risk';
    description = 'Acute load exceeds chronic baseline by >50%. Consider an easy recovery run to prevent overtraining.';
  }

  return {
    acuteDistanceKm: Number(acuteDist.toFixed(1)),
    chronicAvgDistanceKm: Number(chronicAvgDist.toFixed(1)),
    acwrRatio: acwr,
    status,
    label,
    description,
  };
}

// Calculate Heart Rate Zone time distribution
export function computeHeartRateZones(workouts: Workout[], zones: HeartRateZones): HrZoneDistribution[] {
  let z1Points = 0;
  let z2Points = 0;
  let z3Points = 0;
  let z4Points = 0;
  let z5Points = 0;

  // Scan points across recent workouts
  for (const w of workouts) {
    if (!w.trackPoints) continue;
    for (const pt of w.trackPoints) {
      const hr = pt.heartRate;
      if (!hr || hr <= 0) continue;

      if (hr < zones.z1[1]) z1Points++;
      else if (hr < zones.z2[1]) z2Points++;
      else if (hr < zones.z3[1]) z3Points++;
      else if (hr < zones.z4[1]) z4Points++;
      else z5Points++;
    }
  }

  const total = Math.max(1, z1Points + z2Points + z3Points + z4Points + z5Points);

  // Each trackpoint is ~5 seconds
  const ptToMin = (pts: number) => Math.round((pts * 5) / 60);

  return [
    { zone: 'Z1', label: 'Recovery', rangeBpm: zones.z1, minutes: ptToMin(z1Points), percentage: Math.round((z1Points / total) * 100) },
    { zone: 'Z2', label: 'Aerobic Base', rangeBpm: zones.z2, minutes: ptToMin(z2Points), percentage: Math.round((z2Points / total) * 100) },
    { zone: 'Z3', label: 'Tempo', rangeBpm: zones.z3, minutes: ptToMin(z3Points), percentage: Math.round((z3Points / total) * 100) },
    { zone: 'Z4', label: 'Threshold', rangeBpm: zones.z4, minutes: ptToMin(z4Points), percentage: Math.round((z4Points / total) * 100) },
    { zone: 'Z5', label: 'Anaerobic', rangeBpm: zones.z5, minutes: ptToMin(z5Points), percentage: Math.round((z5Points / total) * 100) },
  ];
}
