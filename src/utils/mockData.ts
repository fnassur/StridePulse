import { Workout, TrackPoint, UserGoals, PlannedWorkout } from '../types/workout';
import { generateSplitsFromTrackPoints } from './parsers';

// Helper to generate realistic trackpoints along a route
function createRoutePoints(
  baseLat: number,
  baseLon: number,
  distanceKm: number,
  targetPaceSecKm: number,
  startIso: string,
  baseHr: number,
  hrDrift: number,
  baseElevation: number,
  elevationVariation: number
): TrackPoint[] {
  const points: TrackPoint[] = [];
  const totalDurationSec = Math.round(distanceKm * targetPaceSecKm);
  const stepSec = Math.max(3, Math.round(totalDurationSec / 120)); // ~120 data points
  const startTimeMs = new Date(startIso).getTime();

  for (let s = 0; s <= totalDurationSec; s += stepSec) {
    const fraction = s / totalDurationSec;
    const currentDist = Number((fraction * distanceKm).toFixed(3));

    // Curving scenic route coordinates
    const angle = fraction * Math.PI * 3.5;
    const lat = baseLat + Math.sin(angle) * (0.008 * (distanceKm / 5)) + fraction * 0.005;
    const lon = baseLon + Math.cos(angle) * (0.012 * (distanceKm / 5)) + fraction * 0.006;

    // Elevation undulation
    const elevation = Math.round(
      baseElevation + Math.sin(fraction * Math.PI * 4) * elevationVariation + Math.cos(fraction * Math.PI * 8) * (elevationVariation * 0.4)
    );

    // Heart rate with gradual cardiac drift and slight variation
    const hr = Math.round(
      baseHr + fraction * hrDrift + Math.sin(fraction * Math.PI * 6) * 4 + (Math.random() * 2 - 1)
    );

    // Cadence ~ 172-182 spm
    const cad = Math.round(174 + Math.sin(fraction * 10) * 4);

    // Instantaneous pace variation
    const pace = Math.round(targetPaceSecKm + Math.sin(fraction * Math.PI * 5) * 14);

    points.push({
      time: s,
      timestamp: new Date(startTimeMs + s * 1000).toISOString(),
      lat,
      lon,
      elevationM: elevation,
      heartRate: hr,
      cadence: cad,
      distanceKm: currentDist,
      paceSecKm: pace,
    });
  }

  return points;
}

