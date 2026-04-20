import { supabase } from "./supabase";

export type TeamName =
  | "15u Salute"
  | "15u Honor"
  | "16u Salute"
  | "16u Honor"
  | "17u Salute"
  | "17u Honor"
  | "2030 Salute"
  | "2030 Honor"
  | "2031 Salute"
  | "2031 Honor"
  | "2032 Salute"
  | "2032 Honor"
  | "Undecided";

export type WorkoutActivityKey =
  | "pushups"
  | "sitUps"
  | "squats"
  | "lunges"
  | "dribbles"
  | "jumpRopes"
  | "cardio"
  | "shoots";

export type ActivityChecks = Record<WorkoutActivityKey, boolean>;

export type WorkoutLog = {
  id: string;
  athlete_name: string;
  team_name: TeamName;
  workout_date: string;
  activities: ActivityChecks;
  notes: string | null;
  focus_area: string | null;
  effort_level: number | null;
  advanced_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SaveWorkoutLogInput = Omit<
  WorkoutLog,
  "id" | "created_at" | "updated_at"
>;

export type WorkoutDataSource = "supabase" | "local";

const STORAGE_KEY = "soldiers-athlete-workout-logs";

function isTableUnavailable(message: string | undefined) {
  if (!message) return false;

  return (
    message.includes("Could not find the table") ||
    message.includes("relation") ||
    message.includes("does not exist") ||
    message.includes("column") ||
    message.includes("schema cache")
  );
}

function sortLogs(logs: WorkoutLog[]) {
  return [...logs].sort((a, b) => {
    const dateDiff =
      new Date(b.workout_date).getTime() - new Date(a.workout_date).getTime();
    if (dateDiff !== 0) return dateDiff;

    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

function readLocalLogs() {
  if (typeof window === "undefined") return [] as WorkoutLog[];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as WorkoutLog[];
    return sortLogs(parsed);
  } catch {
    return [];
  }
}

function writeLocalLogs(logs: WorkoutLog[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sortLogs(logs)));
}

export async function fetchWorkoutLogs(): Promise<{
  logs: WorkoutLog[];
  source: WorkoutDataSource;
}> {
  const { data, error } = await supabase
    .from("athlete_workout_logs")
    .select("*")
    .order("workout_date", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) {
    if (isTableUnavailable(error.message)) {
      return { logs: readLocalLogs(), source: "local" };
    }

    throw new Error(error.message);
  }

  return {
    logs: sortLogs((data ?? []) as WorkoutLog[]),
    source: "supabase",
  };
}

export async function saveWorkoutLog(
  input: SaveWorkoutLogInput
): Promise<{
  log: WorkoutLog;
  source: WorkoutDataSource;
}> {
  const payload = {
    athlete_name: input.athlete_name.trim(),
    team_name: input.team_name,
    workout_date: input.workout_date,
    activities: input.activities,
    notes: input.notes?.trim() || null,
    focus_area: input.focus_area?.trim() || null,
    effort_level: input.effort_level ?? null,
    advanced_notes: input.advanced_notes?.trim() || null,
  };

  const { data, error } = await supabase
    .from("athlete_workout_logs")
    .upsert([payload], {
      onConflict: "athlete_name,team_name,workout_date",
    })
    .select()
    .single();

  if (error) {
    if (!isTableUnavailable(error.message)) {
      throw new Error(error.message);
    }

    const logs = readLocalLogs();
    const now = new Date().toISOString();
    const existingIndex = logs.findIndex(
      (entry) =>
        entry.athlete_name.toLowerCase() === payload.athlete_name.toLowerCase() &&
        entry.team_name === payload.team_name &&
        entry.workout_date === payload.workout_date
    );

    const nextLog: WorkoutLog =
      existingIndex >= 0
        ? {
            ...logs[existingIndex],
            ...payload,
            updated_at: now,
          }
        : {
            id: `local-${Date.now()}`,
            ...payload,
            created_at: now,
            updated_at: now,
          };

    const nextLogs = [...logs];
    if (existingIndex >= 0) {
      nextLogs[existingIndex] = nextLog;
    } else {
      nextLogs.push(nextLog);
    }

    writeLocalLogs(nextLogs);
    return { log: nextLog, source: "local" };
  }

  return {
    log: data as WorkoutLog,
    source: "supabase",
  };
}
