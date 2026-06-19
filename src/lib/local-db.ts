/**
 * local-db.ts
 * A client-side localStorage database simulating the Convex queries and mutations.
 */

// ============================================================================
// Types
// ============================================================================

export type Id<T extends string> = string & { __idType: T };

export interface User {
  _id: Id<"users">;
  clerkId: string;
  name: string;
  email: string;
  tier: "free" | "pro";
  onboardingCompleted?: boolean;
  goals?: string[];
  experienceLevel?: "beginner" | "intermediate" | "advanced";
  weeklyAvailability?: number;
  sessionDuration?: number;
  bodyweight?: number;
  bodyweightUnit?: "kg" | "lb";
  preferredUnits?: "kg" | "lb";
  equipment?: string[];
  shareToken?: string;
  createdAt: number;
}

export interface Exercise {
  _id: Id<"exercises">;
  userId?: Id<"users">;
  name: string;
  aliases?: string[];
  category: "lifting" | "cardio" | "mobility" | "other";
  muscleGroups?: string[];
  equipment?: string[];
  modality?: string;
  primaryMetric?: "duration" | "distance";
  isSystemExercise: boolean;
  createdAt: number;
}

export interface RoutineExercise {
  exerciseName: string;
  kind: "lifting" | "cardio" | "mobility";
  targetSets: number;
  targetReps: string;
  notes?: string;
}

export interface RoutineDay {
  name: string;
  focus?: string;
  exercises: RoutineExercise[];
}

export interface Routine {
  _id: Id<"routines">;
  userId: Id<"users">;
  name: string;
  description?: string;
  source: "scratch" | "ai_generated";
  days: RoutineDay[];
  createdAt: number;
  active?: boolean;
}

export interface WorkoutSummary {
  totalVolume?: number;
  totalSets?: number;
  totalDurationMinutes: number;
  exerciseCount: number;
  totalCardioDurationSeconds?: number;
  totalDistanceKm?: number;
  hasCardio: boolean;
}

export interface Workout {
  _id: Id<"workouts">;
  userId: Id<"users">;
  title: string;
  status: "in_progress" | "completed" | "cancelled";
  startedAt: number;
  completedAt?: number;
  summary?: WorkoutSummary;
  notes?: string;
}

export interface Entry {
  _id: Id<"entries">;
  workoutId: Id<"workouts">;
  userId: Id<"users">;
  clientId: string;
  exerciseId?: Id<"exercises">;
  exerciseName: string;
  kind: "lifting" | "cardio" | "mobility";
  lifting?: {
    setNumber: number;
    reps?: number;
    weight?: number;
    unit: "kg" | "lb";
    rpe?: number;
    rir?: number;
    isWarmup?: boolean;
    isBodyweight?: boolean;
    tempo?: string;
    restSeconds?: number;
  };
  cardio?: {
    mode: "steady" | "intervals";
    durationSeconds: number;
    distance?: number;
    distanceUnit?: "m" | "km" | "mi";
    avgHeartRate?: number;
    calories?: number;
    intensity?: number;
    incline?: number;
    intervals?: Array<{
      workSeconds: number;
      restSeconds: number;
      rounds: number;
    }>;
    primaryMetric?: "duration" | "distance";
    vestWeight?: number;
    vestWeightUnit?: "kg" | "lb";
    rpe?: number;
    intervalType?: "steady" | "hiit" | "tabata" | "emom" | "custom";
    sets?: Array<{
      type: "warmup" | "work" | "rest" | "cooldown";
      durationSeconds: number;
      distance?: number;
      intensity?: number;
      avgHeartRate?: number;
    }>;
  };
  mobility?: {
    reps?: number;
    holdSeconds?: number;
    sets?: number;
    perSide?: boolean;
  };
  notes?: string;
  createdAt: number;
}

export interface Assessment {
  _id: Id<"assessments">;
  userId: Id<"users">;
  subjectType: "weekly_review";
  subjectSubtype: "snapshot" | "full";
  summary: string;
  createdAt: number;
}

export interface AssessmentDetail {
  _id: Id<"assessmentDetails">;
  assessmentId: Id<"assessments">;
  userId: Id<"users">;
  report: any; // TrainingSnapshot or TrainingLabReport JSON
  createdAt: number;
}

// ============================================================================
// SYSTEM EXERCISES DATA (copied from convex/exercises.ts)
// ============================================================================

