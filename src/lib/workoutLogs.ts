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
export type ActivityNotes = Record<WorkoutActivityKey, string>;

export type WorkoutLog = {
  id: string;
  athlete_name: string;
  team_name: TeamName;
  workout_date: string;
  activities: ActivityChecks;
  activity_notes: ActivityNotes;
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

function normalizeActivityChecks(value: unknown): ActivityChecks {
  const source = typeof value === "object" && value ? value : {};

  return {
    pushups: Boolean((source as Partial<ActivityChecks>).pushups),
    sitUps: Boolean((source as Partial<ActivityChecks>).sitUps),
    squats: Boolean((source as Partial<ActivityChecks>).squats),
    lunges: Boolean((source as Partial<ActivityChecks>).lunges),
    dribbles: Boolean((source as Partial<ActivityChecks>).dribbles),
    jumpRopes: Boolean((source as Partial<ActivityChecks>).jumpRopes),
    cardio: Boolean((source as Partial<ActivityChecks>).cardio),
    shoots: Boolean((source as Partial<ActivityChecks>).shoots),
  };
}

function normalizeActivityNotes(value: unknown): ActivityNotes {
  const source = typeof value === "object" && value ? value : {};

  return {
    pushups: String((source as Partial<ActivityNotes>).pushups ?? "").trim(),
    sitUps: String((source as Partial<ActivityNotes>).sitUps ?? "").trim(),
    squats: String((source as Partial<ActivityNotes>).squats ?? "").trim(),
    lunges: String((source as Partial<ActivityNotes>).lunges ?? "").trim(),
    dribbles: String((source as Partial<ActivityNotes>).dribbles ?? "").trim(),
    jumpRopes: String((source as Partial<ActivityNotes>).jumpRopes ?? "").trim(),
    cardio: String((source as Partial<ActivityNotes>).cardio ?? "").trim(),
    shoots: String((source as Partial<ActivityNotes>).shoots ?? "").trim(),
  };
}

function normalizeLog(log: Partial<WorkoutLog> & Pick<WorkoutLog, "id">): WorkoutLog {
  return {
    id: log.id,
    athlete_name: String(log.athlete_name ?? ""),
    team_name: (log.team_name ?? "Undecided") as TeamName,
    workout_date: String(log.workout_date ?? ""),
    activities: normalizeActivityChecks(log.activities),
    activity_notes: normalizeActivityNotes(log.activity_notes),
    notes: log.notes ?? null,
    focus_area: log.focus_area ?? null,
    effort_level: log.effort_level ?? null,
    advanced_notes: log.advanced_notes ?? null,
    created_at: String(log.created_at ?? new Date().toISOString()),
    updated_at: String(log.updated_at ?? new Date().toISOString()),
  };
}

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
    return sortLogs(parsed.map((entry) => normalizeLog(entry)));
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
    logs: sortLogs(((data ?? []) as WorkoutLog[]).map((entry) => normalizeLog(entry))),
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
    activities: normalizeActivityChecks(input.activities),
    activity_notes: normalizeActivityNotes(input.activity_notes),
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
        ? normalizeLog({
            ...logs[existingIndex],
            ...payload,
            updated_at: now,
          })
        : normalizeLog({
            id: `local-${Date.now()}`,
            ...payload,
            created_at: now,
            updated_at: now,
          });

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
    log: normalizeLog(data as WorkoutLog),
    source: "supabase",
  };
}
