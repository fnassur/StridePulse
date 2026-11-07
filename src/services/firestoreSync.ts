import { collection, doc, getDocs, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Workout, UserGoals, GarminCloudAccount } from '../types/workout';

export async function fetchUserWorkoutsFromCloud(userId: string): Promise<Workout[]> {
  const path = `users/${userId}/workouts`;
  try {
    const querySnapshot = await getDocs(collection(db, path));
    const workouts: Workout[] = [];
    querySnapshot.forEach(docSnap => {
      workouts.push(docSnap.data() as Workout);
    });
    // Sort descending by date
    return workouts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return [];
  }
}

/**
 * Recursively strips undefined values, ensures fields match Firestore constraints,
 * and caps trackPoints to prevent document size limit exceeded errors.
 */
export function sanitizeWorkoutForFirestore(workout: Workout, userId: string): Record<string, any> {
  const title = (workout.title || 'Running Activity').slice(0, 140);
  const distanceKm = typeof workout.distanceKm === 'number' && !isNaN(workout.distanceKm) ? workout.distanceKm : 0;
  const durationSec = typeof workout.durationSec === 'number' && !isNaN(workout.durationSec) ? Math.round(workout.durationSec) : 0;

  // Downsample trackPoints if too large (Firestore 1MB document limit)
  let trackPoints = workout.trackPoints || [];
  if (trackPoints.length > 500) {
    const step = Math.ceil(trackPoints.length / 500);
    trackPoints = trackPoints.filter((_, i) => i % step === 0);
  }

  const raw = {
    ...workout,
    id: workout.id,
    title,
    distanceKm,
    durationSec,
    trackPoints,
    userId,
    updatedAt: new Date().toISOString(),
  };

  // Strip all undefined properties across all levels (Firestore rejects undefined)
  return JSON.parse(
    JSON.stringify(raw, (_key, value) => {
      if (value === undefined) {
        return undefined; // JSON.stringify omits undefined keys
      }
      return value;
    })
  );
}

export async function saveWorkoutToCloud(userId: string, workout: Workout): Promise<void> {
  if (!userId || !workout?.id) return;
  const path = `users/${userId}/workouts/${workout.id}`;
  try {
    const cleanData = sanitizeWorkoutForFirestore(workout, userId);
    await setDoc(doc(db, 'users', userId, 'workouts', workout.id), cleanData);
    console.log(`[Firestore] Successfully saved workout ${workout.id} to ${path}`);
  } catch (err) {
    console.error(`[Firestore] Error saving single workout ${workout.id}:`, err);
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Saves a large batch of workouts to Firestore using chunked write batches (up to 250 per commit).
 */
export async function saveBatchWorkoutsToCloud(userId: string, workouts: Workout[]): Promise<void> {
  if (!workouts.length || !userId) return;
  const CHUNK_SIZE = 250; // Firestore limit is 500 operations per batch

  for (let i = 0; i < workouts.length; i += CHUNK_SIZE) {
    const chunk = workouts.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);

    chunk.forEach(w => {
      const cleanData = sanitizeWorkoutForFirestore(w, userId);
      const ref = doc(db, 'users', userId, 'workouts', w.id);
      batch.set(ref, cleanData);
    });

    try {
      await batch.commit();
      console.log(`[Firestore] Successfully committed batch of ${chunk.length} workouts to users/${userId}/workouts`);
    } catch (err) {
      console.error(`[Firestore] Error committing batch workouts for user ${userId}:`, err);
      handleFirestoreError(err, OperationType.WRITE, `users/${userId}/workouts`);
    }
  }
}

export async function deleteWorkoutFromCloud(userId: string, workoutId: string): Promise<void> {
  const path = `users/${userId}/workouts/${workoutId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'workouts', workoutId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function fetchUserGoalsFromCloud(userId: string): Promise<UserGoals | null> {
  const path = `users/${userId}/settings/goals`;
  try {
    const docSnap = await getDocs(collection(db, `users/${userId}/settings`));
    let foundGoals: UserGoals | null = null;
    docSnap.forEach(d => {
      if (d.id === 'goals') {
        foundGoals = d.data() as UserGoals;
      }
    });
    return foundGoals;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return null;
  }
}

export async function saveGoalsToCloud(userId: string, goals: UserGoals): Promise<void> {
  const path = `users/${userId}/settings/goals`;
  try {
    await setDoc(doc(db, 'users', userId, 'settings', 'goals'), {
      ...goals,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function fetchUserGarminAccountFromCloud(userId: string): Promise<GarminCloudAccount | null> {
  const path = `users/${userId}/settings/garmin`;
  try {
    const docSnap = await getDocs(collection(db, `users/${userId}/settings`));
    let foundAccount: GarminCloudAccount | null = null;
    docSnap.forEach(d => {
      if (d.id === 'garmin') {
        foundAccount = d.data() as GarminCloudAccount;
      }
    });
    return foundAccount;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return null;
  }
}

export async function saveUserGarminAccountToCloud(userId: string, account: GarminCloudAccount): Promise<void> {
  const path = `users/${userId}/settings/garmin`;
  try {
    await setDoc(doc(db, 'users', userId, 'settings', 'garmin'), {
      ...account,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Migrate local workouts and goals into Firestore on first authenticated sign-in
 */
export async function syncLocalDataToCloud(
  userId: string,
  localWorkouts: Workout[],
  localGoals: UserGoals
): Promise<{ mergedWorkouts: Workout[]; mergedGoals: UserGoals }> {
  try {
    // 1. Fetch remote workouts
    const remoteWorkouts = await fetchUserWorkoutsFromCloud(userId);
    const remoteWorkoutMap = new Map(remoteWorkouts.map(w => [w.id, w]));

    // 2. Identify local-only workouts to upload
    const batch = writeBatch(db);
    let uploadCount = 0;

    localWorkouts.forEach(lw => {
      if (!remoteWorkoutMap.has(lw.id)) {
        const ref = doc(db, 'users', userId, 'workouts', lw.id);
        batch.set(ref, {
          ...lw,
          userId,
          updatedAt: new Date().toISOString(),
        });
        uploadCount++;
      }
    });

    if (uploadCount > 0) {
      await batch.commit();
    }

    // 3. Merge both sets
    const allWorkoutIds = new Set([
      ...localWorkouts.map(w => w.id),
      ...remoteWorkouts.map(w => w.id),
    ]);

    const mergedWorkouts: Workout[] = [];
    allWorkoutIds.forEach(id => {
      const match = remoteWorkoutMap.get(id) || localWorkouts.find(w => w.id === id);
      if (match) mergedWorkouts.push(match);
    });
    mergedWorkouts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // 4. Goals sync
    const remoteGoals = await fetchUserGoalsFromCloud(userId);
    let mergedGoals = localGoals;
    if (remoteGoals) {
      mergedGoals = { ...localGoals, ...remoteGoals };
    } else {
      await saveGoalsToCloud(userId, localGoals);
    }

    return { mergedWorkouts, mergedGoals };
  } catch (err) {
    console.warn('Error syncing local data to cloud:', err);
    return { mergedWorkouts: localWorkouts, mergedGoals: localGoals };
  }
}