// Generate our realistic sample Garmin activities
export function generateSeedWorkouts(): Workout[] {
  const now = new Date();

  // 1. Montgomery County Running - 6.14 mi (Nov 4, 2026)
  const dateNov4 = '2026-11-04T06:12:00.000Z';
  const pointsNov4 = createRoutePoints(37.7749, -122.4194, 9.88, 308, dateNov4, 148, 12, 35, 25);
  const splitsNov4 = generateSplitsFromTrackPoints(pointsNov4);

  // 2. Montgomery County - 6 x 3 mins VO2 - 7.34 mi (Nov 3, 2026)
  const dateNov3 = '2026-11-03T06:05:00.000Z';
  const pointsNov3 = createRoutePoints(37.7811, -122.4312, 11.81, 289, dateNov3, 166, 14, 18, 8);
  const splitsNov3 = generateSplitsFromTrackPoints(pointsNov3);

  // 3. Montgomery County Running - 6.14 mi (Nov 2, 2026)
  const dateNov2 = '2026-11-02T06:15:00.000Z';
  const pointsNov2 = createRoutePoints(37.7690, -122.4467, 9.88, 301, dateNov2, 145, 12, 45, 65);
  const splitsNov2 = generateSplitsFromTrackPoints(pointsNov2);

  // 4. Montgomery County Running - 13.01 mi (Oct 31, 2026)
  const dateOct31 = '2026-10-31T07:30:00.000Z';
  const pointsOct31 = createRoutePoints(37.7749, -122.4194, 20.94, 311, dateOct31, 146, 12, 35, 120);
  const splitsOct31 = generateSplitsFromTrackPoints(pointsOct31);

  // 5. Montgomery County Running - 6.10 mi (Oct 29, 2026)
  const dateOct29 = '2026-10-29T06:20:00.000Z';
  const pointsOct29 = createRoutePoints(37.7749, -122.4194, 9.82, 295, dateOct29, 150, 14, 35, 25);
  const splitsOct29 = generateSplitsFromTrackPoints(pointsOct29);

  // 6. Montgomery County - 5 x 6 mins - 8.73 mi (Oct 27, 2026)
  const dateOct27 = '2026-10-27T06:10:00.000Z';
  const pointsOct27 = createRoutePoints(37.8024, -122.4058, 14.05, 291, dateOct27, 162, 6, 12, 45);
  const splitsOct27 = generateSplitsFromTrackPoints(pointsOct27);

  // 7. Benchmark Garmin Run (7.06 mi / 11.362 km) - Today (Nov 5, 2026)
  const pointsFaiz = createRoutePoints(37.7850, -122.4200, 11.362, 284, '2026-11-05T05:41:00.000Z', 144, 18, 24, 59);
  const splitsFaiz = generateSplitsFromTrackPoints(pointsFaiz);

  // Additional October runs for rich history
  const date6 = '2026-10-24T06:45:00.000Z';
  const points6 = createRoutePoints(37.7749, -122.4194, 8.4, 335, date6, 136, 10, 30, 20);
  const splits6 = generateSplitsFromTrackPoints(points6);

  const date7 = '2026-10-21T07:00:00.000Z';
  const points7 = createRoutePoints(37.8200, -122.4800, 10.2, 315, date7, 154, 16, 50, 150);
  const splits7 = generateSplitsFromTrackPoints(points7);

  const date8 = '2026-10-18T08:15:00.000Z';
  const points8 = createRoutePoints(37.7700, -122.4200, 4.2, 350, date8, 128, 8, 20, 15);
  const splits8 = generateSplitsFromTrackPoints(points8);

  const date5 = '2026-10-01T06:30:00.000Z';
  const points5 = createRoutePoints(37.7800, -122.4100, 6.4, 288, date5, 166, 12, 30, 35);
  const splits5 = generateSplitsFromTrackPoints(points5);

  // Multi-year historic races for multi-year race progression comparison
  const dateCim2025 = '2025-12-07T07:00:00.000Z';
  const pointsCim2025 = createRoutePoints(38.5816, -121.4944, 42.195, 276, dateCim2025, 168, 8, 110, 60);
  const splitsCim2025 = generateSplitsFromTrackPoints(pointsCim2025);

  const dateHalf2025 = '2025-10-05T07:30:00.000Z';
  const pointsHalf2025 = createRoutePoints(37.3382, -121.8863, 21.097, 261, dateHalf2025, 172, 10, 45, 30);
  const splitsHalf2025 = generateSplitsFromTrackPoints(pointsHalf2025);

  const dateTurkey2024 = '2024-11-28T08:00:00.000Z';
  const pointsTurkey2024 = createRoutePoints(37.7749, -122.4194, 10.0, 251, dateTurkey2024, 178, 6, 20, 15);
  const splitsTurkey2024 = generateSplitsFromTrackPoints(pointsTurkey2024);

  const dateHalf2024 = '2024-11-10T06:45:00.000Z';
  const pointsHalf2024 = createRoutePoints(36.6002, -121.8947, 21.097, 265, dateHalf2024, 170, 8, 75, 40);
  const splitsHalf2024 = generateSplitsFromTrackPoints(pointsHalf2024);

  return [
    {
      id: 'activity_24974775245',
      title: 'Montgomery County Running - 7.06 mi 0:53:51',
      date: '2026-11-05T05:41:00.000Z',
      type: 'easy',
      distanceKm: 11.362, // 7.06 miles
      durationSec: 3228, // 53:48 Moving Time
      movingDurationSec: 3228, // 53:48 Moving Time
      timerDurationSec: 3231, // 53:51 Time (Timer)
      elapsedDurationSec: 3468, // 57:48 Elapsed Time
      avgPaceSecKm: 284, // 7:37 /mi moving pace (4:44 /km)
      elapsedPaceSecKm: 305, // 8:11 /mi elapsed pace (5:05 /km)
      stoppedDurationSec: 240, // 4:00 stopped / paused interval
      avgPower: 308, // 308 W Avg Power
      maxPower: 377, // 377 W Max Power
      elevationGainM: 59, // +59 m
      avgHeartRate: 144, // 144 bpm
      maxHeartRate: 160, // 160 bpm
      avgCadence: 174, // 174 spm
      calories: 773, // 773 kcal
      perceivedEffort: 6,
      notes: 'Garmin TCX file sync (activity_24974775245.tcx). Moving Time: 53:48, Time: 53:51, Elapsed Time: 57:48. Avg Moving Pace: 7:37/mi, Power: 308 W.',
      source: 'garmin_tcx',
      sourceFileName: 'activity_24974775245.tcx',
      trackPoints: pointsFaiz,
      splits: splitsFaiz,
    },
    {
      id: 'run_nov4',
      title: 'Montgomery County Running - 6.14 mi 0:50:48',
      date: dateNov4,
      type: 'easy',
      distanceKm: 9.88, // 6.14 miles
      durationSec: 3048, // 50:48
      movingDurationSec: 3048,
      timerDurationSec: 3048,
      elapsedDurationSec: 3120,
      avgPaceSecKm: 308, // 8:16 /mi
      elevationGainM: 42,
      avgHeartRate: 148,
      maxHeartRate: 162,
      avgCadence: 172,
      calories: 670,
      perceivedEffort: 6,
      notes: 'Aerobic base run through Montgomery County neighborhood trails.',
      source: 'garmin_fit',
      sourceFileName: 'activity_20261104.fit',
      trackPoints: pointsNov4,
      splits: splitsNov4,
    },
    {
      id: 'run_nov3',
      title: 'Montgomery County - 6 x 3 mins VO2 - 7.34 mi 0:56:57',
      date: dateNov3,
      type: 'interval',
      distanceKm: 11.81, // 7.34 miles
      durationSec: 3417, // 56:57
      movingDurationSec: 3417,
      timerDurationSec: 3417,
      elapsedDurationSec: 3500,
      avgPaceSecKm: 289, // 7:45 /mi
      elevationGainM: 52,
      avgHeartRate: 166,
      maxHeartRate: 184,
      avgCadence: 180,
      calories: 820,
      perceivedEffort: 9,
      notes: '6 x 3 mins VO2 max track repeats with 2 min recovery.',
      source: 'garmin_fit',
      sourceFileName: 'activity_20261103.fit',
      trackPoints: pointsNov3,
      splits: splitsNov3,
    },
    {
      id: 'run_nov2',
      title: 'Montgomery County Running - 6.14 mi 0:49:36',
      date: dateNov2,
      type: 'easy',
      distanceKm: 9.88, // 6.14 miles
      durationSec: 2976, // 49:36
      movingDurationSec: 2976,
      timerDurationSec: 2976,
      elapsedDurationSec: 3040,
      avgPaceSecKm: 301, // 8:05 /mi
      elevationGainM: 38,
      avgHeartRate: 145,
      maxHeartRate: 158,
      avgCadence: 174,
      calories: 665,
      perceivedEffort: 5,
      notes: 'Conversational aerobic run.',
      source: 'garmin_fit',
      sourceFileName: 'activity_20261102.fit',
      trackPoints: pointsNov2,
      splits: splitsNov2,
    },
    {
      id: 'run_oct31',
      title: 'Montgomery County Running - 13.01 mi 1:48:42',
      date: dateOct31,
      type: 'long',
      distanceKm: 20.94, // 13.01 miles
      durationSec: 6522, // 1:48:42
      movingDurationSec: 6522,
      timerDurationSec: 6522,
      elapsedDurationSec: 6680,
      avgPaceSecKm: 311, // 8:21 /mi
      elevationGainM: 145,
      avgHeartRate: 146,
      maxHeartRate: 164,
      avgCadence: 173,
      calories: 1420,
      perceivedEffort: 7,
      notes: 'Saturday long run. Consistent Zone 2 pacing with strong finish.',
      source: 'garmin_fit',
      sourceFileName: 'activity_20261031.fit',
      trackPoints: pointsOct31,
      splits: splitsOct31,
    },
    {
      id: 'run_oct29',
      title: 'Montgomery County Running - 6.10 mi 0:48:21',
      date: dateOct29,
      type: 'easy',
      distanceKm: 9.82, // 6.10 miles
      durationSec: 2901, // 48:21
      movingDurationSec: 2901,
      timerDurationSec: 2901,
      elapsedDurationSec: 2980,
      avgPaceSecKm: 295, // 7:55 /mi
      elevationGainM: 40,
      avgHeartRate: 150,
      maxHeartRate: 165,
      avgCadence: 176,
      calories: 675,
      perceivedEffort: 6,
      notes: 'Crisp morning aerobic run.',
      source: 'garmin_fit',
      sourceFileName: 'activity_20261029.fit',
      trackPoints: pointsOct29,
      splits: splitsOct29,
    },
    {
      id: 'run_oct27',
      title: 'Montgomery County - 5 x 6 mins - 8.73 mi 1:08:16',
      date: dateOct27,
      type: 'tempo',
      distanceKm: 14.05, // 8.73 miles
      durationSec: 4096, // 1:08:16
      movingDurationSec: 4096,
      timerDurationSec: 4096,
      elapsedDurationSec: 4200,
      avgPaceSecKm: 291, // 7:49 /mi
      elevationGainM: 65,
      avgHeartRate: 162,
      maxHeartRate: 178,
      avgCadence: 176,
      calories: 980,
      perceivedEffort: 8,
      notes: 'Threshold interval session: 5 blocks of 6 minutes with 2 min float.',
      source: 'garmin_fit',
      sourceFileName: 'activity_20261027.fit',
      trackPoints: pointsOct27,
      splits: splitsOct27,
    },
    {
      id: 'run_aerobic_flush',
      title: 'Midweek Aerobic Base & Striders',
      date: date6,
      type: 'easy',
      distanceKm: 8.4,
      durationSec: Math.round(8.4 * 335),
      avgPaceSecKm: 335, // 5:35 /km
      elevationGainM: 34,
      avgHeartRate: 136,
      maxHeartRate: 152,
      avgCadence: 170,
      calories: 570,
      perceivedEffort: 5,
      notes: 'Conversational pace through the Presidio trails with 4 post-run strides.',
      source: 'garmin_tcx',
      sourceFileName: 'presidio_flush_8.4k.tcx',
      trackPoints: points6,
      splits: splits6,
    },
    {
      id: 'run_hills_ggb',
      title: 'Golden Gate Coastal Hills',
      date: date7,
      type: 'trail',
      distanceKm: 10.2,
      durationSec: Math.round(10.2 * 315),
      avgPaceSecKm: 315, // 5:15 /km
      elevationGainM: 215,
      avgHeartRate: 154,
      maxHeartRate: 176,
      avgCadence: 173,
      calories: 780,
      perceivedEffort: 8,
      notes: 'Elevation training with sustained climbs up Marin Headlands.',
      source: 'garmin_fit',
      sourceFileName: 'headlands_trail_10k.fit',
      trackPoints: points7,
      splits: splits7,
    },
    {
      id: 'run_recovery_jog',
      title: 'Easy Recovery Flush',
      date: date8,
      type: 'recovery',
      distanceKm: 4.2,
      durationSec: Math.round(4.2 * 350),
      avgPaceSecKm: 350, // 5:50 /km
      elevationGainM: 22,
      avgHeartRate: 128,
      maxHeartRate: 140,
      avgCadence: 168,
      calories: 285,
      perceivedEffort: 3,
      notes: 'Active recovery day. Legs feeling loose and ready.',
      source: 'manual',
      trackPoints: points8,
      splits: splits8,
    },
    {
      id: 'run_tempo_5weeks_ago',
      title: 'Early Season Baseline Tempo',
      date: date5,
      type: 'tempo',
      distanceKm: 6.4,
      durationSec: Math.round(6.4 * 288),
      avgPaceSecKm: 288, // 4:48 /km
      elevationGainM: 48,
      avgHeartRate: 166,
      maxHeartRate: 179,
      avgCadence: 172,
      calories: 440,
      perceivedEffort: 9,
      notes: 'Initial fitness benchmark at the start of the training cycle.',
      source: 'garmin_fit',
      sourceFileName: '2026-10-01-tempo-6.4k.fit',
      trackPoints: points5,
      splits: splits5,
    },
    {
      id: 'race_2025_cim_marathon',
      title: '2025 California International Marathon - 26.2 mi',
      date: dateCim2025,
      type: 'race',
      distanceKm: 42.195,
      durationSec: 11662, // 3h 14m 22s
      movingDurationSec: 11662,
      timerDurationSec: 11662,
      elapsedDurationSec: 11700,
      avgPaceSecKm: 276, // 7:25 /mi
      elapsedPaceSecKm: 277,
      elevationGainM: 110,
      avgHeartRate: 168,
      maxHeartRate: 184,
      avgCadence: 178,
      calories: 2780,
      perceivedEffort: 10,
      notes: 'PR Marathon! Qualified for Boston with 3:14:22. Negative split second half.',
      source: 'garmin_fit',
      sourceFileName: 'cim_marathon_2025.fit',
      trackPoints: pointsCim2025,
      splits: splitsCim2025,
    },
    {
      id: 'race_2025_half_marathon',
      title: '2025 San Jose Rock n Roll Half Marathon - 13.1 mi',
      date: dateHalf2025,
      type: 'race',
      distanceKm: 21.097,
      durationSec: 5505, // 1h 31m 45s
      movingDurationSec: 5505,
      timerDurationSec: 5505,
      elapsedDurationSec: 5520,
      avgPaceSecKm: 261, // 7:00 /mi
      elapsedPaceSecKm: 262,
      elevationGainM: 45,
      avgHeartRate: 172,
      maxHeartRate: 186,
      avgCadence: 180,
      calories: 1420,
      perceivedEffort: 9,
      notes: 'Flat and fast tune-up race before marathon build.',
      source: 'garmin_fit',
      sourceFileName: 'sanjose_half_2025.fit',
      trackPoints: pointsHalf2025,
      splits: splitsHalf2025,
    },
    {
      id: 'race_2024_turkey_trot_10k',
      title: '2024 Thanksgiving Turkey Trot 10K - 6.2 mi',
      date: dateTurkey2024,
      type: 'race',
      distanceKm: 10.0,
      durationSec: 2510, // 41:50
      movingDurationSec: 2510,
      timerDurationSec: 2510,
      elapsedDurationSec: 2525,
      avgPaceSecKm: 251, // 6:44 /mi
      elapsedPaceSecKm: 252,
      elevationGainM: 20,
      avgHeartRate: 178,
      maxHeartRate: 190,
      avgCadence: 184,
      calories: 740,
      perceivedEffort: 10,
      notes: 'All-out 10K turkey trot PR effort.',
      source: 'garmin_tcx',
      sourceFileName: 'turkey_trot_10k_2024.tcx',
      trackPoints: pointsTurkey2024,
      splits: splitsTurkey2024,
    },
    {
      id: 'race_2024_monterey_half',
      title: '2024 Monterey Bay Half Marathon - 13.1 mi',
      date: dateHalf2024,
      type: 'race',
      distanceKm: 21.097,
      durationSec: 5590, // 1h 33m 10s
      movingDurationSec: 5590,
      timerDurationSec: 5590,
      elapsedDurationSec: 5610,
      avgPaceSecKm: 265, // 7:06 /mi
      elapsedPaceSecKm: 266,
      elevationGainM: 75,
      avgHeartRate: 170,
      maxHeartRate: 184,
      avgCadence: 178,
      calories: 1450,
      perceivedEffort: 9,
      notes: 'Coastal headwind on Pacific Grove section, strong final 5K.',
      source: 'garmin_fit',
      sourceFileName: 'monterey_half_2024.fit',
      trackPoints: pointsHalf2024,
      splits: splitsHalf2024,
    },
  ];
}

