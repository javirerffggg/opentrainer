/**
 * aggregators.ts
 * Client-side port of the Convex aggregation logic to gather training metrics for AI features.
 */

import { getOrCreateCurrentUser, User, Workout, Entry, Exercise } from "./local-db";

const STORAGE_KEYS = {
  USER: "ot_user",
  WORKOUTS: "ot_workouts",
  ENTRIES: "ot_entries",
  EXERCISES: "ot_exercises",
  ASSESSMENTS: "ot_assessments",
  SWAPS: "ot_swaps", // Note: we'll use ot_swaps for tracking swaps
};

function getLocalItem<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  const value = localStorage.getItem(key);
  if (!value) return defaultValue;
  try {
    return JSON.parse(value);
  } catch (_) {
    return defaultValue;
  }
}

// MET values for cardio modalities
const MODALITY_METS: Record<string, number> = {
  run: 9.8,
  treadmill: 9.0,
  bike: 8.0,
  stationary_bike: 7.0,
  row: 7.0,
  stairs: 9.0,
  elliptical: 5.0,
  jump_rope: 12.3,
  swim: 8.0,
  walk: 3.5,
  incline_walk: 6.0,
  hiit: 8.0,
};

const DEFAULT_BODYWEIGHT_KG = 70;

function convertToKg(weight: number, unit: "kg" | "lb" | undefined): number {
  if (unit === "lb") return weight * 0.453592;
  return weight;
}

function convertToKm(distance: number, unit: "m" | "km" | "mi" | undefined): number {
  if (unit === "m") return distance / 1000;
  if (unit === "mi") return distance * 1.60934;
  return distance;
}

function calculateCardioLoad(
  durationMinutes: number,
  rpe: number | undefined,
  modality: string | undefined,
  bodyweightKg: number,
  vestWeightKg: number
): number {
  const baseMET = MODALITY_METS[modality ?? ""] ?? 6.0;
  const effectiveRpe = rpe ?? 5;
  const adjustedMET = baseMET * (effectiveRpe / 5);
  const effectiveBodyweight = bodyweightKg + vestWeightKg;
  return Math.round(adjustedMET * effectiveBodyweight * (durationMinutes / 60));
}

function getWeekStart(timestamp: number): string {
  const date = new Date(timestamp);
  const dayOfWeek = date.getDay();
  date.setDate(date.getDate() - dayOfWeek);
  date.setHours(0, 0, 0, 0);
  return date.toISOString().split("T")[0];
}

// --------------------------------------------------------------------------
// Public Context Collectors
// --------------------------------------------------------------------------

export function getExerciseContext(exerciseName: string) {
  const exercises = getLocalItem<Exercise[]>(STORAGE_KEYS.EXERCISES, []);
  const exercise = exercises.find((e) => e.name === exerciseName);

  const entries = getLocalItem<Entry[]>(STORAGE_KEYS.ENTRIES, []);
  const exerciseEntries = entries
    .filter((e) => e.exerciseName === exerciseName && e.kind === "lifting")
    .sort((a, b) => b.createdAt - a.createdAt);

  const recentSessions = exerciseEntries
    .slice(0, 3)
    .map((e) => ({
      wt: e.lifting!.weight ?? 0,
      reps: e.lifting!.reps ?? 0,
      rpe: e.lifting!.rpe ?? 0,
    }));

  return {
    muscleGroups: exercise?.muscleGroups ?? [],
    equipment: exercise?.equipment?.[0] ?? "unknown",
    recentSessions,
  };
}