const SYSTEM_EXERCISES = [
  { name: "Bench Press", aliases: ["Flat Bench Press", "Barbell Bench Press"], category: "lifting", muscleGroups: ["chest", "triceps", "shoulders"], equipment: ["barbell", "bench"] },
  { name: "Incline Bench Press", aliases: ["Incline Barbell Press"], category: "lifting", muscleGroups: ["chest", "triceps", "shoulders"], equipment: ["barbell", "bench"] },
  { name: "Dumbbell Bench Press", aliases: ["DB Bench Press", "Flat Dumbbell Press"], category: "lifting", muscleGroups: ["chest", "triceps", "shoulders"], equipment: ["dumbbell", "bench"] },
  { name: "Incline Dumbbell Press", aliases: ["Incline DB Press"], category: "lifting", muscleGroups: ["chest", "triceps", "shoulders"], equipment: ["dumbbell", "bench"] },
  { name: "Dumbbell Fly", aliases: ["Chest Fly", "DB Fly"], category: "lifting", muscleGroups: ["chest"], equipment: ["dumbbell", "bench"] },
  { name: "Cable Fly", aliases: ["Cable Crossover"], category: "lifting", muscleGroups: ["chest"], equipment: ["cable"] },
  { name: "Push Up", aliases: ["Pushup", "Press Up"], category: "lifting", muscleGroups: ["chest", "triceps", "shoulders"], equipment: ["bodyweight"] },
  { name: "Chest Dip", aliases: ["Dip"], category: "lifting", muscleGroups: ["chest", "triceps", "shoulders"], equipment: ["bodyweight", "dip bars"] },
  { name: "Machine Chest Press", aliases: ["Chest Press Machine"], category: "lifting", muscleGroups: ["chest", "triceps", "shoulders"], equipment: ["machine"] },
  { name: "Pec Deck", aliases: ["Pec Deck Fly", "Machine Fly"], category: "lifting", muscleGroups: ["chest"], equipment: ["machine"] },
  { name: "Deadlift", aliases: ["Conventional Deadlift", "Barbell Deadlift"], category: "lifting", muscleGroups: ["back", "glutes", "hamstrings"], equipment: ["barbell"] },
  { name: "Pull Up", aliases: ["Pullup", "Chin Up"], category: "lifting", muscleGroups: ["back", "biceps"], equipment: ["bodyweight", "pull-up bar"] },
  { name: "Lat Pulldown", aliases: ["Cable Pulldown", "Wide Grip Pulldown"], category: "lifting", muscleGroups: ["back", "biceps"], equipment: ["cable"] },
  { name: "Barbell Row", aliases: ["Bent Over Row", "BB Row"], category: "lifting", muscleGroups: ["back", "biceps"], equipment: ["barbell"] },
  { name: "Dumbbell Row", aliases: ["One Arm Row", "DB Row", "Single Arm Row"], category: "lifting", muscleGroups: ["back", "biceps"], equipment: ["dumbbell"] },
  { name: "Cable Row", aliases: ["Seated Cable Row", "Seated Row"], category: "lifting", muscleGroups: ["back", "biceps"], equipment: ["cable"] },
  { name: "T-Bar Row", aliases: ["T Bar Row", "Landmine Row"], category: "lifting", muscleGroups: ["back", "biceps"], equipment: ["barbell", "landmine"] },
  { name: "Face Pull", aliases: ["Cable Face Pull"], category: "lifting", muscleGroups: ["back", "shoulders"], equipment: ["cable"] },
  { name: "Overhead Press", aliases: ["OHP", "Shoulder Press", "Military Press"], category: "lifting", muscleGroups: ["shoulders", "triceps"], equipment: ["barbell"] },
  { name: "Dumbbell Shoulder Press", aliases: ["DB Shoulder Press", "Seated Dumbbell Press"], category: "lifting", muscleGroups: ["shoulders", "triceps"], equipment: ["dumbbell"] },
  { name: "Lateral Raise", aliases: ["Side Raise", "Dumbbell Lateral Raise"], category: "lifting", muscleGroups: ["shoulders"], equipment: ["dumbbell"] },
  { name: "Front Raise", aliases: ["Dumbbell Front Raise"], category: "lifting", muscleGroups: ["shoulders"], equipment: ["dumbbell"] },
  { name: "Rear Delt Fly", aliases: ["Reverse Fly", "Rear Delt Raise"], category: "lifting", muscleGroups: ["shoulders", "back"], equipment: ["dumbbell"] },
  { name: "Arnold Press", aliases: ["Arnold Dumbbell Press"], category: "lifting", muscleGroups: ["shoulders", "triceps"], equipment: ["dumbbell"] },
  { name: "Upright Row", aliases: ["Barbell Upright Row"], category: "lifting", muscleGroups: ["shoulders", "traps"], equipment: ["barbell"] },
  { name: "Shrug", aliases: ["Barbell Shrug", "Dumbbell Shrug"], category: "lifting", muscleGroups: ["traps"], equipment: ["barbell", "dumbbell"] },
  { name: "Barbell Curl", aliases: ["BB Curl", "Standing Barbell Curl"], category: "lifting", muscleGroups: ["biceps"], equipment: ["barbell"] },
  { name: "Dumbbell Curl", aliases: ["DB Curl", "Bicep Curl"], category: "lifting", muscleGroups: ["biceps"], equipment: ["dumbbell"] },
  { name: "Hammer Curl", aliases: ["Dumbbell Hammer Curl"], category: "lifting", muscleGroups: ["biceps", "forearms"], equipment: ["dumbbell"] },
  { name: "Preacher Curl", aliases: ["EZ Bar Preacher Curl"], category: "lifting", muscleGroups: ["biceps"], equipment: ["barbell", "bench"] },
  { name: "Incline Dumbbell Curl", aliases: ["Incline Curl"], category: "lifting", muscleGroups: ["biceps"], equipment: ["dumbbell", "bench"] },
  { name: "Cable Curl", aliases: ["Cable Bicep Curl"], category: "lifting", muscleGroups: ["biceps"], equipment: ["cable"] },
  { name: "Concentration Curl", aliases: ["Seated Concentration Curl"], category: "lifting", muscleGroups: ["biceps"], equipment: ["dumbbell"] },
  { name: "Tricep Pushdown", aliases: ["Cable Pushdown", "Rope Pushdown"], category: "lifting", muscleGroups: ["triceps"], equipment: ["cable"] },
  { name: "Skull Crusher", aliases: ["Lying Tricep Extension", "French Press"], category: "lifting", muscleGroups: ["triceps"], equipment: ["barbell", "dumbbell"] },
  { name: "Overhead Tricep Extension", aliases: ["Tricep Extension", "French Press"], category: "lifting", muscleGroups: ["triceps"], equipment: ["dumbbell", "cable"] },
  { name: "Close Grip Bench Press", aliases: ["CGBP"], category: "lifting", muscleGroups: ["triceps", "chest"], equipment: ["barbell", "bench"] },
  { name: "Tricep Dip", aliases: ["Bench Dip", "Chair Dip"], category: "lifting", muscleGroups: ["triceps"], equipment: ["bodyweight"] },
  { name: "Diamond Push Up", aliases: ["Close Grip Push Up"], category: "lifting", muscleGroups: ["triceps", "chest"], equipment: ["bodyweight"] },
  { name: "Squat", aliases: ["Back Squat", "Barbell Squat", "Air Squat"], category: "lifting", muscleGroups: ["quads", "glutes", "hamstrings"], equipment: ["barbell", "bodyweight"] },
  { name: "Front Squat", aliases: ["Barbell Front Squat"], category: "lifting", muscleGroups: ["quads", "glutes"], equipment: ["barbell"] },
  { name: "Leg Press", aliases: ["Machine Leg Press"], category: "lifting", muscleGroups: ["quads", "glutes"], equipment: ["machine"] },
  { name: "Leg Extension", aliases: ["Machine Leg Extension"], category: "lifting", muscleGroups: ["quads"], equipment: ["machine"] },
  { name: "Hack Squat", aliases: ["Machine Hack Squat"], category: "lifting", muscleGroups: ["quads", "glutes"], equipment: ["machine"] },
  { name: "Goblet Squat", aliases: ["Dumbbell Goblet Squat"], category: "lifting", muscleGroups: ["quads", "glutes"], equipment: ["dumbbell", "bodyweight"] },
  { name: "Bulgarian Split Squat", aliases: ["Rear Foot Elevated Split Squat"], category: "lifting", muscleGroups: ["quads", "glutes"], equipment: ["dumbbell", "bench", "bodyweight"] },
  { name: "Lunge", aliases: ["Walking Lunge", "Dumbbell Lunge"], category: "lifting", muscleGroups: ["quads", "glutes"], equipment: ["dumbbell", "bodyweight"] },
  { name: "Romanian Deadlift", aliases: ["RDL", "Stiff Leg Deadlift"], category: "lifting", muscleGroups: ["hamstrings", "glutes"], equipment: ["barbell", "dumbbell"] },
  { name: "Leg Curl", aliases: ["Lying Leg Curl", "Hamstring Curl"], category: "lifting", muscleGroups: ["hamstrings"], equipment: ["machine"] },
  { name: "Seated Leg Curl", aliases: ["Seated Hamstring Curl"], category: "lifting", muscleGroups: ["hamstrings"], equipment: ["machine"] },
  { name: "Hip Thrust", aliases: ["Barbell Hip Thrust", "Glute Bridge"], category: "lifting", muscleGroups: ["glutes", "hamstrings"], equipment: ["barbell", "bench", "bodyweight"] },
  { name: "Glute Bridge", aliases: ["Bodyweight Glute Bridge"], category: "lifting", muscleGroups: ["glutes"], equipment: ["bodyweight"] },
  { name: "Good Morning", aliases: ["Barbell Good Morning"], category: "lifting", muscleGroups: ["hamstrings", "glutes", "back"], equipment: ["barbell"] },
  { name: "Sumo Deadlift", aliases: ["Wide Stance Deadlift"], category: "lifting", muscleGroups: ["glutes", "hamstrings", "quads"], equipment: ["barbell"] },
  { name: "Standing Calf Raise", aliases: ["Calf Raise", "Machine Calf Raise"], category: "lifting", muscleGroups: ["calves"], equipment: ["machine", "bodyweight"] },
  { name: "Seated Calf Raise", aliases: ["Seated Calf Machine"], category: "lifting", muscleGroups: ["calves"], equipment: ["machine"] },
  { name: "Plank", aliases: ["Front Plank"], category: "lifting", muscleGroups: ["core"], equipment: ["bodyweight"] },
  { name: "Crunch", aliases: ["Ab Crunch"], category: "lifting", muscleGroups: ["core"], equipment: ["bodyweight"] },
  { name: "Leg Raise", aliases: ["Hanging Leg Raise", "Lying Leg Raise"], category: "lifting", muscleGroups: ["core"], equipment: ["bodyweight"] },
  { name: "Russian Twist", aliases: ["Seated Russian Twist"], category: "lifting", muscleGroups: ["core"], equipment: ["bodyweight", "dumbbell"] },
  { name: "Ab Wheel Rollout", aliases: ["Ab Roller"], category: "lifting", muscleGroups: ["core"], equipment: ["ab wheel"] },
  { name: "Cable Crunch", aliases: ["Kneeling Cable Crunch"], category: "lifting", muscleGroups: ["core"], equipment: ["cable"] },
  { name: "Dead Bug", aliases: [], category: "lifting", muscleGroups: ["core"], equipment: ["bodyweight"] },
  { name: "Mountain Climber", aliases: [], category: "lifting", muscleGroups: ["core"], equipment: ["bodyweight"] },
  { name: "Running", aliases: ["Run", "Jogging", "Outdoor Run"], category: "cardio", muscleGroups: [], equipment: [], modality: "run", primaryMetric: "distance" },
  { name: "Treadmill", aliases: ["Treadmill Run", "Indoor Run"], category: "cardio", muscleGroups: [], equipment: [], modality: "treadmill", primaryMetric: "duration" },
  { name: "Cycling", aliases: ["Bike", "Outdoor Bike"], category: "cardio", muscleGroups: [], equipment: [], modality: "bike", primaryMetric: "distance" },
  { name: "Stationary Bike", aliases: ["Indoor Bike", "Spin Bike"], category: "cardio", muscleGroups: [], equipment: [], modality: "stationary_bike", primaryMetric: "duration" },
  { name: "Rowing", aliases: ["Row", "Rowing Machine", "Erg"], category: "cardio", muscleGroups: [], equipment: [], modality: "row", primaryMetric: "distance" },
  { name: "Stair Climber", aliases: ["Stair Stepper", "StairMaster"], category: "cardio", muscleGroups: [], equipment: [], modality: "stairs", primaryMetric: "duration" },
  { name: "Elliptical", aliases: ["Elliptical Trainer"], category: "cardio", muscleGroups: [], equipment: [], modality: "elliptical", primaryMetric: "duration" },
  { name: "Jump Rope", aliases: ["Skipping"], category: "cardio", muscleGroups: [], equipment: [], modality: "jump_rope", primaryMetric: "duration" },
  { name: "Swimming", aliases: ["Swim"], category: "cardio", muscleGroups: [], equipment: [], modality: "swim", primaryMetric: "distance" },
  { name: "Walking", aliases: ["Walk", "Outdoor Walk"], category: "cardio", muscleGroups: [], equipment: [], modality: "walk", primaryMetric: "distance" },
  { name: "Incline Walking", aliases: ["Treadmill Walk", "Indoor Walk"], category: "cardio", muscleGroups: [], equipment: [], modality: "incline_walk", primaryMetric: "duration" },
  { name: "HIIT", aliases: ["High Intensity Interval Training", "Interval Training"], category: "cardio", muscleGroups: [], equipment: [], modality: "hiit", primaryMetric: "duration" },
  { name: "Foam Rolling", aliases: ["Foam Roll"], category: "mobility", muscleGroups: [], equipment: ["foam roller"] },
  { name: "Stretching", aliases: ["Static Stretch"], category: "mobility", muscleGroups: [], equipment: ["bodyweight"] },
];

