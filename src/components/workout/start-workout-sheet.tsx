"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id, Doc } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ChevronRight, Dumbbell, Play, Zap, X } from "lucide-react";
import { toast } from "sonner";
import { useHaptic } from "@/hooks/use-haptic";
import posthog from "posthog-js";

interface StartWorkoutSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeWorkout?: Doc<"workouts"> | null;
}

type Routine = {
  _id: Id<"routines">;
  name: string;
  days: Array<{
    name: string;
    exercises: Array<{ exerciseName: string }>;
  }>;
};

export function StartWorkoutSheet({ open, onOpenChange, activeWorkout }: StartWorkoutSheetProps) {
  const router = useRouter();
  const { vibrate } = useHaptic();
  const routines = useQuery(api.routines.getRoutines, { activeOnly: true });
  const createWorkout = useMutation(api.workouts.createWorkout);
  const cancelWorkout = useMutation(api.workouts.cancelWorkout);

  const [expandedRoutine, setExpandedRoutine] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const handleActiveWorkoutError = (error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes("already have an active workout")) {
      toast.error("Hay un entrenamiento activo", {
        description: "Completa o cancela tu entrenamiento actual primero.",
        action: {
          label: "Ir al entrenamiento",
          onClick: () => {
            onOpenChange(false);
            router.push("/workout/active");
          },
        },
      });
    } else {
      toast.error("Error al iniciar el entrenamiento");
    }
    console.error(error);
  };

  const handleContinueWorkout = () => {
    vibrate("medium");
    onOpenChange(false);
    router.push("/workout/active");
  };

  const handleCancelCurrentWorkout = async () => {
    if (!activeWorkout) return;
    
    setIsCancelling(true);
    try {
      vibrate("warning");
      await cancelWorkout({ workoutId: activeWorkout._id });
      toast.success("Entrenamiento anterior cancelado");
    } catch (error) {
      toast.error("Error al cancelar el entrenamiento");
      console.error(error);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleStartEmpty = async () => {
    setIsStarting(true);
    try {
      vibrate("medium");
      await createWorkout({});
      posthog.capture("workout_started", {
        source: "empty",
      });
      onOpenChange(false);
      router.push("/workout/active");
    } catch (error) {
      handleActiveWorkoutError(error);
    } finally {
      setIsStarting(false);
    }
  };

  const handleStartFromRoutine = async (routine: Routine, dayIndex: number) => {
    setIsStarting(true);
    try {
      vibrate("medium");
      const day = routine.days[dayIndex];
      await createWorkout({
        title: day.name,
        routineId: routine._id,
        routineDayIndex: dayIndex,
      });
      posthog.capture("workout_started", {
        source: "routine",
        routine_name: routine.name,
        day_name: day.name,
        day_index: dayIndex,
        exercise_count: day.exercises.length,
      });
      onOpenChange(false);
      router.push("/workout/active");
    } catch (error) {
      handleActiveWorkoutError(error);
    } finally {
      setIsStarting(false);
    }
  };

  const toggleRoutine = (routineId: string) => {
    vibrate("light");
    setExpandedRoutine(expandedRoutine === routineId ? null : routineId);
  };

  const formatWorkoutTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return `Hoy a las ${date.toLocaleTimeString("es-ES", { hour: "numeric", minute: "2-digit" })}`;
    }
    return date.toLocaleDateString("es-ES", { 
      weekday: "short", 
      month: "short", 
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  };

  if (activeWorkout) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="flex flex-col">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Entrenamiento en Curso
            </DrawerTitle>
            <DrawerDescription>
              Ya tienes un entrenamiento activo. ¿Qué te gustaría hacer?
            </DrawerDescription>
          </DrawerHeader>

          <div className="space-y-4 px-4 py-4 pb-8">
            <Card className="border-primary/50 bg-primary/5 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Dumbbell className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{activeWorkout.title ?? "Entrenamiento"}</p>
                  <p className="text-sm text-muted-foreground">
                    Iniciado {formatWorkoutTime(activeWorkout.startedAt)}
                  </p>
                </div>
              </div>
            </Card>

            <div className="space-y-2">
              <Button
                size="lg"
                className="h-14 w-full text-lg"
                onClick={handleContinueWorkout}
              >
                <Play className="mr-2 h-5 w-5" />
                Continuar Entrenamiento
              </Button>
              
              <Button
                variant="outline"
                size="lg"
                className="h-14 w-full text-lg text-destructive hover:text-destructive"
                onClick={handleCancelCurrentWorkout}
                disabled={isCancelling || isStarting}
              >
                <X className="mr-2 h-5 w-5" />
                {isCancelling ? "Cancelando..." : "Cancelar y Comenzar Nuevo"}
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Cancelar descartará todo el progreso de tu entrenamiento actual.
            </p>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[85vh] flex flex-col">
        <DrawerHeader>
          <DrawerTitle>Comenzar Entrenamiento</DrawerTitle>
          <DrawerDescription>
            Comienza desde cero o usa una rutina guardada
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-6">
          <Button
            size="lg"
            className="h-16 w-full text-lg"
            onClick={handleStartEmpty}
            disabled={isStarting}
          >
            <Zap className="mr-2 h-5 w-5" />
            Entrenamiento Vacío
          </Button>

          {routines === undefined ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : routines.length > 0 ? (
            <section>
              <h3 className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-3">
                Desde Rutina
              </h3>
              <div className="space-y-2">
                {(routines as Routine[]).map((routine) => (
                  <Card key={routine._id} className="overflow-hidden">
                    <button
                      className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-muted/50"
                      onClick={() => toggleRoutine(routine._id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <Dumbbell className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{routine.name}</p>
                          <p className="text-sm text-muted-foreground font-mono tabular-nums">
                            {routine.days.length} día{routine.days.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <ChevronRight
                        className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${
                          expandedRoutine === routine._id ? "rotate-90" : ""
                        }`}
                      />
                    </button>

                    {expandedRoutine === routine._id && (
                      <div className="border-t divide-y bg-muted/30">
                        {routine.days.map((day, idx) => (
                          <button
                            key={idx}
                            className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => handleStartFromRoutine(routine, idx)}
                            disabled={isStarting}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-medium">{day.name}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {day.exercises.slice(0, 3).map(e => e.exerciseName).join(", ")}
                                {day.exercises.length > 3 && ` +${day.exercises.length - 3} más`}
                              </p>
                            </div>
                            <Play className="ml-3 h-4 w-4 shrink-0 text-primary" />
                          </button>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </section>
          ) : (
            <Card className="p-6 text-center">
              <Dumbbell className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="font-medium mb-1">Aún no hay rutinas</p>
              <p className="text-sm text-muted-foreground mb-4">
                Crea una rutina para comenzar rápidamente entrenamientos similares
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  router.push("/routines/new");
                }}
              >
                Crear Rutina
              </Button>
            </Card>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