export function getRecentMuscleVolume(days: number) {
  const periodStart = Date.now() - days * 24 * 60 * 60 * 1000;
  const workouts = getLocalItem<Workout[]>(STORAGE_KEYS.WORKOUTS, [])
    .filter((w) => w.status === "completed" && w.startedAt >= periodStart);

  const workoutIds = new Set(workouts.map((w) => w._id));
  const entries = getLocalItem<Entry[]>(STORAGE_KEYS.ENTRIES, [])
    .filter((e) => workoutIds.has(e.workoutId));

  const exercises = getLocalItem<Exercise[]>(STORAGE_KEYS.EXERCISES, []);
  const exerciseMap = new Map(exercises.map((e) => [e.name, e]));

  const muscleVolume = new Map<string, number>();
  for (const entry of entries) {
    if (entry.kind !== "lifting") continue;
    const ex = exerciseMap.get(entry.exerciseName);
    const muscleGroups = ex?.muscleGroups ?? [];
    for (const muscle of muscleGroups) {
      muscleVolume.set(muscle, (muscleVolume.get(muscle) ?? 0) + 1);
    }
  }

  return Array.from(muscleVolume.entries())
    .map(([m, s]) => ({ m, s }))
    .sort((a, b) => b.s - a.s);
}

export function getSwapHistory(exerciseName: string) {
  const swaps = getLocalItem<any[]>(STORAGE_KEYS.SWAPS, []);
  return swaps.filter((s) => s.originalExercise === exerciseName);
}

export function getLastAssessmentSummary(): string | undefined {
  const assessments = getLocalItem<any[]>(STORAGE_KEYS.ASSESSMENTS, []);
  if (assessments.length === 0) return undefined;
  assessments.sort((a, b) => b.createdAt - a.createdAt);
  return assessments[0]?.summary;
}

// --------------------------------------------------------------------------
// Big Aggregator: aggregateWorkoutData
// --------------------------------------------------------------------------