// ============================================================================
// Pub/Sub Observer Pattern
// ============================================================================

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notify() {
  if (typeof window !== "undefined") {
    listeners.forEach((l) => {
      try {
        l();
      } catch (err) {
        console.error("Error in DB listener", err);
      }
    });
  }
}

// ============================================================================
// Core Database Helpers (LocalStorage Wrapper)
// ============================================================================

function generateId<T extends string>(prefix: T): Id<T> {
  return `${prefix}_${Math.random().toString(36).substr(2, 9)}_${Date.now()}` as Id<T>;
}

const STORAGE_KEYS = {
  USER: "ot_user",
  WORKOUTS: "ot_workouts",
  ENTRIES: "ot_entries",
  ROUTINES: "ot_routines",
  EXERCISES: "ot_exercises",
  ASSESSMENTS: "ot_assessments",
  ASSESSMENT_DETAILS: "ot_assessment_details",
};

// Safe JSON Parse/Stringify
function getLocalItem<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  const value = localStorage.getItem(key);
  if (!value) return defaultValue;
  try {
    return JSON.parse(value);
  } catch (err) {
    console.error("Failed to parse localStorage key", key, err);
    return defaultValue;
  }
}

function setLocalItem<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

// Initialize Tables
export function getOrCreateCurrentUser(): User {
  const defaultUser: User = {
    _id: generateId("users"),
    clerkId: "mock-clerk-user",
    name: "Usuario Local",
    email: "local@opentrainer.app",
    tier: "pro", // Default to pro so AI alpha features work
    onboardingCompleted: false,
    createdAt: Date.now(),
  };

  const user = getLocalItem<User | null>(STORAGE_KEYS.USER, null);
  if (!user) {
    setLocalItem(STORAGE_KEYS.USER, defaultUser);
    // Seed default system exercises if they are empty
    seedSystemExercisesSync();
    return defaultUser;
  }
  return user;
}

