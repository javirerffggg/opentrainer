import React, { useState, useEffect } from "react";
import { localDb, subscribe } from "./local-db";
import {
  getExerciseContext,
  getRecentMuscleVolume,
  getSwapHistory,
  getTrainingLabPayload,
} from "./aggregators";

// Helper to extract function name from Convex FunctionReference
function getFunctionName(funcRef: any): string {
  if (!funcRef) return "";
  if (typeof funcRef === "string") return funcRef;
  
  try {
    const symbolForName = Symbol.for("functionName");
    const name = funcRef[symbolForName];
    if (typeof name === "string") {
      return name;
    }
  } catch (e) {}

  if (typeof funcRef === "object" || typeof funcRef === "function") {
    try {
      if (typeof funcRef._path === "string") return funcRef._path;
      if (typeof funcRef.path === "string") return funcRef.path;
    } catch (e) {}
  }

  return "";
}

// mock client instance
export class ConvexReactClient {
  constructor(url: string) {}
}

// provider mocks
export function ConvexProvider({ children }: { children: React.ReactNode }) {
  return React.createElement(React.Fragment, null, children);
}

export function ConvexProviderWithClerk({ children }: { children: React.ReactNode; [key: string]: any }) {
  return React.createElement(React.Fragment, null, children);
}

// hooks
export function useQuery(funcRef: any, args?: any) {
  const funcName = getFunctionName(funcRef);
  
  const [data, setData] = useState(() => {
    const handler = (localDb as any)[funcName];
    if (handler) {
      try {
        return handler(args);
      } catch (err) {
        console.error(`Error in local query ${funcName}:`, err);
        return null;
      }
    }
    console.warn(`Query ${funcName} not mocked in local-db`);
    return undefined; // simulate loading
  });

  useEffect(() => {
    const handler = (localDb as any)[funcName];
    if (!handler) return;

    const update = () => {
      try {
        setData(handler(args));
      } catch (err) {
        console.error(`Error updating query ${funcName}:`, err);
      }
    };

    update();
    return subscribe(update);
  }, [funcName, JSON.stringify(args)]);

  return data;
}

export function useMutation(funcRef: any) {
  const funcName = getFunctionName(funcRef);

  return async (args?: any) => {
    const handler = (localDb as any)[funcName];
    if (handler) {
      try {
        return handler(args);
      } catch (err) {
        console.error(`Error in local mutation ${funcName}:`, err);
        throw err;
      }
    }
    console.warn(`Mutation ${funcName} not mocked in local-db`);
    return null;
  };
}

export function useAction(funcRef: any) {
  const funcName = getFunctionName(funcRef);

  return async (args?: any) => {
    // Check if the mutation/query is also defined in local-db, if so prefer local execution
    if ((localDb as any)[funcName]) {
      return (localDb as any)[funcName](args);
    }

    // Enrich arguments with local context before posting to Next.js API
    let enrichedArgs = { ...args };
    const user = localDb["users:getCurrentUser"]();

    if (funcName.includes("routineGenerator") && funcName.includes("generateRoutine")) {
      enrichedArgs = {
        ...args,
        profile: {
          goals: user.goals ?? ["general_fitness"],
          experience: user.experienceLevel ?? "intermediate",
          equipment: user.equipment ?? [],
          daysPerWeek: args?.daysPerWeek ?? user.weeklyAvailability ?? 4,
          sessionMinutes: user.sessionDuration ?? 60,
          bodyweight: user.bodyweight,
          unit: user.bodyweightUnit ?? user.preferredUnits ?? "lb",
        },
      };
    } else if (funcName.includes("routineGenerator") && funcName.includes("getRoutineSwapAlternatives")) {
      enrichedArgs = {
        ...args,
        equipment: user.equipment ?? [],
      };
    } else if (funcName.includes("smartSwap") && funcName.includes("getAlternatives")) {
      const exerciseContext = getExerciseContext(args?.exerciseName);
      const recentVolume = getRecentMuscleVolume(7);
      const swapHistory = getSwapHistory(args?.exerciseName);
      enrichedArgs = {
        ...args,
        eq: user.equipment ?? [],
        curr: {
          ex: args?.exerciseName,
          muscles: exerciseContext.muscleGroups,
          equip: exerciseContext.equipment,
          recent: exerciseContext.recentSessions,
        },
        recentVol: recentVolume,
        swapCount: swapHistory.length > 0 && args?.reason === "discomfort" ? swapHistory.length : undefined,
      };
    } else if (funcName.includes("trainingLab") && funcName.includes("generateReport")) {
      const payload = getTrainingLabPayload(args?.periodDays ?? 7);
      enrichedArgs = {
        ...args,
        payload,
      };
    }

    // Route as an AI Action to Next.js API endpoint
    const response = await fetch("/api/ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: funcName,
        args: enrichedArgs,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = "Action failed";
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorMessage;
      } catch (_) {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  };
}

export function useConvex() {
  return {
    query: async (funcRef: any, args?: any) => {
      const funcName = getFunctionName(funcRef);
      const handler = (localDb as any)[funcName];
      if (handler) {
        return handler(args);
      }
      throw new Error(`Query ${funcName} not found in local-db`);
    },
    mutation: async (funcRef: any, args?: any) => {
      const funcName = getFunctionName(funcRef);
      const handler = (localDb as any)[funcName];
      if (handler) {
        return handler(args);
      }
      throw new Error(`Mutation ${funcName} not found in local-db`);
    },
  };
}