export function aggregateWorkoutData(days: number, includeHistorical: boolean = true) {
  const now = Date.now();
  const periodStart = now - days * 24 * 60 * 60 * 1000;

  const user = getOrCreateCurrentUser();
  const userBodyweightKg = user.bodyweight
    ? convertToKg(user.bodyweight, user.bodyweightUnit)
    : DEFAULT_BODYWEIGHT_KG;

  const workouts = getLocalItem<Workout[]>(STORAGE_KEYS.WORKOUTS, [])
    .filter((w) => w.status === "completed" && w.startedAt >= periodStart);

  const workoutIds = new Set(workouts.map((w) => w._id));
  const entries = getLocalItem<Entry[]>(STORAGE_KEYS.ENTRIES, [])
    .filter((e) => workoutIds.has(e.workoutId));

  const exercises = getLocalItem<Exercise[]>(STORAGE_KEYS.EXERCISES, []);
  const exerciseMap = new Map(exercises.map((e) => [e.name, e]));

  // 1. volumeByMuscle
  const muscleStats = new Map<string, { sets: number; totalRpe: number; rpeCount: number }>();
  for (const entry of entries) {
    if (entry.kind !== "lifting") continue;
    const ex = exerciseMap.get(entry.exerciseName);
    const muscleGroups = ex?.muscleGroups ?? ["other"];
    for (const muscle of muscleGroups) {
      const existing = muscleStats.get(muscle) ?? { sets: 0, totalRpe: 0, rpeCount: 0 };
      existing.sets++;
      if (entry.lifting?.rpe) {
        existing.totalRpe += entry.lifting.rpe;
        existing.rpeCount++;
      }
      muscleStats.set(muscle, existing);
    }
  }
  const volumeByMuscle = Array.from(muscleStats.entries())
    .map(([muscle, stats]) => ({
      muscle,
      sets: stats.sets,
      avgRpe: stats.rpeCount > 0 ? Math.round((stats.totalRpe / stats.rpeCount) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.sets - a.sets);

  // 2. volumeByMuscleOverTime
  const weeklyMuscleVolume = new Map<string, Map<string, number>>();
  for (const entry of entries) {
    if (entry.kind !== "lifting") continue;
    const workout = workouts.find((w) => w._id === entry.workoutId);
    if (!workout) continue;
    const weekStart = getWeekStart(workout.startedAt);
    const ex = exerciseMap.get(entry.exerciseName);
    const muscleGroups = ex?.muscleGroups ?? ["other"];
    for (const muscle of muscleGroups) {
      if (!weeklyMuscleVolume.has(weekStart)) {
        weeklyMuscleVolume.set(weekStart, new Map());
      }
      const weekData = weeklyMuscleVolume.get(weekStart)!;
      weekData.set(muscle, (weekData.get(muscle) ?? 0) + 1);
    }
  }
  const volumeByMuscleOverTime: Array<{ muscle: string; week: string; sets: number }> = [];
  for (const [week, muscles] of weeklyMuscleVolume) {
    for (const [muscle, sets] of muscles) {
      volumeByMuscleOverTime.push({ muscle, week, sets });
    }
  }
  volumeByMuscleOverTime.sort((a, b) => a.week.localeCompare(b.week));

  // 3. exerciseTrends
  const workoutDateMap = new Map(workouts.map((w) => [w._id, w.startedAt]));
  const exerciseTrendStats = new Map<
    string,
    {
      kind: "lifting" | "cardio" | "mobility";
      sessions: Set<string>;
      totalSets: number;
      topWeight: number;
      totalRpe: number;
      rpeCount: number;
      weightHistory: Array<{ date: number; weight: number }>;
    }
  >();
  for (const entry of entries) {
    const existing = exerciseTrendStats.get(entry.exerciseName) ?? {
      kind: entry.kind,
      sessions: new Set(),
      totalSets: 0,
      topWeight: 0,
      totalRpe: 0,
      rpeCount: 0,
      weightHistory: [],
    };
    existing.sessions.add(entry.workoutId);
    if (entry.kind === "lifting" && entry.lifting) {
      existing.totalSets++;
      if (entry.lifting.weight && entry.lifting.weight > existing.topWeight) {
        existing.topWeight = entry.lifting.weight;
      }
      if (entry.lifting.rpe) {
        existing.totalRpe += entry.lifting.rpe;
        existing.rpeCount++;
      }
      if (entry.lifting.weight) {
        const workoutDate = workoutDateMap.get(entry.workoutId);
        if (workoutDate) {
          existing.weightHistory.push({ date: workoutDate, weight: entry.lifting.weight });
        }
      }
    }
    exerciseTrendStats.set(entry.exerciseName, existing);
  }
  const exerciseTrends = Array.from(exerciseTrendStats.entries())
    .map(([exercise, stats]) => {
      // Simple trend calculation
      let trend: "up" | "down" | "flat" = "flat";
      if (stats.weightHistory.length >= 2) {
        const sorted = [...stats.weightHistory].sort((a, b) => a.date - b.date);
        const mid = Math.floor(sorted.length / 2);
        const fHalf = sorted.slice(0, mid);
        const sHalf = sorted.slice(mid);
        const fAvg = fHalf.reduce((sum, w) => sum + w.weight, 0) / fHalf.length;
        const sAvg = sHalf.reduce((sum, w) => sum + w.weight, 0) / sHalf.length;
        const change = ((sAvg - fAvg) / fAvg) * 100;
        if (change > 5) trend = "up";
        else if (change < -5) trend = "down";
      }
      return {
        exercise,
        kind: stats.kind,
        sessions: stats.sessions.size,
        totalSets: stats.totalSets,
        topWeight: stats.topWeight > 0 ? stats.topWeight : undefined,
        avgRpe: stats.rpeCount > 0 ? Math.round((stats.totalRpe / stats.rpeCount) * 10) / 10 : undefined,
        trend,
      };
    })
    .filter((e) => e.sessions >= 2)
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 10);

  // 4. rpeByWorkout
  const workoutRpe = new Map<string, { totalRpe: number; count: number; date: number }>();
  for (const w of workouts) {
    workoutRpe.set(w._id, { totalRpe: 0, count: 0, date: w.startedAt });
  }
  for (const entry of entries) {
    if (entry.kind === "lifting" && entry.lifting?.rpe) {
      const wStats = workoutRpe.get(entry.workoutId);
      if (wStats) {
        wStats.totalRpe += entry.lifting.rpe;
        wStats.count++;
      }
    }
  }
  const rpeByWorkout = Array.from(workoutRpe.entries())
    .filter(([, stats]) => stats.count > 0)
    .map(([, stats]) => ({
      date: new Date(stats.date).toISOString().split("T")[0],
      avgRpe: Math.round((stats.totalRpe / stats.count) * 10) / 10,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // 5. swaps
  const swaps = getLocalItem<any[]>(STORAGE_KEYS.SWAPS, [])
    .filter((s) => s.createdAt >= periodStart);
  const swapCounts = new Map<string, { reason: string; count: number }>();
  for (const swap of swaps) {
    const key = `${swap.originalExercise}:${swap.reason}`;
    const existing = swapCounts.get(key) ?? { reason: swap.reason, count: 0 };
    existing.count++;
    swapCounts.set(key, existing);
  }
  const swapSummary = Array.from(swapCounts.entries())
    .map(([key, stats]) => ({
      exercise: key.split(":")[0],
      reason: stats.reason,
      count: stats.count,
    }))
    .filter((s) => s.count >= 2)
    .sort((a, b) => b.count - a.count);

  // 6. cardioSummary
  const cardioEntries = entries.filter((e) => e.kind === "cardio" && e.cardio);
  let cardioSummary: any = undefined;
  if (cardioEntries.length > 0) {
    let totalMinutes = 0;
    let totalLoad = 0;
    let totalDistanceKm = 0;
    let vestedMinutes = 0;
    let totalRpe = 0;
    let rpeCount = 0;

    const modalityStats = new Map<string, { minutes: number; load: number; distance: number; sessions: Set<string> }>();
    for (const entry of cardioEntries) {
      const cardio = entry.cardio!;
      const ex = exerciseMap.get(entry.exerciseName);
      const modality = ex?.modality ?? "other";
      const durationMinutes = cardio.durationSeconds / 60;
      totalMinutes += durationMinutes;

      const vestWeightKg = cardio.vestWeight ? convertToKg(cardio.vestWeight, cardio.vestWeightUnit) : 0;
      if (vestWeightKg > 0) vestedMinutes += durationMinutes;

      const rpe = cardio.rpe ?? cardio.intensity;
      if (rpe) {
        totalRpe += rpe;
        rpeCount++;
      }

      const load = calculateCardioLoad(durationMinutes, rpe, modality, userBodyweightKg, vestWeightKg);
      totalLoad += load;

      if (cardio.distance && cardio.distanceUnit) {
        totalDistanceKm += convertToKm(cardio.distance, cardio.distanceUnit);
      }

      const existing = modalityStats.get(modality) ?? { minutes: 0, load: 0, distance: 0, sessions: new Set() };
      existing.minutes += durationMinutes;
      existing.load += load;
      if (cardio.distance && cardio.distanceUnit) {
        existing.distance += convertToKm(cardio.distance, cardio.distanceUnit);
      }
      existing.sessions.add(entry.workoutId);
      modalityStats.set(modality, existing);
    }

    cardioSummary = {
      totalMinutes: Math.round(totalMinutes),
      totalLoad: Math.round(totalLoad),
      totalDistance: Math.round(totalDistanceKm * 10) / 10,
      distanceUnit: "km",
      byModality: Array.from(modalityStats.entries())
        .map(([modality, stats]) => ({
          modality,
          minutes: Math.round(stats.minutes),
          load: Math.round(stats.load),
          distance: Math.round(stats.distance * 10) / 10,
          sessions: stats.sessions.size,
        }))
        .sort((a, b) => b.load - a.load),
      vestedMinutes: Math.round(vestedMinutes),
      avgRpe: rpeCount > 0 ? Math.round((totalRpe / rpeCount) * 10) / 10 : 0,
    };
  }

  // 7. trainingLoad
  // lifting load calculation
  let liftingLoad = 0;
  const liftingLoadByWorkout = new Map<string, number>();
  const workoutDurations = new Map<string, { start: number; end: number }>();
  for (const w of workouts) {
    workoutDurations.set(w._id, {
      start: w.startedAt,
      end: w.completedAt ?? w.startedAt + 60 * 60 * 1000,
    });
  }
  const liftingWorkoutStats = new Map<string, { totalRpe: number; rpeCount: number; sets: number }>();
  for (const entry of entries) {
    if (entry.kind !== "lifting" || !entry.lifting) continue;
    const wId = entry.workoutId;
    const existing = liftingWorkoutStats.get(wId) ?? { totalRpe: 0, rpeCount: 0, sets: 0 };
    existing.sets++;
    if (entry.lifting.rpe) {
      existing.totalRpe += entry.lifting.rpe;
      existing.rpeCount++;
    }
    liftingWorkoutStats.set(wId, existing);
  }
  for (const [wId, stats] of liftingWorkoutStats) {
    const duration = workoutDurations.get(wId);
    if (!duration || stats.sets === 0) continue;
    const durationMinutes = (duration.end - duration.start) / (1000 * 60);
    const avgRpe = stats.rpeCount > 0 ? stats.totalRpe / stats.rpeCount : 6;
    const load = Math.round(durationMinutes * avgRpe * 0.8);
    liftingLoad += load;
    liftingLoadByWorkout.set(wId, load);
  }

  let cardioLoad = cardioSummary?.totalLoad ?? 0;
  const totalLoad = liftingLoad + cardioLoad;
  const liftingPercent = totalLoad > 0 ? Math.round((liftingLoad / totalLoad) * 100) : 0;
  const cardioPercent = totalLoad > 0 ? Math.round((cardioLoad / totalLoad) * 100) : 0;

  let profile: "strength_focused" | "cardio_focused" | "hybrid" | "general_fitness" = "general_fitness";
  if (totalLoad >= 100) {
    if (liftingPercent >= 70) profile = "strength_focused";
    else if (cardioPercent >= 70) profile = "cardio_focused";
    else profile = "hybrid";
  }

  const byWorkoutList: Array<{ date: string; liftingLoad: number; cardioLoad: number; totalLoad: number }> = [];
  const allWIds = new Set([...liftingLoadByWorkout.keys(), ...workoutIds]);
  for (const wId of allWIds) {
    const w = workouts.find((work) => work._id === wId);
    if (!w) continue;
    const lifting = liftingLoadByWorkout.get(wId) ?? 0;
    // Calculate cardio load for this specific workout
    let cardio = 0;
    const wEntries = entries.filter((e) => e.workoutId === wId && e.kind === "cardio" && e.cardio);
    for (const entry of wEntries) {
      const cardioObj = entry.cardio!;
      const ex = exerciseMap.get(entry.exerciseName);
      const loadVal = calculateCardioLoad(
        cardioObj.durationSeconds / 60,
        cardioObj.rpe ?? cardioObj.intensity,
        ex?.modality ?? "other",
        userBodyweightKg,
        cardioObj.vestWeight ? convertToKg(cardioObj.vestWeight, cardioObj.vestWeightUnit) : 0
      );
      cardio += loadVal;
    }
    byWorkoutList.push({
      date: new Date(w.startedAt).toISOString().split("T")[0],
      liftingLoad: lifting,
      cardioLoad: cardio,
      totalLoad: lifting + cardio,
    });
  }
  byWorkoutList.sort((a, b) => a.date.localeCompare(b.date));

  const trainingLoad = {
    totalLoad,
    liftingLoad,
    cardioLoad,
    liftingPercent,
    cardioPercent,
    profile,
    loadChangePercent: null as number | null,
    byWorkout: byWorkoutList,
  };

  // 8. exerciseNotes
  const exerciseNotes: any[] = [];
  for (const w of workouts) {
    const wDate = new Date(w.startedAt).toISOString().split("T")[0];
    // In our PWA, did we store exercise notes?
    // Let's check: entries have notes property. We can extract notes from entries!
    const wEntries = entries.filter((e) => e.workoutId === w._id && e.notes);
    for (const entry of wEntries) {
      exerciseNotes.push({
        exercise: entry.exerciseName,
        note: entry.notes,
        date: wDate,
      });
    }
  }

  // 9. Historical context
  let historicalContext: any = undefined;
  if (includeHistorical) {
    const allWorkouts = getLocalItem<Workout[]>(STORAGE_KEYS.WORKOUTS, [])
      .filter((w) => w.status === "completed")
      .sort((a, b) => a.startedAt - b.startedAt);

    if (allWorkouts.length > 0) {
      const firstWorkout = allWorkouts[0];
      const trainingAgeDays = Math.floor((now - firstWorkout.startedAt) / (24 * 60 * 60 * 1000));

      const allEntries = getLocalItem<Entry[]>(STORAGE_KEYS.ENTRIES, []);
      const completedWorkoutIds = new Set(allWorkouts.map((w) => w._id));
      const allCompletedEntries = allEntries.filter((e) => completedWorkoutIds.has(e.workoutId));

      let allTimeSets = allCompletedEntries.filter((e) => e.kind === "lifting").length;

      // monthlyFrequency
      const monthlyData = new Map<string, { workouts: number; sets: number }>();
      const threeMonthsAgo = new Date(now);
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 2);
      threeMonthsAgo.setDate(1);
      threeMonthsAgo.setHours(0, 0, 0, 0);

      // Initialize last 3 months
      for (let i = 0; i < 3; i++) {
        const d = new Date(now);
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthlyData.set(key, { workouts: 0, sets: 0 });
      }

      const workoutSets = new Map<string, number>();
      for (const entry of allCompletedEntries) {
        if (entry.kind === "lifting") {
          workoutSets.set(entry.workoutId, (workoutSets.get(entry.workoutId) ?? 0) + 1);
        }
      }

      for (const w of allWorkouts) {
        if (w.startedAt < threeMonthsAgo.getTime()) continue;
        const d = new Date(w.startedAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const existing = monthlyData.get(key);
        if (existing) {
          existing.workouts++;
          existing.sets += workoutSets.get(w._id) ?? 0;
        }
      }

      const monthlyFrequency = Array.from(monthlyData.entries())
        .map(([month, data]) => ({
          month,
          workouts: data.workouts,
          avgSetsPerWorkout: data.workouts > 0 ? Math.round(data.sets / data.workouts) : 0,
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      // consistency
      const weeklyWorkouts = new Map<string, number>();
      for (const w of allWorkouts) {
        const weekKey = getWeekStart(w.startedAt);
        weeklyWorkouts.set(weekKey, (weeklyWorkouts.get(weekKey) ?? 0) + 1);
      }
      const weeks = Array.from(weeklyWorkouts.keys()).sort();
      const avgWorkoutsPerWeek = weeks.length > 0 ? Math.round((allWorkouts.length / weeks.length) * 10) / 10 : 0;

      let currentStreak = 0;
      let longestStreak = 0;
      let tempStreak = 0;
      const currentWeek = getWeekStart(now);
      const lastWeek = getWeekStart(now - 7 * 24 * 60 * 60 * 1000);

      const allWeeks: string[] = [];
      if (weeks.length > 0) {
        const startDate = new Date(weeks[0]);
        const endDate = new Date(currentWeek);
        for (let d = startDate; d <= endDate; d.setDate(d.getDate() + 7)) {
          allWeeks.push(getWeekStart(d.getTime()));
        }
      }

      for (let i = allWeeks.length - 1; i >= 0; i--) {
        if (weeklyWorkouts.has(allWeeks[i])) {
          tempStreak++;
        } else {
          if (currentStreak === 0 && (allWeeks[i] === currentWeek || allWeeks[i] === lastWeek)) {
            continue;
          }
          if (currentStreak === 0) currentStreak = tempStreak;
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 0;
        }
      }
      if (currentStreak === 0) currentStreak = tempStreak;
      longestStreak = Math.max(longestStreak, tempStreak);

      // personalRecords
      const workoutDateMapAll = new Map(allWorkouts.map((w) => [w._id, w.startedAt]));
      const prMap = new Map<string, { topWeight: number; topWeightDate: number; sessions: Set<string> }>();
      for (const entry of allCompletedEntries) {
        if (entry.kind !== "lifting" || !entry.lifting?.weight) continue;
        const existing = prMap.get(entry.exerciseName) ?? { topWeight: 0, topWeightDate: 0, sessions: new Set() };
        existing.sessions.add(entry.workoutId);
        if (entry.lifting.weight > existing.topWeight) {
          existing.topWeight = entry.lifting.weight;
          existing.topWeightDate = workoutDateMapAll.get(entry.workoutId) ?? 0;
        }
        prMap.set(entry.exerciseName, existing);
      }
      const personalRecords = Array.from(prMap.entries())
        .filter(([, stats]) => stats.topWeight > 0)
        .sort((a, b) => b[1].sessions.size - a[1].sessions.size)
        .slice(0, 5)
        .map(([exercise, stats]) => ({
          exercise,
          topWeight: stats.topWeight,
          topWeightDate: new Date(stats.topWeightDate).toISOString().split("T")[0],
          totalSessions: stats.sessions.size,
        }));

      // muscleDistribution
      const allMuscleVolume = new Map<string, number>();
      for (const entry of allCompletedEntries) {
        if (entry.kind !== "lifting") continue;
        const ex = exerciseMap.get(entry.exerciseName);
        const muscles = ex?.muscleGroups ?? ["other"];
        for (const muscle of muscles) {
          allMuscleVolume.set(muscle, (allMuscleVolume.get(muscle) ?? 0) + 1);
        }
      }
      const muscleDistribution = Array.from(allMuscleVolume.entries())
        .map(([muscle, sets]) => ({
          muscle,
          percentage: allTimeSets > 0 ? Math.round((sets / allTimeSets) * 100) : 0,
        }))
        .sort((a, b) => b.percentage - a.percentage)
        .slice(0, 6);

      historicalContext = {
        totalWorkouts: allWorkouts.length,
        totalSets: allTimeSets,
        trainingAgeDays,
        firstWorkoutDate: new Date(firstWorkout.startedAt).toISOString().split("T")[0],
        monthlyFrequency,
        consistency: { avgWorkoutsPerWeek, currentStreakWeeks: currentStreak, longestStreakWeeks: longestStreak },
        personalRecords,
        muscleDistribution,
      };
    } else {
      historicalContext = {
        totalWorkouts: 0,
        totalSets: 0,
        trainingAgeDays: 0,
        firstWorkoutDate: new Date().toISOString().split("T")[0],
        monthlyFrequency: [],
        consistency: { avgWorkoutsPerWeek: 0, currentStreakWeeks: 0, longestStreakWeeks: 0 },
        personalRecords: [],
        muscleDistribution: [],
      };
    }
  }

  // Calculate total sets in period
  const totalSets = entries.filter((e) => e.kind === "lifting").length;

  return {
    period: {
      start: new Date(periodStart).toISOString().split("T")[0],
      end: new Date(now).toISOString().split("T")[0],
      workouts: workouts.length,
      totalSets,
    },
    volumeByMuscle,
    volumeByMuscleOverTime,
    exerciseTrends,
    rpeByWorkout,
    swapSummary,
    exerciseNotes,
    cardioSummary,
    trainingLoad,
    historicalContext,
  };
}

export function getTrainingLabPayload(days: number = 7) {
  const user = getOrCreateCurrentUser();
  const aggregated = aggregateWorkoutData(days, true);
  const previousSummary = getLastAssessmentSummary();

  const hist = aggregated.historicalContext;
  const cardio = aggregated.cardioSummary;
  const load = aggregated.trainingLoad;
  
  return {
    user: {
      g: user.goals ?? [],
      xp: user.experienceLevel ?? "intermediate",
      eq: user.equipment ?? [],
      days: user.weeklyAvailability ?? 4,
    },
    period: {
      start: aggregated.period.start,
      end: aggregated.period.end,
      n: aggregated.period.workouts,
    },
    load: load ? {
      total: load.totalLoad,
      lifting: load.liftingLoad,
      cardio: load.cardioLoad,
      liftPct: load.liftingPercent,
      cardioPct: load.cardioPercent,
      profile: load.profile,
    } : undefined,
    vol: aggregated.volumeByMuscle.slice(0, 10).map((v) => ({
      m: v.muscle,
      s: v.sets,
      r: v.avgRpe,
    })),
    cardio: cardio ? {
      mins: cardio.totalMinutes,
      dist: cardio.totalDistance,
      load: cardio.totalLoad,
      rpe: cardio.avgRpe,
      byMod: cardio.byModality.slice(0, 5).map((m: any) => ({
        mod: m.modality,
        mins: m.minutes,
        dist: m.distance,
        sess: m.sessions,
      })),
    } : undefined,
    trends: aggregated.exerciseTrends.slice(0, 8).map((t) => ({
      ex: t.exercise,
      k: t.kind === "lifting" ? "l" : "c",
      n: t.sessions,
      s: t.totalSets,
      w: t.topWeight,
      r: t.avgRpe,
      d: t.trend === "up" ? "u" : t.trend === "down" ? "d" : "f",
    })),
    swaps: aggregated.swapSummary.length > 0
      ? aggregated.swapSummary.map((s) => ({
          ex: s.exercise,
          reason: s.reason,
          n: s.count,
        }))
      : undefined,
    notes: aggregated.exerciseNotes.length > 0
      ? aggregated.exerciseNotes.map((n) => ({
          ex: n.exercise,
          txt: n.note,
          date: n.date,
        }))
      : undefined,
    hist: hist ? {
      age: hist.trainingAgeDays,
      total: hist.totalWorkouts,
      sets: hist.totalSets,
      since: hist.firstWorkoutDate,
      monthly: hist.monthlyFrequency.map((m: any) => ({
        mo: m.month,
        n: m.workouts,
        avg: m.avgSetsPerWorkout,
      })),
      cons: {
        wpw: hist.consistency.avgWorkoutsPerWeek,
        streak: hist.consistency.currentStreakWeeks,
        best: hist.consistency.longestStreakWeeks,
      },
      prs: hist.personalRecords.map((pr: any) => ({
        ex: pr.exercise,
        wt: pr.topWeight,
        date: pr.topWeightDate,
        sess: pr.totalSessions,
      })),
      dist: hist.muscleDistribution.map((d: any) => ({
        m: d.muscle,
        pct: d.percentage,
      })),
    } : undefined,
    prev: previousSummary,
    // Add raw chart fields for server response construction
    _chartVolumeByMuscle: aggregated.volumeByMuscle,
    _chartVolumeByMuscleOverTime: aggregated.volumeByMuscleOverTime,
    _chartRpeByWorkout: aggregated.rpeByWorkout,
    _chartExerciseTrends: aggregated.exerciseTrends.slice(0, 6).map((t) => ({
      exercise: t.exercise,
      sessions: t.sessions,
      trend: t.trend,
      topWeight: t.topWeight ?? 0,
      avgRpe: t.avgRpe ?? 0,
    })),
  };
}