function seedSystemExercisesSync() {
  const exercises = getLocalItem<Exercise[]>(STORAGE_KEYS.EXERCISES, []);
  if (exercises.length === 0) {
    const now = Date.now();
    const system = SYSTEM_EXERCISES.map((ex) => ({
      _id: generateId("exercises"),
      name: ex.name,
      aliases: ex.aliases ? [...ex.aliases] : undefined,
      category: ex.category as any,
      muscleGroups: ex.muscleGroups ? [...ex.muscleGroups] : undefined,
      equipment: ex.equipment ? [...ex.equipment] : undefined,
      modality: (ex as any).modality,
      primaryMetric: (ex as any).primaryMetric,
      isSystemExercise: true,
      createdAt: now,
    }));
    setLocalItem(STORAGE_KEYS.EXERCISES, system);
  }
}

// ============================================================================
// Queries and Mutations Logic Mapped to Convex Endpoints
// ============================================================================

export const localDb = {
  // --------------------------------------------------------------------------
  // Users
  // --------------------------------------------------------------------------
  "users:getCurrentUser": () => {
    return getOrCreateCurrentUser();
  },

  "users:updateOnboarding": (args: {
    goals?: string[];
    experienceLevel?: "beginner" | "intermediate" | "advanced";
    weeklyAvailability?: number;
    sessionDuration?: number;
    equipment?: string[];
  }) => {
    const user = getOrCreateCurrentUser();
    const updated = { ...user, ...args };
    setLocalItem(STORAGE_KEYS.USER, updated);
    notify();
    return updated;
  },

  "users:updatePreferences": (args: {
    bodyweight?: number;
    bodyweightUnit?: "kg" | "lb";
    preferredUnits?: "kg" | "lb";
  }) => {
    const user = getOrCreateCurrentUser();
    const updated = { ...user, ...args };
    setLocalItem(STORAGE_KEYS.USER, updated);
    notify();
    return updated;
  },

  "users:completeOnboarding": () => {
    const user = getOrCreateCurrentUser();
    const updated = { ...user, onboardingCompleted: true };
    setLocalItem(STORAGE_KEYS.USER, updated);
    notify();
    return updated;
  },

  "users:generateShareToken": () => {
    const user = getOrCreateCurrentUser();
    const token = `st_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
    const updated = { ...user, shareToken: token };
    setLocalItem(STORAGE_KEYS.USER, updated);
    notify();
    return token;
  },

  "users:revokeShareToken": () => {
    const user = getOrCreateCurrentUser();
    const updated = { ...user, shareToken: undefined };
    setLocalItem(STORAGE_KEYS.USER, updated);
    notify();
    return true;
  },

  "users:deleteAccount": () => {
    if (typeof window !== "undefined") {
      localStorage.clear();
    }
    notify();
    return true;
  },

  // --------------------------------------------------------------------------
  // Routines
  // --------------------------------------------------------------------------
  "routines:getRoutines": (args: { activeOnly?: boolean } = {}) => {
    let routines = getLocalItem<Routine[]>(STORAGE_KEYS.ROUTINES, []);
    if (args.activeOnly) {
      routines = routines.filter((r) => r.active);
    }
    return routines;
  },

  "routines:getRoutine": (args: { routineId: Id<"routines"> }) => {
    const routines = getLocalItem<Routine[]>(STORAGE_KEYS.ROUTINES, []);
    return routines.find((r) => r._id === args.routineId) || null;
  },

  "routines:createRoutine": (args: {
    name: string;
    description?: string;
    source: "scratch" | "ai_generated";
    days: RoutineDay[];
  }) => {
    const user = getOrCreateCurrentUser();
    const routines = getLocalItem<Routine[]>(STORAGE_KEYS.ROUTINES, []);
    const newRoutine: Routine = {
      _id: generateId("routines"),
      userId: user._id,
      name: args.name,
      description: args.description,
      source: args.source,
      days: args.days,
      createdAt: Date.now(),
      active: true,
    };
    routines.push(newRoutine);
    setLocalItem(STORAGE_KEYS.ROUTINES, routines);
    notify();
    return newRoutine._id;
  },

  "routines:updateRoutine": (args: {
    routineId: Id<"routines">;
    name?: string;
    description?: string;
    days?: RoutineDay[];
  }) => {
    const routines = getLocalItem<Routine[]>(STORAGE_KEYS.ROUTINES, []);
    const index = routines.findIndex((r) => r._id === args.routineId);
    if (index === -1) throw new Error("Routine not found");
    const updated = {
      ...routines[index],
      ...args,
    };
    routines[index] = updated;
    setLocalItem(STORAGE_KEYS.ROUTINES, routines);
    notify();
    return args.routineId;
  },

  "routines:deleteRoutine": (args: { routineId: Id<"routines"> }) => {
    let routines = getLocalItem<Routine[]>(STORAGE_KEYS.ROUTINES, []);
    routines = routines.filter((r) => r._id !== args.routineId);
    setLocalItem(STORAGE_KEYS.ROUTINES, routines);
    notify();
    return args.routineId;
  },

  "routines:importRoutineFromJson": (args: { jsonString: string }) => {
    try {
      const data = JSON.parse(args.jsonString);
      const user = getOrCreateCurrentUser();
      const routines = getLocalItem<Routine[]>(STORAGE_KEYS.ROUTINES, []);
      const newRoutine: Routine = {
        _id: generateId("routines"),
        userId: user._id,
        name: data.name || "Imported Routine",
        description: data.description,
        source: "scratch",
        days: data.days || [],
        createdAt: Date.now(),
        active: true,
      };
      routines.push(newRoutine);
      setLocalItem(STORAGE_KEYS.ROUTINES, routines);
      notify();
      return newRoutine._id;
    } catch (err) {
      throw new Error("Failed to parse routine JSON");
    }
  },

  "routines:importDayToRoutine": (args: {
    routineId: Id<"routines">;
    day: RoutineDay;
  }) => {
    const routines = getLocalItem<Routine[]>(STORAGE_KEYS.ROUTINES, []);
    const index = routines.findIndex((r) => r._id === args.routineId);
    if (index === -1) throw new Error("Routine not found");
    const routine = routines[index];
    const updatedDays = [...routine.days, args.day];
    routines[index] = { ...routine, days: updatedDays };
    setLocalItem(STORAGE_KEYS.ROUTINES, routines);
    notify();
    return args.routineId;
  },

  "routines:createRoutineFromWorkout": (args: {
    workoutId: Id<"workouts">;
    name: string;
    description?: string;
  }) => {
    const user = getOrCreateCurrentUser();
    const workouts = getLocalItem<Workout[]>(STORAGE_KEYS.WORKOUTS, []);
    const workout = workouts.find((w) => w._id === args.workoutId);
    if (!workout) throw new Error("Workout not found");

    const entries = getLocalItem<Entry[]>(STORAGE_KEYS.ENTRIES, []);
    const workoutEntries = entries.filter((e) => e.workoutId === args.workoutId);

    // Group entries by exercise
    const exerciseMap = new Map<string, Entry[]>();
    workoutEntries.forEach((e) => {
      const list = exerciseMap.get(e.exerciseName) || [];
      list.push(e);
      exerciseMap.set(e.exerciseName, list);
    });

    const exercises: RoutineExercise[] = Array.from(exerciseMap.entries()).map(([exName, list]) => {
      const firstEntry = list[0];
      const kind = firstEntry.kind;
      const targetSets = list.length;
      let targetReps = "8-12";
      if (kind === "lifting" && firstEntry.lifting?.reps) {
        // Average or use first
        targetReps = firstEntry.lifting.reps.toString();
      } else if (kind === "cardio" && firstEntry.cardio?.durationSeconds) {
        targetReps = `${Math.round(firstEntry.cardio.durationSeconds / 60)} min`;
      }

      return {
        exerciseName: exName,
        kind,
        targetSets,
        targetReps,
      };
    });

    const newRoutine: Routine = {
      _id: generateId("routines"),
      userId: user._id,
      name: args.name,
      description: args.description,
      source: "scratch",
      days: [
        {
          name: "Día 1",
          exercises,
        },
      ],
      createdAt: Date.now(),
      active: true,
    };

    const routines = getLocalItem<Routine[]>(STORAGE_KEYS.ROUTINES, []);
    routines.push(newRoutine);
    setLocalItem(STORAGE_KEYS.ROUTINES, routines);
    notify();
    return newRoutine._id;
  },

  // --------------------------------------------------------------------------
  // Workouts
  // --------------------------------------------------------------------------
  "workouts:getWorkoutHistory": (args: { limit?: number } = {}) => {
    const workouts = getLocalItem<Workout[]>(STORAGE_KEYS.WORKOUTS, []);
    workouts.sort((a, b) => b.startedAt - a.startedAt);
    if (args.limit) {
      return workouts.slice(0, args.limit);
    }
    return workouts;
  },

  "workouts:getActiveWorkout": () => {
    const workouts = getLocalItem<Workout[]>(STORAGE_KEYS.WORKOUTS, []);
    return workouts.find((w) => w.status === "in_progress") || null;
  },

  "workouts:createWorkout": (args: {
    title: string;
    routineId?: Id<"routines">;
    daysExercises?: RoutineExercise[];
  }) => {
    const user = getOrCreateCurrentUser();
    const workouts = getLocalItem<Workout[]>(STORAGE_KEYS.WORKOUTS, []);

    // Check if there is an in-progress workout, cancel it
    const active = workouts.findIndex((w) => w.status === "in_progress");
    if (active !== -1) {
      workouts[active].status = "cancelled";
      workouts[active].completedAt = Date.now();
    }

    const newWorkout: Workout = {
      _id: generateId("workouts"),
      userId: user._id,
      title: args.title,
      status: "in_progress",
      startedAt: Date.now(),
    };

    workouts.push(newWorkout);
    setLocalItem(STORAGE_KEYS.WORKOUTS, workouts);

    // If day's exercises were provided, we can pre-create entries or wait.
    // In OpenTrainer, this is usually handled in the page, but let's see.
    // Usually, the app pre-fills entries from the routine when starting a workout.
    // Wait, the client-side code will do this by calling addLiftingEntry/addCardioEntry/etc.
    // So we don't need to insert entries here.
    notify();
    return newWorkout._id;
  },

  "workouts:completeWorkout": (args: {
    workoutId: Id<"workouts">;
    summary: WorkoutSummary;
    notes?: string;
  }) => {
    const workouts = getLocalItem<Workout[]>(STORAGE_KEYS.WORKOUTS, []);
    const index = workouts.findIndex((w) => w._id === args.workoutId);
    if (index === -1) throw new Error("Workout not found");
    workouts[index] = {
      ...workouts[index],
      status: "completed",
      completedAt: Date.now(),
      summary: args.summary,
      notes: args.notes,
    };
    setLocalItem(STORAGE_KEYS.WORKOUTS, workouts);
    notify();
    return args.workoutId;
  },

  "workouts:cancelWorkout": (args: { workoutId: Id<"workouts"> }) => {
    const workouts = getLocalItem<Workout[]>(STORAGE_KEYS.WORKOUTS, []);
    const index = workouts.findIndex((w) => w._id === args.workoutId);
    if (index === -1) throw new Error("Workout not found");
    workouts[index] = {
      ...workouts[index],
      status: "cancelled",
      completedAt: Date.now(),
    };
    setLocalItem(STORAGE_KEYS.WORKOUTS, workouts);
    notify();
    return args.workoutId;
  },

  "workouts:deleteWorkout": (args: { workoutId: Id<"workouts"> }) => {
    let workouts = getLocalItem<Workout[]>(STORAGE_KEYS.WORKOUTS, []);
    workouts = workouts.filter((w) => w._id !== args.workoutId);
    setLocalItem(STORAGE_KEYS.WORKOUTS, workouts);

    let entries = getLocalItem<Entry[]>(STORAGE_KEYS.ENTRIES, []);
    entries = entries.filter((e) => e.workoutId !== args.workoutId);
    setLocalItem(STORAGE_KEYS.ENTRIES, entries);

    notify();
    return args.workoutId;
  },

  "workouts:getDashboardStats": () => {
    const user = getOrCreateCurrentUser();
    const workouts = getLocalItem<Workout[]>(STORAGE_KEYS.WORKOUTS, []);
    const completed = workouts.filter((w) => w.status === "completed");

    // Calculate start of current week (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysSinceMonday = (dayOfWeek + 6) % 7;
    const mondayOfThisWeek = new Date(now);
    mondayOfThisWeek.setDate(now.getDate() - daysSinceMonday);
    mondayOfThisWeek.setHours(0, 0, 0, 0);

    // Get current week (Monday through Sunday) for activity dots
    const currentWeek: { date: string; dayName: string; hasWorkout: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(mondayOfThisWeek);
      date.setDate(mondayOfThisWeek.getDate() + i);
      currentWeek.push({
        date: date.toISOString().split("T")[0],
        dayName: date.toLocaleDateString("en-US", { weekday: "short" }),
        hasWorkout: false,
      });
    }

    // Get workouts from the current week
    const thisWeekWorkouts = completed.filter(
      (w) => w.startedAt >= mondayOfThisWeek.getTime()
    );

    // Mark days with workouts
    for (const workout of thisWeekWorkouts) {
      const workoutDate = new Date(workout.startedAt).toISOString().split("T")[0];
      const dayEntry = currentWeek.find((d) => d.date === workoutDate);
      if (dayEntry) {
        dayEntry.hasWorkout = true;
      }
    }

    const weeklyWorkoutCount = thisWeekWorkouts.length;
    let weeklyTotalSets = 0;
    let weeklyTotalVolume = 0;
    let weeklyTotalDuration = 0;

    for (const workout of thisWeekWorkouts) {
      weeklyTotalSets += workout.summary?.totalSets ?? 0;
      weeklyTotalVolume += workout.summary?.totalVolume ?? 0;
      weeklyTotalDuration += workout.summary?.totalDurationMinutes ?? 0;
    }

    // Group by week for trend chart (last 4 weeks)
    const weeklyTrend: { week: string; volume: number; workouts: number; duration: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - (i * 7 + daysSinceMonday));
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      const weekWorkouts = completed.filter(
        (w) => w.startedAt >= weekStart.getTime() && w.startedAt < weekEnd.getTime()
      );

      let volume = 0;
      let duration = 0;
      for (const w of weekWorkouts) {
        volume += w.summary?.totalVolume ?? 0;
        duration += w.summary?.totalDurationMinutes ?? 0;
      }

      weeklyTrend.push({
        week: weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        volume,
        workouts: weekWorkouts.length,
        duration,
      });
    }

    return {
      weeklyGoal: user.weeklyAvailability ?? 4,
      weeklyWorkoutCount,
      weeklyTotalSets,
      weeklyTotalVolume,
      weeklyTotalDuration,
      currentWeek,
      weeklyTrend,
      preferredUnits: user.preferredUnits ?? "lb",
    };
  },

  "workouts:updateWeeklyGoal": (args: { weeklyGoal: number }) => {
    const user = getOrCreateCurrentUser();
    const updated = { ...user, weeklyAvailability: args.weeklyGoal };
    setLocalItem(STORAGE_KEYS.USER, updated);
    notify();
    return user._id;
  },

  "workouts:exportWorkoutAsJson": (args: { workoutId: Id<"workouts"> }) => {
    const workouts = getLocalItem<Workout[]>(STORAGE_KEYS.WORKOUTS, []);
    const workout = workouts.find((w) => w._id === args.workoutId);
    if (!workout) throw new Error("Workout not found");

    const entries = getLocalItem<Entry[]>(STORAGE_KEYS.ENTRIES, []);
    const workoutEntries = entries.filter((e) => e.workoutId === args.workoutId);

    return JSON.stringify({
      workout,
      entries: workoutEntries,
    }, null, 2);
  },

  // --------------------------------------------------------------------------
  // Entries
  // --------------------------------------------------------------------------
  "entries:getEntriesByWorkout": (args: { workoutId: Id<"workouts"> }) => {
    const entries = getLocalItem<Entry[]>(STORAGE_KEYS.ENTRIES, []);
    return entries.filter((e) => e.workoutId === args.workoutId);
  },

  "entries:getLastSetForExercise": (args: { exerciseName: string }) => {
    const entries = getLocalItem<Entry[]>(STORAGE_KEYS.ENTRIES, []);
    const filtered = entries.filter((e) => e.exerciseName === args.exerciseName);
    filtered.sort((a, b) => b.createdAt - a.createdAt);
    return filtered[0] || null;
  },

  "entries:getExerciseHistory": (args: { exerciseName: string; sessionCount?: number }) => {
    const limit = args.sessionCount ?? 3;
    const entries = getLocalItem<Entry[]>(STORAGE_KEYS.ENTRIES, []);
    // Only lifting exercises
    const exerciseEntries = entries.filter(
      (e) => e.exerciseName === args.exerciseName && e.kind === "lifting"
    );
    exerciseEntries.sort((a, b) => b.createdAt - a.createdAt);

    // Group by workoutId
    const workoutMap = new Map<string, Entry[]>();
    exerciseEntries.forEach((e) => {
      const list = workoutMap.get(e.workoutId) || [];
      list.push(e);
      workoutMap.set(e.workoutId, list);
    });

    const workoutIds = Array.from(workoutMap.keys());
    const workouts = getLocalItem<Workout[]>(STORAGE_KEYS.WORKOUTS, []);

    const sessions: any[] = [];
    for (let i = 0; i < workoutIds.length && sessions.length < limit; i++) {
      const workoutId = workoutIds[i];
      const workout = workouts.find((w) => w._id === workoutId);
      if (!workout || workout.status !== "completed") {
        continue;
      }

      const sessionEntries = workoutMap.get(workoutId)!;
      sessionEntries.sort((a, b) => (a.lifting?.setNumber ?? 0) - (b.lifting?.setNumber ?? 0));

      const sets = sessionEntries.map((e) => ({
        setNumber: e.lifting!.setNumber,
        weight: e.lifting!.weight ?? 0,
        reps: e.lifting!.reps ?? 0,
        rpe: e.lifting!.rpe ?? null,
        unit: e.lifting!.unit,
      }));

      if (sets.length === 0) continue;

      const workingSets = sets.filter((s) => s.reps > 0);
      const bestSet = workingSets.reduce(
        (best, current) => (current.weight > best.weight ? current : best),
        workingSets[0] ?? sets[0]
      );

      sessions.push({
        workoutId,
        date: new Date(workout.completedAt ?? workout.startedAt).toISOString(),
        sets,
        bestSet,
      });
    }

    return sessions;
  },

  "entries:addLiftingEntry": (args: {
    workoutId: Id<"workouts">;
    clientId: string;
    exerciseName: string;
    exerciseId?: Id<"exercises">;
    lifting: any;
    notes?: string;
  }) => {
    const user = getOrCreateCurrentUser();
    const entries = getLocalItem<Entry[]>(STORAGE_KEYS.ENTRIES, []);

    // Deduplicate by clientId
    const existing = entries.find(
      (e) => e.workoutId === args.workoutId && e.clientId === args.clientId
    );
    if (existing) {
      return existing._id;
    }

    const newEntry: Entry = {
      _id: generateId("entries"),
      workoutId: args.workoutId,
      userId: user._id,
      clientId: args.clientId,
      exerciseId: args.exerciseId,
      exerciseName: args.exerciseName,
      kind: "lifting",
      lifting: args.lifting,
      notes: args.notes,
      createdAt: Date.now(),
    };

    entries.push(newEntry);
    setLocalItem(STORAGE_KEYS.ENTRIES, entries);
    notify();
    return newEntry._id;
  },

  "entries:addCardioEntry": (args: {
    workoutId: Id<"workouts">;
    clientId: string;
    exerciseName: string;
    exerciseId?: Id<"exercises">;
    cardio: any;
    notes?: string;
  }) => {
    const user = getOrCreateCurrentUser();
    const entries = getLocalItem<Entry[]>(STORAGE_KEYS.ENTRIES, []);

    // Deduplicate by clientId
    const existing = entries.find(
      (e) => e.workoutId === args.workoutId && e.clientId === args.clientId
    );
    if (existing) {
      return existing._id;
    }

    const newEntry: Entry = {
      _id: generateId("entries"),
      workoutId: args.workoutId,
      userId: user._id,
      clientId: args.clientId,
      exerciseId: args.exerciseId,
      exerciseName: args.exerciseName,
      kind: "cardio",
      cardio: args.cardio,
      notes: args.notes,
      createdAt: Date.now(),
    };

    entries.push(newEntry);
    setLocalItem(STORAGE_KEYS.ENTRIES, entries);
    notify();
    return newEntry._id;
  },

  "entries:updateLiftingEntry": (args: {
    entryId: Id<"entries">;
    lifting?: any;
    notes?: string;
  }) => {
    const entries = getLocalItem<Entry[]>(STORAGE_KEYS.ENTRIES, []);
    const index = entries.findIndex((e) => e._id === args.entryId);
    if (index === -1) throw new Error("Entry not found");
    const entry = entries[index];
    entries[index] = {
      ...entry,
      lifting: args.lifting ? { ...entry.lifting, ...args.lifting } : entry.lifting,
      notes: args.notes !== undefined ? args.notes : entry.notes,
    };
    setLocalItem(STORAGE_KEYS.ENTRIES, entries);
    notify();
    return args.entryId;
  },

  "entries:addMobilityEntry": (args: {
    workoutId: Id<"workouts">;
    clientId: string;
    exerciseName: string;
    exerciseId?: Id<"exercises">;
    mobility: any;
    notes?: string;
  }) => {
    const user = getOrCreateCurrentUser();
    const entries = getLocalItem<Entry[]>(STORAGE_KEYS.ENTRIES, []);

    // Deduplicate by clientId
    const existing = entries.find(
      (e) => e.workoutId === args.workoutId && e.clientId === args.clientId
    );
    if (existing) {
      return existing._id;
    }

    const newEntry: Entry = {
      _id: generateId("entries"),
      workoutId: args.workoutId,
      userId: user._id,
      clientId: args.clientId,
      exerciseId: args.exerciseId,
      exerciseName: args.exerciseName,
      kind: "mobility",
      mobility: args.mobility,
      notes: args.notes,
      createdAt: Date.now(),
    };

    entries.push(newEntry);
    setLocalItem(STORAGE_KEYS.ENTRIES, entries);
    notify();
    return newEntry._id;
  },

  "entries:updateMobilityEntry": (args: {
    entryId: Id<"entries">;
    mobility?: any;
    notes?: string;
  }) => {
    const entries = getLocalItem<Entry[]>(STORAGE_KEYS.ENTRIES, []);
    const index = entries.findIndex((e) => e._id === args.entryId);
    if (index === -1) throw new Error("Entry not found");
    const entry = entries[index];
    entries[index] = {
      ...entry,
      mobility: args.mobility ? { ...entry.mobility, ...args.mobility } : entry.mobility,
      notes: args.notes !== undefined ? args.notes : entry.notes,
    };
    setLocalItem(STORAGE_KEYS.ENTRIES, entries);
    notify();
    return args.entryId;
  },

  "entries:deleteEntry": (args: { entryId: Id<"entries"> }) => {
    let entries = getLocalItem<Entry[]>(STORAGE_KEYS.ENTRIES, []);
    entries = entries.filter((e) => e._id !== args.entryId);
    setLocalItem(STORAGE_KEYS.ENTRIES, entries);
    notify();
    return args.entryId;
  },

  // --------------------------------------------------------------------------
  // Exercises
  // --------------------------------------------------------------------------
  "exercises:getExercises": (args: {
    category?: "lifting" | "cardio" | "mobility" | "other";
    muscleGroup?: string;
    search?: string;
  } = {}) => {
    let exercises = getLocalItem<Exercise[]>(STORAGE_KEYS.EXERCISES, []);
    if (exercises.length === 0) {
      seedSystemExercisesSync();
      exercises = getLocalItem<Exercise[]>(STORAGE_KEYS.EXERCISES, []);
    }

    if (args.category) {
      exercises = exercises.filter((e) => e.category === args.category);
    }

    if (args.muscleGroup) {
      exercises = exercises.filter((e) => e.muscleGroups?.includes(args.muscleGroup!));
    }

    if (args.search) {
      const queryLower = args.search.toLowerCase();
      exercises = exercises.filter(
        (e) =>
          e.name.toLowerCase().includes(queryLower) ||
          e.aliases?.some((a) => a.toLowerCase().includes(queryLower))
      );
    }

    return exercises.sort((a, b) => {
      if (a.isSystemExercise !== b.isSystemExercise) {
        return a.isSystemExercise ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  },

  "exercises:getExercise": (args: { id: Id<"exercises"> }) => {
    const exercises = getLocalItem<Exercise[]>(STORAGE_KEYS.EXERCISES, []);
    return exercises.find((e) => e._id === args.id) || null;
  },

  "exercises:getMuscleGroups": () => {
    const exercises = getLocalItem<Exercise[]>(STORAGE_KEYS.EXERCISES, []);
    const groups = new Set<string>();
    exercises.forEach((ex) => {
      ex.muscleGroups?.forEach((g) => groups.add(g));
    });
    return Array.from(groups).sort();
  },

  "exercises:seedSystemExercises": () => {
    seedSystemExercisesSync();
    notify();
    return { added: 0, total: SYSTEM_EXERCISES.length, skipped: SYSTEM_EXERCISES.length };
  },

  "exercises:updateSystemExercises": () => {
    return { updated: 0, total: SYSTEM_EXERCISES.length };
  },

  "exercises:createExercise": (args: {
    name: string;
    aliases?: string[];
    category: "lifting" | "cardio" | "mobility" | "other";
    muscleGroups?: string[];
    equipment?: string[];
    modality?: string;
    primaryMetric?: "duration" | "distance";
  }) => {
    const user = getOrCreateCurrentUser();
    const exercises = getLocalItem<Exercise[]>(STORAGE_KEYS.EXERCISES, []);
    const newEx: Exercise = {
      _id: generateId("exercises"),
      userId: user._id,
      name: args.name,
      aliases: args.aliases,
      category: args.category,
      muscleGroups: args.muscleGroups,
      equipment: args.equipment,
      modality: args.modality,
      primaryMetric: args.primaryMetric,
      isSystemExercise: false,
      createdAt: Date.now(),
    };
    exercises.push(newEx);
    setLocalItem(STORAGE_KEYS.EXERCISES, exercises);
    notify();
    return newEx._id;
  },

  "exercises:updateExercise": (args: {
    id: Id<"exercises">;
    muscleGroups?: string[];
    name?: string;
  }) => {
    const exercises = getLocalItem<Exercise[]>(STORAGE_KEYS.EXERCISES, []);
    const index = exercises.findIndex((e) => e._id === args.id);
    if (index === -1) throw new Error("Exercise not found");
    if (exercises[index].isSystemExercise) throw new Error("Cannot update system exercise");

    exercises[index] = {
      ...exercises[index],
      ...args,
    };
    setLocalItem(STORAGE_KEYS.EXERCISES, exercises);
    notify();
    return args.id;
  },

  // --------------------------------------------------------------------------
  // Training Lab Reports
  // --------------------------------------------------------------------------
  "ai/trainingLabMutations:getCtaState": () => {
    const assessments = getLocalItem<Assessment[]>(STORAGE_KEYS.ASSESSMENTS, []);
    if (assessments.length === 0) {
      return { canGenerate: true, reason: null, daysSinceLastReport: null };
    }
    assessments.sort((a, b) => b.createdAt - a.createdAt);
    const last = assessments[0];
    const diffDays = (Date.now() - last.createdAt) / (1000 * 60 * 60 * 24);
    return {
      canGenerate: diffDays >= 7,
      reason: diffDays < 7 ? "Only one report allowed every 7 days" : null,
      daysSinceLastReport: Math.floor(diffDays),
    };
  },

  "ai/trainingLabMutations:getLatestReport": () => {
    const assessments = getLocalItem<Assessment[]>(STORAGE_KEYS.ASSESSMENTS, []);
    if (assessments.length === 0) return null;
    assessments.sort((a, b) => b.createdAt - a.createdAt);
    const last = assessments[0];

    const details = getLocalItem<AssessmentDetail[]>(STORAGE_KEYS.ASSESSMENT_DETAILS, []);
    const detail = details.find((d) => d.assessmentId === last._id);
    return detail ? detail.report : null;
  },

  "ai/trainingLabMutations:getDashboardStats": () => {
    const workouts = getLocalItem<Workout[]>(STORAGE_KEYS.WORKOUTS, []);
    const completed = workouts.filter((w) => w.status === "completed");
    
    // Quick statistics calculation
    const totalVolume = completed.reduce((sum, w) => sum + (w.summary?.totalVolume ?? 0), 0);
    const totalSets = completed.reduce((sum, w) => sum + (w.summary?.totalSets ?? 0), 0);
    
    return {
      totalWorkouts: completed.length,
      totalVolume,
      totalSets,
    };
  },

  "feedback:submitFeedback": (args: { text: string; email?: string }) => {
    console.log("Feedback submitted locally:", args);
    return true;
  },

  "ai/trainingLabMutations:storeAssessment": (args: {
    subjectType: string;
    subjectSubtype: string;
    summary: string;
    report: any;
  }) => {
    const user = getOrCreateCurrentUser();
    const assessments = getLocalItem<Assessment[]>(STORAGE_KEYS.ASSESSMENTS, []);
    const details = getLocalItem<AssessmentDetail[]>(STORAGE_KEYS.ASSESSMENT_DETAILS, []);

    const assessmentId = generateId("assessments");
    assessments.push({
      _id: assessmentId,
      userId: user._id,
      subjectType: args.subjectType as any,
      subjectSubtype: args.subjectSubtype as any,
      summary: args.summary,
      createdAt: Date.now(),
    });

    details.push({
      _id: generateId("assessmentDetails"),
      assessmentId,
      userId: user._id,
      report: args.report,
      createdAt: Date.now(),
    });

    setLocalItem(STORAGE_KEYS.ASSESSMENTS, assessments);
    setLocalItem(STORAGE_KEYS.ASSESSMENT_DETAILS, details);
    notify();
    return assessmentId;
  },
};