export const defaultUserGoals: UserGoals = {
  weeklyDistanceKm: 42.0,
  activeRaceGoal: {
    id: 'race_marathon_2026',
    name: 'California International Marathon',
    date: '2026-12-06',
    distanceKm: 42.195,
    targetTimeSec: 11700, // 3h 15m 00s
    targetPaceSecKm: 277, // 4:37 /km
    notes: 'Aiming for Boston Marathon qualifying time (sub-3:15)',
  },
  maxHeartRate: 188,
  restingHeartRate: 48,
  hrZones: {
    z1: [95, 124],   // Recovery
    z2: [125, 144],  // Aerobic Base
    z3: [145, 159],  // Tempo
    z4: [160, 174],  // Threshold
    z5: [175, 195],  // Anaerobic
  },
  distanceUnit: 'km',
};

export const defaultPlannedWorkouts: PlannedWorkout[] = [
  {
    id: 'plan_tempo_6k5',
    title: '6.5K Lactate Threshold Tempo',
    description: '1.5K progressive warmup, 3.5K continuous threshold block at target half-marathon pace (4:25 - 4:35/km), and 1.5K recovery cooldown.',
    type: 'tempo',
    scheduledDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    steps: [
      {
        id: 'step_1',
        name: 'Warmup Jog',
        stepType: 'warmup',
        durationType: 'distance',
        durationValue: 1500, // 1.5km
        targetType: 'pace',
        targetPaceMinSecKm: 310, // 5:10
        targetPaceMaxSecKm: 340, // 5:40
        notes: 'Easy conversational warmup',
      },
      {
        id: 'step_2',
        name: 'Threshold Work Interval',
        stepType: 'interval',
        durationType: 'distance',
        durationValue: 3500, // 3.5km
        targetType: 'pace',
        targetPaceMinSecKm: 265, // 4:25/km
        targetPaceMaxSecKm: 275, // 4:35/km
        targetHrZone: 4,
        notes: 'Hold strict threshold rhythm. Cadence 176+ spm',
      },
      {
        id: 'step_3',
        name: 'Cooldown Flush',
        stepType: 'cooldown',
        durationType: 'distance',
        durationValue: 1500, // 1.5km
        targetType: 'pace',
        targetPaceMinSecKm: 320,
        targetPaceMaxSecKm: 360,
        notes: 'Gentle aerobic flush',
      },
    ],
    estimatedDistanceKm: 6.5,
    estimatedDurationSec: 1800,
    targetPaceSummary: '3.5 km @ 4:25–4:35/km',
    status: 'planned',
  },
  {
    id: 'plan_fs_tempo_8mi',
    title: 'Tempo Run (8.00 mi)',
    description: '2 mile warm-up, 4 miles at tempo effort (6\'20"-6\'00" /mi), 2 mile cool-down.',
    type: 'tempo',
    scheduledDate: '2026-11-05T08:00:00.000Z',
    steps: [
      {
        id: 'step_fs_wu',
        name: 'Warm Up',
        stepType: 'warmup',
        durationType: 'distance',
        durationValue: 3218.69, // 2.00 mi in meters
        targetType: 'pace',
        targetPaceMinSecKm: 298, // 8'00" /mi (4'58" /km)
        targetPaceMaxSecKm: 317, // 8'30" /mi (5'17" /km)
        notes: 'Easy aerobic warm-up',
      },
      {
        id: 'step_fs_tempo',
        name: 'Training',
        stepType: 'interval',
        durationType: 'distance',
        durationValue: 6437.38, // 4.00 mi in meters
        targetType: 'pace',
        targetPaceMinSecKm: 224, // 6'00" /mi (3'44" /km)
        targetPaceMaxSecKm: 236, // 6'20" /mi (3'56" /km)
        notes: 'Controlled threshold effort. Consistent cadence.',
      },
      {
        id: 'step_fs_cd',
        name: 'Cool Down',
        stepType: 'cooldown',
        durationType: 'distance',
        durationValue: 3218.69, // 2.00 mi in meters
        targetType: 'pace',
        targetPaceMinSecKm: 298, // 8'00" /mi
        targetPaceMaxSecKm: 317, // 8'30" /mi
        notes: 'Gentle aerobic cool-down',
      },
    ],
    estimatedDistanceKm: 12.87,
    estimatedDurationSec: 3460, // ~57:40
    targetPaceSummary: '4.00 mi @ 6\'20"–6\'00" /mi',
    status: 'planned',
  },
  {
    id: 'plan_6x3min_vo2',
    title: '6 x 3 mins VO2',
    description: '1.5 mi warmup, 6 repeats of 3 minutes at 5K VO2 race effort (6:30 - 6:45/mi) with 2 min recovery, 1.5 mi cooldown.',
    type: 'interval',
    scheduledDate: '2026-11-03T08:00:00.000Z',
    steps: [
      { id: 's_v1', name: 'Warm Up', stepType: 'warmup', durationType: 'distance', durationValue: 2414, targetType: 'open' },
      { id: 's_v2', name: '3 Min VO2 Interval', stepType: 'interval', durationType: 'time', durationValue: 180, targetType: 'pace', targetPaceMinSecKm: 242, targetPaceMaxSecKm: 252 },
      { id: 's_v3', name: '2 Min Recovery', stepType: 'recovery', durationType: 'time', durationValue: 120, targetType: 'open' },
      { id: 's_v4', name: '3 Min VO2 Interval', stepType: 'interval', durationType: 'time', durationValue: 180, targetType: 'pace', targetPaceMinSecKm: 242, targetPaceMaxSecKm: 252 },
      { id: 's_v5', name: '2 Min Recovery', stepType: 'recovery', durationType: 'time', durationValue: 120, targetType: 'open' },
      { id: 's_v6', name: 'Cool Down', stepType: 'cooldown', durationType: 'distance', durationValue: 2414, targetType: 'open' },
    ],
    estimatedDistanceKm: 11.8,
    estimatedDurationSec: 3420,
    targetPaceSummary: '6x 3 min VO2 @ 6:30–6:45/mi',
    status: 'planned',
  },
  {
    id: 'plan_5x6min_threshold',
    title: '5 x 6 mins',
    description: '1.5 mi warmup, 5 blocks of 6 minutes steady threshold pace (6:55 - 7:15/mi) with 2 min recovery, 1.5 mi cooldown.',
    type: 'tempo',
    scheduledDate: '2026-10-27T08:00:00.000Z',
    steps: [
      { id: 's_t1', name: 'Warm Up', stepType: 'warmup', durationType: 'distance', durationValue: 2414, targetType: 'open' },
      { id: 's_t2', name: '6 Min Threshold', stepType: 'interval', durationType: 'time', durationValue: 360, targetType: 'pace', targetPaceMinSecKm: 258, targetPaceMaxSecKm: 270 },
      { id: 's_t3', name: '2 Min Jog Float', stepType: 'recovery', durationType: 'time', durationValue: 120, targetType: 'open' },
      { id: 's_t4', name: '6 Min Threshold', stepType: 'interval', durationType: 'time', durationValue: 360, targetType: 'pace', targetPaceMinSecKm: 258, targetPaceMaxSecKm: 270 },
      { id: 's_t5', name: 'Cool Down', stepType: 'cooldown', durationType: 'distance', durationValue: 2414, targetType: 'open' },
    ],
    estimatedDistanceKm: 14.0,
    estimatedDurationSec: 4100,
    targetPaceSummary: '5x 6 min @ 6:55–7:15/mi',
    status: 'planned',
  },
  {
    id: 'plan_5x1k_intervals',
    title: '5 x 1000m VO2 Max Repeats',
    description: 'High-intensity track intervals targeting VO2 max and turnover. 5 repeats of 1km at 5K race pace (4:05 - 4:15/km) with 90s jog recoveries.',
    type: 'interval',
    scheduledDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
    steps: [
      {
        id: 'step_int_warmup',
        name: 'Warmup + Striders',
        stepType: 'warmup',
        durationType: 'distance',
        durationValue: 1500,
        targetType: 'open',
      },
      {
        id: 'step_int_rep1',
        name: '1000m Repeat 1',
        stepType: 'interval',
        durationType: 'distance',
        durationValue: 1000,
        targetType: 'pace',
        targetPaceMinSecKm: 245, // 4:05/km
        targetPaceMaxSecKm: 255, // 4:15/km
      },
      {
        id: 'step_int_rec1',
        name: '90s Jog Recovery',
        stepType: 'recovery',
        durationType: 'time',
        durationValue: 90,
        targetType: 'open',
      },
      {
        id: 'step_int_rep2',
        name: '1000m Repeat 2',
        stepType: 'interval',
        durationType: 'distance',
        durationValue: 1000,
        targetType: 'pace',
        targetPaceMinSecKm: 245,
        targetPaceMaxSecKm: 255,
      },
      {
        id: 'step_int_rec2',
        name: '90s Jog Recovery',
        stepType: 'recovery',
        durationType: 'time',
        durationValue: 90,
        targetType: 'open',
      },
      {
        id: 'step_int_rep3',
        name: '1000m Repeat 3',
        stepType: 'interval',
        durationType: 'distance',
        durationValue: 1000,
        targetType: 'pace',
        targetPaceMinSecKm: 245,
        targetPaceMaxSecKm: 255,
      },
      {
        id: 'step_int_rec3',
        name: '90s Jog Recovery',
        stepType: 'recovery',
        durationType: 'time',
        durationValue: 90,
        targetType: 'open',
      },
      {
        id: 'step_int_cooldown',
        name: 'Cooldown Jog',
        stepType: 'cooldown',
        durationType: 'distance',
        durationValue: 1500,
        targetType: 'open',
      },
    ],
    estimatedDistanceKm: 7.0,
    estimatedDurationSec: 2100,
    targetPaceSummary: '5x 1000m @ 4:05–4:15/km (90s rest)',
    status: 'planned',
  },
  {
    id: 'plan_long_run_18k',
    title: '18K Aerobic Progression Long Run',
    description: 'Weekend long run building aerobic mitochondrial density. First 14 km strictly in Zone 2, finishing with last 4 km at marathon goal pace (4:37/km).',
    type: 'long',
    scheduledDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    steps: [
      {
        id: 'step_lr_1',
        name: 'Zone 2 Base Aerobic',
        stepType: 'steady',
        durationType: 'distance',
        durationValue: 14000,
        targetType: 'hr_zone',
        targetHrZone: 2,
        notes: 'Strict Zone 2 heart rate (< 145 bpm)',
      },
      {
        id: 'step_lr_2',
        name: 'Marathon Pace Finish',
        stepType: 'interval',
        durationType: 'distance',
        durationValue: 4000,
        targetType: 'pace',
        targetPaceMinSecKm: 275, // 4:35
        targetPaceMaxSecKm: 285, // 4:45
      },
    ],
    estimatedDistanceKm: 18.0,
    estimatedDurationSec: 5800,
    targetPaceSummary: '14 km Z2 Base + 4 km Marathon Pace',
    status: 'planned',
  },
];
