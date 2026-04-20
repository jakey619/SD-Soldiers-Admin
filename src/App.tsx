import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import AdminPortal from "./AdminPortal";
import soldiersLogo from "./assets/soldiers-logo.png";
import soldiersSplash from "./assets/soldiers-logo.jpg";
import "./app.css";
import { supabase } from "./lib/supabase";
import {
  fetchWorkoutLogs,
  saveWorkoutLog,
  type ActivityChecks,
  type ActivityNotes,
  type TeamName,
  type WorkoutActivityKey,
  type WorkoutDataSource,
  type WorkoutLog,
} from "./lib/workoutLogs";

type AccessMode = "home" | "athlete" | "admin";
type AdminView = "workouts" | "management";
type SummaryView = "daily" | "weekly" | "athlete";
type CompletionFilter = "all" | "complete" | "incomplete";
type FocusArea =
  | ""
  | "Ball Handling"
  | "Shooting"
  | "Footwork"
  | "Strength"
  | "Conditioning"
  | "Recovery"
  | "Team Practice"
  | "Other";

type AthleteIdentity = {
  athleteName: string;
  teamName: TeamName;
};

type AthleteForm = AthleteIdentity;

type WorkoutForm = {
  workoutDate: string;
  notes: string;
  focusArea: FocusArea;
  effortLevel: string;
  advancedNotes: string;
  activities: ActivityChecks;
  activityNotes: ActivityNotes;
};

type WorkoutActivityDefinition = {
  key: WorkoutActivityKey;
  label: string;
  description: string;
};

type AthletePlayerOption = {
  id: string;
  fullName: string;
  teamName: TeamName;
};

const APP_VERSION = "2.2.1";

const TEAM_NAMES: TeamName[] = [
  "15u Salute",
  "15u Honor",
  "16u Salute",
  "16u Honor",
  "17u Salute",
  "17u Honor",
  "2030 Salute",
  "2030 Honor",
  "2031 Salute",
  "2031 Honor",
  "2032 Salute",
  "2032 Honor",
  "Undecided",
];

const WORKOUT_ACTIVITIES: WorkoutActivityDefinition[] = [
  {
    key: "pushups",
    label: "Pushups",
    description: "Upper-body strength work. Use this when you completed pushup sets.",
  },
  {
    key: "sitUps",
    label: "Sit-ups",
    description: "Core training focused on trunk control and abdominal endurance.",
  },
  {
    key: "dribbles",
    label: "Dribbles",
    description:
      "Ball-handling reps like pound dribbles, crossovers, combo work, or weak-hand drills.",
  },
  {
    key: "squats",
    label: "Squats",
    description: "Lower-body strength and explosion work with bodyweight or added resistance.",
  },
  {
    key: "lunges",
    label: "Lunges",
    description: "Single-leg movement work for balance, strength, and mobility.",
  },
  {
    key: "jumpRopes",
    label: "Jump Ropes",
    description: "Rhythm, conditioning, and footwork training using jump rope rounds.",
  },
  {
    key: "cardio",
    label: "Cardio",
    description: "Conditioning work such as running, biking, intervals, or stamina circuits.",
  },
  {
    key: "shoots",
    label: "Shoots",
    description: "Shooting reps including form shooting, spot shooting, game shots, or free throws.",
  },
];

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || "SoldiersAdmin";
const REQUIRED_DAILY_TASK_COUNT = 5;
const MANDATORY_ACTIVITY_KEYS: WorkoutActivityKey[] = ["pushups", "sitUps", "dribbles"];

function createEmptyActivities(): ActivityChecks {
  return {
    pushups: false,
    sitUps: false,
    squats: false,
    lunges: false,
    dribbles: false,
    jumpRopes: false,
    cardio: false,
    shoots: false,
  };
}

function createEmptyActivityNotes(): ActivityNotes {
  return {
    pushups: "",
    sitUps: "",
    squats: "",
    lunges: "",
    dribbles: "",
    jumpRopes: "",
    cardio: "",
    shoots: "",
  };
}

function todayIsoDate() {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  const localDate = new Date(today.getTime() - offset * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function startOfWeekLabel(dateString: string) {
  const base = new Date(`${dateString}T12:00:00`);
  const day = base.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(base);
  monday.setDate(base.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

function formatDateLabel(dateString: string) {
  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function shiftIsoDate(dateString: string, dayOffset: number) {
  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) return todayIsoDate();
  date.setDate(date.getDate() + dayOffset);
  return date.toISOString().slice(0, 10);
}

function isBeforeDate(left: string, right: string) {
  return new Date(`${left}T12:00:00`).getTime() < new Date(`${right}T12:00:00`).getTime();
}

function formatMonthLabel(monthKey: string) {
  const date = new Date(`${monthKey}-01T12:00:00`);
  if (Number.isNaN(date.getTime())) return monthKey;
  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function shiftMonth(monthKey: string, monthOffset: number) {
  const date = new Date(`${monthKey}-01T12:00:00`);
  if (Number.isNaN(date.getTime())) return todayIsoDate().slice(0, 7);
  date.setMonth(date.getMonth() + monthOffset);
  return date.toISOString().slice(0, 7);
}

function buildCalendarDays(monthKey: string) {
  const start = new Date(`${monthKey}-01T12:00:00`);
  if (Number.isNaN(start.getTime())) return [] as string[];

  const year = start.getFullYear();
  const month = start.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(year, month, index + 1, 12, 0, 0);
    return date.toISOString().slice(0, 10);
  });
}

function createWorkoutForm(): WorkoutForm {
  return {
    workoutDate: todayIsoDate(),
    notes: "",
    focusArea: "",
    effortLevel: "",
    advancedNotes: "",
    activities: createEmptyActivities(),
    activityNotes: createEmptyActivityNotes(),
  };
}

function workoutDraftStorageKey(identity: AthleteIdentity, date: string) {
  return `soldiers-workout-draft::${identity.athleteName.toLowerCase()}::${identity.teamName}::${date}`;
}

function workoutFormSnapshot(form: WorkoutForm) {
  return JSON.stringify(form);
}

function readWorkoutDraft(identity: AthleteIdentity, date: string): WorkoutForm | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(workoutDraftStorageKey(identity, date));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<WorkoutForm>;
    return {
      workoutDate: parsed.workoutDate || date,
      notes: parsed.notes || "",
      focusArea: (parsed.focusArea as FocusArea) || "",
      effortLevel: parsed.effortLevel || "",
      advancedNotes: parsed.advancedNotes || "",
      activities: {
        ...createEmptyActivities(),
        ...(parsed.activities ?? {}),
      },
      activityNotes: {
        ...createEmptyActivityNotes(),
        ...(parsed.activityNotes ?? {}),
      },
    };
  } catch {
    return null;
  }
}

function writeWorkoutDraft(identity: AthleteIdentity, form: WorkoutForm) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    workoutDraftStorageKey(identity, form.workoutDate),
    JSON.stringify(form)
  );
}

function clearWorkoutDraft(identity: AthleteIdentity, date: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(workoutDraftStorageKey(identity, date));
}

function formFromWorkoutLog(log: WorkoutLog): WorkoutForm {
  return {
    workoutDate: log.workout_date,
    notes: log.notes ?? "",
    focusArea: (log.focus_area as FocusArea) || "",
    effortLevel: log.effort_level != null ? String(log.effort_level) : "",
    advancedNotes: log.advanced_notes ?? "",
    activities: {
      ...createEmptyActivities(),
      ...log.activities,
    },
    activityNotes: {
      ...createEmptyActivityNotes(),
      ...log.activity_notes,
    },
  };
}

function formatActivityNotes(activityNotes: ActivityNotes, activities: ActivityChecks) {
  return WORKOUT_ACTIVITIES.map((activity) => ({
    label: activity.label,
    note: activityNotes[activity.key].trim(),
    checked: activities[activity.key],
  })).filter((entry) => entry.checked || entry.note);
}

function countCompletedActivities(activities: ActivityChecks) {
  return Object.values(activities).filter(Boolean).length;
}

function activityLabel(key: WorkoutActivityKey) {
  return WORKOUT_ACTIVITIES.find((activity) => activity.key === key)?.label ?? key;
}

function getMissingMandatoryActivities(activities: ActivityChecks) {
  return MANDATORY_ACTIVITY_KEYS.filter((key) => !activities[key]).map(activityLabel);
}

function meetsDailyWorkoutRequirement(activities: ActivityChecks) {
  return (
    countCompletedActivities(activities) >= REQUIRED_DAILY_TASK_COUNT &&
    getMissingMandatoryActivities(activities).length === 0
  );
}

function dailyRequirementMessage(activities: ActivityChecks) {
  const missingMandatory = getMissingMandatoryActivities(activities);
  const completedCount = countCompletedActivities(activities);

  if (meetsDailyWorkoutRequirement(activities)) {
    return `Daily requirement met: ${completedCount} tasks completed, including all mandatory items.`;
  }

  if (missingMandatory.length > 0 && completedCount < REQUIRED_DAILY_TASK_COUNT) {
    return `Still needed: ${REQUIRED_DAILY_TASK_COUNT - completedCount} more task(s), plus ${missingMandatory.join(", ")}.`;
  }

  if (missingMandatory.length > 0) {
    return `Mandatory tasks still missing: ${missingMandatory.join(", ")}.`;
  }

  return `Complete ${REQUIRED_DAILY_TASK_COUNT - completedCount} more task(s) to finish the day.`;
}

function completionLabel(activities: ActivityChecks) {
  return meetsDailyWorkoutRequirement(activities) ? "Complete" : "Incomplete";
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function buildRingStyle(percent: number, color: string) {
  const safePercent = clampPercent(percent);
  return {
    background: `conic-gradient(${color} 0deg ${safePercent * 3.6}deg, rgba(30, 41, 59, 0.88) ${safePercent * 3.6}deg 360deg)`,
  };
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("unable") || normalized.includes("not recognized")) {
    return "error";
  }
  if (
    normalized.includes("still needed") ||
    normalized.includes("mandatory") ||
    normalized.includes("draft saved")
  ) {
    return "warn";
  }
  if (normalized.includes("save") || normalized.includes("loaded")) {
    return "success";
  }
  return "info";
}

function useWorkoutLogs() {
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [source, setSource] = useState<WorkoutDataSource>("supabase");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadLogs() {
    setLoading(true);
    setError("");

    try {
      const result = await fetchWorkoutLogs();
      setLogs(result.logs);
      setSource(result.source);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Unable to load workout logs.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function saveLog(identity: AthleteIdentity, form: WorkoutForm) {
    const result = await saveWorkoutLog({
      athlete_name: identity.athleteName,
      team_name: identity.teamName,
      workout_date: form.workoutDate,
      activities: form.activities,
      activity_notes: form.activityNotes,
      notes: form.notes,
      focus_area: form.focusArea || null,
      effort_level: form.effortLevel ? Number(form.effortLevel) : null,
      advanced_notes: form.advancedNotes,
    });

    setSource(result.source);
    setLogs((current) => {
      const existingIndex = current.findIndex((entry) => entry.id === result.log.id);
      if (existingIndex >= 0) {
        const next = [...current];
        next[existingIndex] = result.log;
        return next.sort(
          (a, b) =>
            new Date(b.workout_date).getTime() - new Date(a.workout_date).getTime()
        );
      }

      return [result.log, ...current].sort(
        (a, b) =>
          new Date(b.workout_date).getTime() - new Date(a.workout_date).getTime()
      );
    });

    return result;
  }

  useEffect(() => {
    void loadLogs();
  }, []);

  return {
    logs,
    source,
    loading,
    error,
    reload: loadLogs,
    saveLog,
  };
}

function useAthletePlayers() {
  const [players, setPlayers] = useState<AthletePlayerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadPlayers() {
      setLoading(true);
      setError("");

      const { data, error: loadError } = await supabase
        .from("players")
        .select("id, first_name, last_name, suggested_team")
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true });

      if (!isMounted) return;

      if (loadError) {
        setPlayers([]);
        setError(loadError.message);
        setLoading(false);
        return;
      }

      const nextPlayers = (data ?? [])
        .map((player) => {
          const firstName = String(player.first_name ?? "").trim();
          const lastName = String(player.last_name ?? "").trim();
          const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

          if (!fullName) {
            return null;
          }

          return {
            id: String(player.id),
            fullName,
            teamName: ((player.suggested_team as TeamName | null) ?? "Undecided") as TeamName,
          };
        })
        .filter((player): player is AthletePlayerOption => Boolean(player));

      setPlayers(nextPlayers);
      setLoading(false);
    }

    void loadPlayers();

    return () => {
      isMounted = false;
    };
  }, []);

  return { players, loading, error };
}

function HomeScreen({
  athleteForm,
  athletePlayers,
  athletePlayersLoading,
  athletePlayersError,
  adminPassword,
  onAthleteFormChange,
  onAthleteEnter,
  onAdminPasswordChange,
  onAdminEnter,
  message,
}: {
  athleteForm: AthleteForm;
  athletePlayers: AthletePlayerOption[];
  athletePlayersLoading: boolean;
  athletePlayersError: string;
  adminPassword: string;
  onAthleteFormChange: (next: AthleteForm) => void;
  onAthleteEnter: () => void;
  onAdminPasswordChange: (value: string) => void;
  onAdminEnter: () => void;
  message: string;
}) {
  const teamPlayers = athletePlayers.filter(
    (player) => player.teamName === athleteForm.teamName
  );

  return (
    <div className="app-shell app-shell-auth">
      <header className="top-bar auth-top-bar">
        <div className="brand">
          <img src={soldiersLogo} alt="San Diego Soldiers logo" className="brand-logo" />
          <div className="brand-text">
            <div className="brand-title">San Diego Soldiers</div>
            <div className="brand-subtitle">
              Athlete workout tracking with protected admin access
            </div>
          </div>
        </div>
        <div className="status-area">
          <div className="app-status">Version {APP_VERSION}</div>
        </div>
      </header>

      <main className="auth-layout">
        <section className="card auth-card auth-hero-card">
          <div className="auth-hero-media">
            <img
              src={soldiersSplash}
              alt="San Diego Soldiers team splash"
              className="auth-hero-image"
            />
            <div className="auth-hero-overlay">
              <div className="panel-kicker">Program Access</div>
              <h1 className="panel-title auth-hero-title">Choose how you want to enter the app.</h1>
              <p className="auth-hero-copy">
                Athletes only see their workout tools. Admin tools and the management
                dashboard stay hidden unless the admin password is entered.
              </p>
            </div>
          </div>

          <div className="auth-hero-stats">
            <div className="auth-hero-stat">
              <span>Access</span>
              <strong>Athlete + Admin</strong>
            </div>
            <div className="auth-hero-stat">
              <span>Primary Use</span>
              <strong>Phone Friendly</strong>
            </div>
            <div className="auth-hero-stat">
              <span>Focus</span>
              <strong>Daily Accountability</strong>
            </div>
          </div>
          {message ? <div className="status-banner info">{message}</div> : null}
        </section>

        <section className="auth-grid">
          <form
            className="card auth-card"
            onSubmit={(event) => {
              event.preventDefault();
              onAthleteEnter();
            }}
          >
            <div className="panel-kicker">Athlete Login</div>
            <h2 className="section-title">Daily workout check-in</h2>
            <label className="field-label" htmlFor="athlete-name">
              Athlete Name
            </label>
            <select
              id="athlete-name"
              className="select"
              value={athleteForm.athleteName}
              onChange={(event) =>
                onAthleteFormChange({
                  ...athleteForm,
                  athleteName: event.target.value,
                })
              }
              disabled={athletePlayersLoading || teamPlayers.length === 0}
            >
              <option value="">
                {athletePlayersLoading
                  ? "Loading player names..."
                  : teamPlayers.length === 0
                    ? "No players found for this team"
                    : "Select your name"}
              </option>
              {teamPlayers.map((player) => (
                <option key={player.id} value={player.fullName}>
                  {player.fullName}
                </option>
              ))}
            </select>
            {athletePlayersError ? (
              <div className="status-banner error">{athletePlayersError}</div>
            ) : null}

            <label className="field-label" htmlFor="athlete-team">
              Team Name
            </label>
            <select
              id="athlete-team"
              className="select"
              value={athleteForm.teamName}
              onChange={(event) =>
                onAthleteFormChange({
                  ...athleteForm,
                  teamName: event.target.value as TeamName,
                })
              }
            >
              {TEAM_NAMES.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>

            <button type="submit" className="primary-button">
              Enter Athlete Area
            </button>
          </form>

          <form
            className="card auth-card"
            onSubmit={(event) => {
              event.preventDefault();
              onAdminEnter();
            }}
          >
            <div className="panel-kicker">Admin Login</div>
            <h2 className="section-title">Protected management access</h2>
            <label className="field-label" htmlFor="admin-password">
              Admin Password
            </label>
            <input
              id="admin-password"
              className="input"
              type="password"
              value={adminPassword}
              onChange={(event) => onAdminPasswordChange(event.target.value)}
              placeholder="Enter admin password"
            />
            <div className="auth-help-text">
              Admin-only menus stay hidden from athletes and other regular users.
            </div>

            <button type="submit" className="secondary-button">
              Enter Admin Area
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

function AthleteWorkspace({
  identity,
  logs,
  onBack,
  onSubmit,
}: {
  identity: AthleteIdentity;
  logs: WorkoutLog[];
  onBack: () => void;
  onSubmit: (form: WorkoutForm) => Promise<void>;
}) {
  const [selectedDate, setSelectedDate] = useState(() => todayIsoDate());
  const [form, setForm] = useState<WorkoutForm>(() => ({
    ...createWorkoutForm(),
    workoutDate: todayIsoDate(),
  }));
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [openActivityKey, setOpenActivityKey] = useState<WorkoutActivityKey | null>("pushups");
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const [historySheetOpen, setHistorySheetOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => todayIsoDate().slice(0, 7));
  const [celebrating, setCelebrating] = useState(false);
  const skipAutosaveRef = useRef(true);
  const lastSavedSnapshotRef = useRef("");
  const historyRef = useRef<HTMLElement | null>(null);
  const previousCompleteStateRef = useRef(false);

  const personalLogs = useMemo(
    () =>
      logs.filter(
        (entry) =>
          entry.athlete_name.toLowerCase() === identity.athleteName.toLowerCase() &&
          entry.team_name === identity.teamName
      ),
    [identity.athleteName, identity.teamName, logs]
  );

  const selectedLog =
    personalLogs.find((entry) => entry.workout_date === selectedDate) ?? null;
  const activityCount = countCompletedActivities(form.activities);
  const historyPreview = personalLogs.slice(0, historyExpanded ? 20 : 4);
  const selectedActivityRatio = `${activityCount}/${WORKOUT_ACTIVITIES.length}`;
  const requiredProgressRatio = `${Math.min(activityCount, REQUIRED_DAILY_TASK_COUNT)}/${REQUIRED_DAILY_TASK_COUNT}`;
  const mandatoryCompletedCount = MANDATORY_ACTIVITY_KEYS.filter((key) => form.activities[key]).length;
  const mandatoryProgressRatio = `${mandatoryCompletedCount}/${MANDATORY_ACTIVITY_KEYS.length}`;
  const previousLog =
    personalLogs.find((entry) => isBeforeDate(entry.workout_date, selectedDate)) ?? null;
  const dailyRequirementMet = meetsDailyWorkoutRequirement(form.activities);
  const requirementMessage = dailyRequirementMessage(form.activities);
  const remainingTaskCount = Math.max(REQUIRED_DAILY_TASK_COUNT - activityCount, 0);
  const missingMandatory = getMissingMandatoryActivities(form.activities);
  const personalLogMap = useMemo(
    () => new Map(personalLogs.map((entry) => [entry.workout_date, entry])),
    [personalLogs]
  );
  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth]);
  const today = todayIsoDate();
  const yesterday = shiftIsoDate(today, -1);
  const weekStart = startOfWeekLabel(today);
  const currentStreak = useMemo(() => {
    const completeDates = personalLogs
      .filter((entry) => meetsDailyWorkoutRequirement(entry.activities))
      .map((entry) => entry.workout_date)
      .sort((a, b) => b.localeCompare(a));

    if (completeDates.length === 0) return 0;

    let streak = 1;
    let cursor = completeDates[0];

    for (let index = 1; index < completeDates.length; index += 1) {
      const expectedPrevious = shiftIsoDate(cursor, -1);
      if (completeDates[index] !== expectedPrevious) {
        break;
      }

      streak += 1;
      cursor = completeDates[index];
    }

    return streak;
  }, [personalLogs]);
  const lastCompleteDate = useMemo(() => {
    const completeLog = personalLogs.find((entry) => meetsDailyWorkoutRequirement(entry.activities));
    return completeLog?.workout_date ?? null;
  }, [personalLogs]);
  const streakGoal = 7;
  const targetPercent = (Math.min(activityCount, REQUIRED_DAILY_TASK_COUNT) / REQUIRED_DAILY_TASK_COUNT) * 100;
  const mandatoryPercent = (mandatoryCompletedCount / MANDATORY_ACTIVITY_KEYS.length) * 100;
  const streakPercent = (Math.min(currentStreak, streakGoal) / streakGoal) * 100;
  const weeklyLogs = personalLogs.filter(
    (entry) => entry.workout_date >= weekStart && entry.workout_date <= today
  );
  const weeklyCompletedLogs = weeklyLogs.filter((entry) =>
    meetsDailyWorkoutRequirement(entry.activities)
  );
  const weeklyLoggedCount = weeklyLogs.length;
  const weeklyCompletedCount = weeklyCompletedLogs.length;
  const bestStreak = useMemo(() => {
    const completeDates = personalLogs
      .filter((entry) => meetsDailyWorkoutRequirement(entry.activities))
      .map((entry) => entry.workout_date)
      .sort((a, b) => a.localeCompare(b));

    if (completeDates.length === 0) return 0;

    let longest = 1;
    let running = 1;

    for (let index = 1; index < completeDates.length; index += 1) {
      const expected = shiftIsoDate(completeDates[index - 1], 1);
      if (completeDates[index] === expected) {
        running += 1;
        longest = Math.max(longest, running);
      } else {
        running = 1;
      }
    }

    return longest;
  }, [personalLogs]);
  const recentAccountability = [
    {
      date: today,
      label: "Today",
      log: personalLogMap.get(today) ?? null,
    },
    {
      date: yesterday,
      label: "Yesterday",
      log: personalLogMap.get(yesterday) ?? null,
    },
  ];
  const accountabilityAlerts = recentAccountability.filter((entry) => {
    if (!entry.log) return true;
    return !meetsDailyWorkoutRequirement(entry.log.activities);
  });
  const suggestedActivities = WORKOUT_ACTIVITIES.filter(
    (activity) => !form.activities[activity.key]
  ).sort((left, right) => {
    const leftRequired = MANDATORY_ACTIVITY_KEYS.includes(left.key) ? 0 : 1;
    const rightRequired = MANDATORY_ACTIVITY_KEYS.includes(right.key) ? 0 : 1;
    return leftRequired - rightRequired;
  });
  const topSuggestedActivities = suggestedActivities.slice(0, 3);
  const nextActionCopy = dailyRequirementMet
    ? "Everything required is done. Add notes, review the day, or move to tomorrow."
    : topSuggestedActivities.length > 0
      ? `Best next step: ${topSuggestedActivities
          .map((activity) => activity.label)
          .join(", ")}.`
      : "Review your notes and make sure the required work is checked off.";
  const weeklyRewardTone =
    currentStreak >= streakGoal ? "elite" : currentStreak >= 4 ? "hot" : "building";
  const weeklyRewardTitle =
    weeklyRewardTone === "elite"
      ? "7-day streak unlocked"
      : weeklyRewardTone === "hot"
        ? "Streak is heating up"
        : "Momentum is building";
  const weeklyRewardCopy =
    weeklyRewardTone === "elite"
      ? "You've built a full week of complete days. Keep protecting the streak."
      : weeklyRewardTone === "hot"
        ? `${streakGoal - currentStreak} more complete day(s) to unlock your 7-day streak badge.`
        : "Complete today, then stack a few more days to build your rhythm.";
  const athleteMomentumMessage = dailyRequirementMet
    ? currentStreak >= streakGoal
      ? "All rings closed and your streak is rolling. Keep stacking complete days."
      : `All rings closed for today. ${streakGoal - Math.min(currentStreak, streakGoal)} more day(s) to reach a 7-day streak.`
    : missingMandatory.length > 0
      ? `Knock out the required work first: ${missingMandatory.join(", ")}.`
      : remainingTaskCount > 0
        ? `You're close. Complete ${remainingTaskCount} more task(s) to close the day.`
        : "You have enough tasks checked, but the required items still need to be completed.";
  const filteredHistoryLogs = personalLogs.filter((entry) => {
    const term = historySearch.trim().toLowerCase();
    if (!term) return true;

    return [
      entry.workout_date,
      formatDateLabel(entry.workout_date),
      entry.notes,
      entry.advanced_notes,
      ...Object.values(entry.activity_notes),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(term);
  });

  useEffect(() => {
    const savedLog =
      personalLogs.find((entry) => entry.workout_date === selectedDate) ?? null;
    const nextForm = savedLog
      ? formFromWorkoutLog(savedLog)
      : readWorkoutDraft(identity, selectedDate) ?? {
          ...createWorkoutForm(),
          workoutDate: selectedDate,
        };

    const nextSnapshot = workoutFormSnapshot(nextForm);

    if (savedLog) {
      lastSavedSnapshotRef.current = nextSnapshot;
      clearWorkoutDraft(identity, selectedDate);
    } else {
      lastSavedSnapshotRef.current = "";
    }

    skipAutosaveRef.current = true;
    setForm(nextForm);
    setOpenActivityKey((current) => {
      if (current && (savedLog?.activities[current] || nextForm.activityNotes[current])) {
        return current;
      }

      const firstCompleted = WORKOUT_ACTIVITIES.find(
        (activity) =>
          nextForm.activities[activity.key] || nextForm.activityNotes[activity.key].trim()
      );

      return firstCompleted?.key ?? "pushups";
    });
  }, [identity, personalLogs, selectedDate]);

  useEffect(() => {
    setCalendarMonth(selectedDate.slice(0, 7));
  }, [selectedDate]);

  useEffect(() => {
    if (dailyRequirementMet && !previousCompleteStateRef.current) {
      setCelebrating(true);
      const timer = window.setTimeout(() => setCelebrating(false), 2200);
      previousCompleteStateRef.current = true;
      return () => window.clearTimeout(timer);
    }

    if (!dailyRequirementMet) {
      previousCompleteStateRef.current = false;
      setCelebrating(false);
    }
  }, [dailyRequirementMet]);

  async function saveCurrentForm(options?: { requireComplete?: boolean }) {
    if (options?.requireComplete && !dailyRequirementMet) {
      setStatus(
        `Final save blocked. ${dailyRequirementMessage(form.activities)}`
      );
      return;
    }

    setSaving(true);

    try {
      await onSubmit(form);
      lastSavedSnapshotRef.current = workoutFormSnapshot(form);
      clearWorkoutDraft(identity, form.workoutDate);
      setStatus(
        dailyRequirementMet
          ? `Saved ${formatDateLabel(form.workoutDate)}. Daily requirement met.`
          : `Draft saved for ${formatDateLabel(form.workoutDate)}. ${dailyRequirementMessage(form.activities)}`
      );
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : "Unable to save workout log.";
      setStatus(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    await saveCurrentForm({ requireComplete: true });
  }

  function applyTemplateFromLog(log: WorkoutLog, label: string) {
    setForm((current) => ({
      ...current,
      activities: {
        ...createEmptyActivities(),
        ...log.activities,
      },
      activityNotes: {
        ...createEmptyActivityNotes(),
        ...log.activity_notes,
      },
      notes: current.notes || log.notes || "",
      focusArea: current.focusArea || (log.focus_area as FocusArea) || "",
      effortLevel:
        current.effortLevel || (log.effort_level != null ? String(log.effort_level) : ""),
      advancedNotes: current.advancedNotes || log.advanced_notes || "",
    }));
    setStatus(`Loaded ${label} into ${formatDateLabel(selectedDate)}.`);
  }

  useEffect(() => {
    writeWorkoutDraft(identity, form);

    const snapshot = workoutFormSnapshot(form);
    if (skipAutosaveRef.current) {
      skipAutosaveRef.current = false;
      return;
    }

    if (snapshot === lastSavedSnapshotRef.current) {
      setSaving(false);
      return;
    }

    setSaving(true);
    setStatus(`Saving changes for ${formatDateLabel(form.workoutDate)}...`);

    const timer = window.setTimeout(async () => {
      try {
        await onSubmit(form);
        lastSavedSnapshotRef.current = snapshot;
        clearWorkoutDraft(identity, form.workoutDate);
        setStatus(
          dailyRequirementMet
            ? `All changes saved for ${formatDateLabel(form.workoutDate)}. Daily requirement met.`
            : `Draft saved for ${formatDateLabel(form.workoutDate)}. ${dailyRequirementMessage(form.activities)}`
        );
      } catch (saveError) {
        const message =
          saveError instanceof Error ? saveError.message : "Unable to save workout log.";
        setStatus(message);
      } finally {
        setSaving(false);
      }
    }, 700);

    return () => window.clearTimeout(timer);
  }, [form, identity, onSubmit]);

  return (
    <div className="app-shell athlete-shell">
      <header className="athlete-topbar">
        <div className="athlete-topbar-main">
          <div className="athlete-title-block">
            <div className="panel-kicker">Athlete Mode</div>
            <div className="athlete-title">Workout Journal</div>
            <div className="athlete-subtitle">
              {identity.athleteName} - {identity.teamName}
            </div>
          </div>
          <button type="button" className="secondary-button athlete-switch-button" onClick={onBack}>
            Switch User
          </button>
        </div>

        <div className="athlete-status-strip">
          <div className="athlete-status-item">
            <span>Date</span>
            <strong>{formatDateLabel(selectedDate)}</strong>
          </div>
          <div className="athlete-status-item">
            <span>Daily Goal</span>
            <strong>{requiredProgressRatio}</strong>
          </div>
          <div className="athlete-status-item">
            <span>Status</span>
            <strong>{saving ? "Saving" : dailyRequirementMet ? "Complete" : "In Progress"}</strong>
          </div>
        </div>
      </header>

      <div className="athlete-single-column">
        <form className="card athlete-form-card" onSubmit={handleSubmit}>
          <div className="athlete-date-toolbar">
            <div>
              <div className="panel-kicker">Quick Date</div>
              <h2 className="section-title athlete-section-title">Workout journal by date</h2>
            </div>
            <input
              id="workout-date"
              className="input athlete-date-input"
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </div>

          <div className="athlete-date-shortcuts">
            <button
              type="button"
              className="secondary-button athlete-shortcut-button"
              onClick={() => setSelectedDate(todayIsoDate())}
            >
              Today
            </button>
            <button
              type="button"
              className="secondary-button athlete-shortcut-button"
              onClick={() => setSelectedDate(shiftIsoDate(selectedDate, -1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="secondary-button athlete-shortcut-button"
              onClick={() => setSelectedDate(shiftIsoDate(selectedDate, 1))}
            >
              Next
            </button>
            <button
              type="button"
              className="secondary-button athlete-shortcut-button"
              onClick={() => setSelectedDate(shiftIsoDate(todayIsoDate(), -1))}
            >
              Yesterday
            </button>
          </div>

          {selectedLog ? (
            <div className="status-banner info">
              Loaded saved workout for {formatDateLabel(selectedDate)}.
            </div>
          ) : (
            <div className="status-banner info">
              No saved workout for this date yet. Start checking items and the app will remember them.
            </div>
          )}

          <div className="athlete-progress-block">
            <div className="athlete-progress-label">
              <span>Workout progress</span>
              <strong>{requiredProgressRatio} required tasks done</strong>
            </div>
            <div className="athlete-progress-track" aria-hidden="true">
              <div
                className="athlete-progress-fill"
                style={{
                  width: `${(Math.min(activityCount, REQUIRED_DAILY_TASK_COUNT) / REQUIRED_DAILY_TASK_COUNT) * 100}%`,
                }}
              />
            </div>
          </div>

          <section
            className={`athlete-rings-card ${celebrating ? "celebrating" : ""}`}
            aria-label="Daily motivation rings"
          >
            <div className="athlete-rings-header">
              <div>
                <div className="panel-kicker">Daily Momentum</div>
                <h3 className="section-title athlete-section-title">Close your rings</h3>
              </div>
              <span className={`badge ${dailyRequirementMet ? "badge-good" : "badge-neutral"}`}>
                {dailyRequirementMet ? "Day complete" : "Keep going"}
              </span>
            </div>

            <div className="athlete-rings-grid">
              <div className={`athlete-ring-panel ${targetPercent >= 100 ? "complete" : ""}`}>
                <div
                  className={`athlete-ring ${targetPercent >= 100 ? "complete" : ""}`}
                  style={buildRingStyle(targetPercent, "#22c55e")}
                  aria-hidden="true"
                >
                  <div className="athlete-ring-inner">
                    <strong>{requiredProgressRatio}</strong>
                    <span>Target</span>
                  </div>
                </div>
                <div className="athlete-ring-label">5-task goal</div>
                <div className="athlete-ring-copy">
                  {remainingTaskCount === 0 ? "Target reached" : `${remainingTaskCount} to go`}
                </div>
              </div>

              <div className={`athlete-ring-panel ${mandatoryPercent >= 100 ? "complete" : ""}`}>
                <div
                  className={`athlete-ring athlete-ring-gold ${mandatoryPercent >= 100 ? "complete" : ""}`}
                  style={buildRingStyle(mandatoryPercent, "#f59e0b")}
                  aria-hidden="true"
                >
                  <div className="athlete-ring-inner">
                    <strong>{mandatoryProgressRatio}</strong>
                    <span>Required</span>
                  </div>
                </div>
                <div className="athlete-ring-label">Mandatory work</div>
                <div className="athlete-ring-copy">
                  {missingMandatory.length === 0 ? "All required done" : missingMandatory.join(", ")}
                </div>
              </div>

              <div className={`athlete-ring-panel ${streakPercent >= 100 ? "complete" : ""}`}>
                <div
                  className={`athlete-ring athlete-ring-blue ${streakPercent >= 100 ? "complete" : ""}`}
                  style={buildRingStyle(streakPercent, "#38bdf8")}
                  aria-hidden="true"
                >
                  <div className="athlete-ring-inner">
                    <strong>{currentStreak}</strong>
                    <span>Streak</span>
                  </div>
                </div>
                <div className="athlete-ring-label">7-day momentum</div>
                <div className="athlete-ring-copy">
                  {currentStreak >= streakGoal
                    ? "Streak goal reached"
                    : `${streakGoal - currentStreak} day(s) to 7`}
                </div>
              </div>
            </div>

            <div className={`athlete-momentum-banner ${dailyRequirementMet ? "complete" : ""}`}>
              <strong>{dailyRequirementMet ? "Nice work." : "Next move."}</strong>
              <span>{athleteMomentumMessage}</span>
            </div>

            {celebrating ? (
              <div className="athlete-celebration-banner" role="status">
                Day complete. All required work is locked in.
              </div>
            ) : null}
          </section>

          <section className="athlete-accountability-card">
            <div className="athlete-accountability-header">
              <div>
                <div className="panel-kicker">Accountability</div>
                <h3 className="section-title athlete-section-title">Recent required work</h3>
              </div>
              <span className={`badge ${accountabilityAlerts.length === 0 ? "badge-good" : "badge-neutral"}`}>
                {accountabilityAlerts.length === 0 ? "On track" : `${accountabilityAlerts.length} item(s) to clean up`}
              </span>
            </div>

            <div className="athlete-accountability-list">
              {recentAccountability.map((entry) => {
                const isComplete = entry.log
                  ? meetsDailyWorkoutRequirement(entry.log.activities)
                  : false;
                const copy = !entry.log
                  ? "No workout has been logged yet."
                  : isComplete
                    ? "All required work is complete."
                    : dailyRequirementMessage(entry.log.activities);

                return (
                  <article
                    key={entry.date}
                    className={`athlete-accountability-item ${isComplete ? "complete" : "attention"}`}
                  >
                    <div className="athlete-accountability-top">
                      <strong>{entry.label}</strong>
                      <span>{formatDateLabel(entry.date)}</span>
                    </div>
                    <div className="athlete-accountability-copy">{copy}</div>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setSelectedDate(entry.date)}
                    >
                      Open {entry.label}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="athlete-coach-card">
            <div className="athlete-coach-header">
              <div>
                <div className="panel-kicker">Coach View</div>
                <h3 className="section-title athlete-section-title">What to do next</h3>
              </div>
              <span className={`badge badge-${dailyRequirementMet ? "good" : "info"}`}>
                {dailyRequirementMet ? "Ready to submit" : "Stay on it"}
              </span>
            </div>

            <div className="athlete-coach-copy">{nextActionCopy}</div>

            <div className="athlete-coach-grid">
              <article className={`athlete-coach-panel reward-${weeklyRewardTone}`}>
                <div className="athlete-coach-panel-title">{weeklyRewardTitle}</div>
                <div className="athlete-coach-panel-copy">{weeklyRewardCopy}</div>
              </article>

              <article className="athlete-coach-panel">
                <div className="athlete-coach-panel-title">Suggested next tasks</div>
                <div className="athlete-chip-row">
                  {topSuggestedActivities.length > 0 ? (
                    topSuggestedActivities.map((activity) => (
                      <button
                        key={activity.key}
                        type="button"
                        className={`athlete-suggestion-chip ${
                          MANDATORY_ACTIVITY_KEYS.includes(activity.key) ? "required" : ""
                        }`}
                        onClick={() => setOpenActivityKey(activity.key)}
                      >
                        {activity.label}
                      </button>
                    ))
                  ) : (
                    <span className="badge badge-good">All tasks needed for today are done</span>
                  )}
                </div>
              </article>
            </div>
          </section>

          <div className={`athlete-requirement-card ${dailyRequirementMet ? "complete" : ""}`}>
            <div className="athlete-requirement-header">
              <strong>Daily target: complete 5 tasks</strong>
              <span>{selectedActivityRatio} total checked</span>
            </div>
            <div className="athlete-requirement-copy">{requirementMessage}</div>
            <div className="workout-tag-row requirement-tag-row">
              {MANDATORY_ACTIVITY_KEYS.map((key) => (
                <span
                  key={key}
                  className={`badge ${form.activities[key] ? "badge-good" : "badge-neutral"}`}
                >
                  {activityLabel(key)} {form.activities[key] ? "required done" : "required"}
                </span>
              ))}
            </div>
          </div>

          <div className="athlete-template-row">
            <button
              type="button"
              className="secondary-button athlete-template-button"
              onClick={() =>
                previousLog ? applyTemplateFromLog(previousLog, "your previous workout") : null
              }
              disabled={!previousLog}
            >
              {previousLog
                ? `Use ${formatDateLabel(previousLog.workout_date)} as a starting point`
                : "No earlier workout to copy"}
            </button>
            <button
              type="button"
              className="secondary-button athlete-template-button"
              onClick={() =>
                selectedLog ? applyTemplateFromLog(selectedLog, "the saved workout") : null
              }
              disabled={!selectedLog}
            >
              Reload this date
            </button>
          </div>

          <div className="activity-stack">
            {WORKOUT_ACTIVITIES.map((activity) => {
              const isOpen = openActivityKey === activity.key;
              const hasContent =
                form.activities[activity.key] || Boolean(form.activityNotes[activity.key].trim());
              const notePreview = form.activityNotes[activity.key].trim();

              return (
                <article
                  key={activity.key}
                  className={`activity-card activity-card-accordion ${isOpen ? "open" : ""} ${
                    hasContent ? "selected" : ""
                  }`}
                >
                  <div className="activity-card-top">
                    <button
                      type="button"
                      className="activity-toggle-button"
                      onClick={() =>
                        setOpenActivityKey((current) =>
                          current === activity.key ? null : activity.key
                        )
                      }
                    >
                      <span className="activity-toggle-main">
                        <input
                          type="checkbox"
                          checked={form.activities[activity.key]}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              activities: {
                                ...current.activities,
                                [activity.key]: event.target.checked,
                              },
                            }))
                          }
                          onClick={(event) => event.stopPropagation()}
                        />
                        <span className="activity-card-title">{activity.label}</span>
                        {MANDATORY_ACTIVITY_KEYS.includes(activity.key) ? (
                          <span className="activity-mandatory-pill">Required</span>
                        ) : null}
                      </span>
                      <span className="activity-toggle-meta">
                        {form.activities[activity.key]
                          ? "Done"
                          : MANDATORY_ACTIVITY_KEYS.includes(activity.key)
                            ? "Required next"
                            : hasContent
                              ? "In progress"
                              : "Tap to open"}
                      </span>
                    </button>
                  </div>

                  <div className="activity-meta-row">
                    <button
                      type="button"
                      className="activity-inline-link"
                      onClick={() =>
                        setOpenActivityKey((current) =>
                          current === activity.key ? null : activity.key
                        )
                      }
                    >
                      {isOpen ? "Hide details" : "What counts?"}
                    </button>
                    {!isOpen && notePreview ? (
                      <span className="activity-collapsed-note">{notePreview}</span>
                    ) : null}
                  </div>

                  {isOpen ? (
                    <div className="activity-card-body">
                      <p className="activity-card-copy">{activity.description}</p>
                      <label
                        className="activity-note-label"
                        htmlFor={`activity-note-${activity.key}`}
                      >
                        Notes for {activity.label}
                      </label>
                      <textarea
                        id={`activity-note-${activity.key}`}
                        className="textarea activity-note-textarea"
                        value={form.activityNotes[activity.key]}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            activityNotes: {
                              ...current.activityNotes,
                              [activity.key]: event.target.value,
                            },
                          }))
                        }
                        placeholder={`Add ${activity.label.toLowerCase()} details, reps, time, or reminders`}
                      />
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          <label className="field-label" htmlFor="workout-notes">
            Daily Notes
          </label>
          <textarea
            id="workout-notes"
            className="textarea athlete-main-notes"
            value={form.notes}
            onChange={(event) =>
              setForm((current) => ({ ...current, notes: event.target.value }))
            }
            placeholder="What did you work on today?"
          />

          <details
            className="advanced-details"
            open={advancedExpanded}
            onToggle={(event) =>
              setAdvancedExpanded((event.currentTarget as HTMLDetailsElement).open)
            }
          >
            <summary>Advanced Section</summary>
            <div className="advanced-grid">
              <div>
                <label className="field-label" htmlFor="focus-area">
                  Focus Area
                </label>
                <select
                  id="focus-area"
                  className="select"
                  value={form.focusArea}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      focusArea: event.target.value as FocusArea,
                    }))
                  }
                >
                  <option value="">Select a focus</option>
                  <option value="Ball Handling">Ball Handling</option>
                  <option value="Shooting">Shooting</option>
                  <option value="Footwork">Footwork</option>
                  <option value="Strength">Strength</option>
                  <option value="Conditioning">Conditioning</option>
                  <option value="Recovery">Recovery</option>
                  <option value="Team Practice">Team Practice</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="field-label" htmlFor="effort-level">
                  Effort Level
                </label>
                <select
                  id="effort-level"
                  className="select"
                  value={form.effortLevel}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      effortLevel: event.target.value,
                    }))
                  }
                >
                  <option value="">Choose effort</option>
                  <option value="1">1 - Light</option>
                  <option value="2">2 - Steady</option>
                  <option value="3">3 - Solid</option>
                  <option value="4">4 - Strong</option>
                  <option value="5">5 - Max effort</option>
                </select>
              </div>
            </div>

            <label className="field-label" htmlFor="advanced-notes">
              Advanced Notes
            </label>
            <textarea
              id="advanced-notes"
              className="textarea"
              value={form.advancedNotes}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  advancedNotes: event.target.value,
                }))
              }
              placeholder="Optional details like reps, makes, miles, time, or goals."
            />
          </details>

          {status ? (
            <div className={`status-banner ${statusTone(status)}`}>{status}</div>
          ) : null}

          <button type="submit" className="primary-button athlete-save-button" disabled={saving}>
            {saving ? "Saving..." : dailyRequirementMet ? "Submit Complete Day" : "Complete Requirements To Submit"}
          </button>
        </form>

        <section ref={historyRef} className="card athlete-history-card">
          <div className="athlete-history-header">
            <div>
              <div className="panel-kicker">Workout History</div>
              <h2 className="section-title athlete-section-title">Saved dates</h2>
            </div>
            <button
              type="button"
              className="secondary-button athlete-history-toggle"
              onClick={() => setHistoryExpanded((current) => !current)}
            >
              {historyExpanded ? "Show Less" : "Show More"}
            </button>
          </div>

          <div className="athlete-streak-grid">
            <div className="summary-card summary-card-compact athlete-streak-card">
              <div className="summary-label">Current Streak</div>
              <div className="summary-value">{currentStreak}</div>
            </div>
            <div className="summary-card summary-card-compact athlete-streak-card">
              <div className="summary-label">Last Complete Day</div>
              <div className="summary-value summary-value-small">
                {lastCompleteDate ? formatDateLabel(lastCompleteDate) : "None yet"}
              </div>
            </div>
          </div>

          <div className="athlete-weekly-scorecard">
            <article className="summary-card summary-card-compact athlete-streak-card">
              <div className="summary-label">This Week Complete</div>
              <div className="summary-value">{weeklyCompletedCount}</div>
            </article>
            <article className="summary-card summary-card-compact athlete-streak-card">
              <div className="summary-label">This Week Logged</div>
              <div className="summary-value">{weeklyLoggedCount}</div>
            </article>
            <article className="summary-card summary-card-compact athlete-streak-card">
              <div className="summary-label">Best Streak</div>
              <div className="summary-value">{bestStreak}</div>
            </article>
          </div>

          <div className="athlete-calendar-card">
            <div className="athlete-calendar-header">
              <button
                type="button"
                className="secondary-button athlete-calendar-nav"
                onClick={() => setCalendarMonth((current) => shiftMonth(current, -1))}
              >
                Prev Month
              </button>
              <div className="athlete-calendar-title">{formatMonthLabel(calendarMonth)}</div>
              <button
                type="button"
                className="secondary-button athlete-calendar-nav"
                onClick={() => setCalendarMonth((current) => shiftMonth(current, 1))}
              >
                Next Month
              </button>
            </div>

            <div className="athlete-calendar-grid">
              {calendarDays.map((date) => {
                const entry = personalLogMap.get(date);
                const tone = !entry
                  ? "empty"
                  : meetsDailyWorkoutRequirement(entry.activities)
                    ? "complete"
                    : "incomplete";

                return (
                  <button
                    key={date}
                    type="button"
                    className={`athlete-calendar-day ${selectedDate === date ? "selected" : ""} ${tone}`}
                    onClick={() => setSelectedDate(date)}
                  >
                    <span>{Number(date.slice(-2))}</span>
                  </button>
                );
              })}
            </div>
            <div className="athlete-calendar-legend">
              <span className="legend-item">
                <span className="legend-dot complete" />
                Complete
              </span>
              <span className="legend-item">
                <span className="legend-dot incomplete" />
                Logged
              </span>
              <span className="legend-item">
                <span className="legend-dot empty" />
                No log
              </span>
            </div>
          </div>

          <div className="history-chip-row">
            {personalLogs.slice(0, 8).map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`filter-chip ${selectedDate === entry.workout_date ? "active" : ""}`}
                onClick={() => setSelectedDate(entry.workout_date)}
              >
                {formatDateLabel(entry.workout_date)}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="secondary-button athlete-sheet-button"
            onClick={() => setHistorySheetOpen(true)}
          >
            Open Full History
          </button>

          <div className="log-list athlete-history-list">
            {personalLogs.length === 0 ? (
              <div className="empty-text">No workouts logged yet.</div>
            ) : (
              historyPreview.map((entry) => {
                const completedActivities = Object.entries(entry.activities)
                  .filter(([, checked]) => checked)
                  .map(([key]) => activityLabel(key as WorkoutActivityKey));
                const activityNotes = formatActivityNotes(
                  entry.activity_notes,
                  entry.activities
                );

                return (
                  <article key={entry.id} className="workout-log-card athlete-history-entry">
                    <div className="workout-log-header">
                      <strong>{formatDateLabel(entry.workout_date)}</strong>
                      <span>{completedActivities.length} activities</span>
                    </div>
                    <div className="workout-tag-row">
                      {completedActivities.length === 0 ? (
                        <span className="badge badge-neutral">No items checked</span>
                      ) : (
                        completedActivities.map((label) => (
                          <span key={label} className="badge badge-info">
                            {label}
                          </span>
                        ))
                      )}
                    </div>
                    {entry.notes ? <div className="workout-log-copy">{entry.notes}</div> : null}
                    {activityNotes.length > 0 ? (
                      <div className="activity-note-list">
                        {activityNotes.map((item) => (
                          <div key={`${entry.id}-${item.label}`} className="activity-note-item">
                            <strong>{item.label}:</strong> {item.note || "Completed"}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {entry.advanced_notes ? (
                      <div className="workout-log-copy muted">{entry.advanced_notes}</div>
                    ) : null}
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setSelectedDate(entry.workout_date)}
                    >
                      Open This Date
                    </button>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>

      <div className="athlete-bottom-bar">
        <div className="athlete-bottom-status">
          <span>{saving ? "Saving..." : "Saved progress"}</span>
          <strong>{selectedActivityRatio} complete</strong>
        </div>
        <div className="athlete-bottom-actions">
          <button
            type="button"
            className="secondary-button athlete-bottom-button"
            onClick={() => setSelectedDate(todayIsoDate())}
          >
            Today
          </button>
          <button
            type="button"
            className="secondary-button athlete-bottom-button"
            onClick={() => setHistorySheetOpen(true)}
          >
            History
          </button>
          <button
            type="button"
            className="primary-button athlete-bottom-button"
            onClick={() => void saveCurrentForm({ requireComplete: true })}
            disabled={saving}
          >
            {dailyRequirementMet ? "Submit" : "Finish 5"}
          </button>
        </div>
      </div>

      {historySheetOpen ? (
        <div className="modal-overlay" onClick={() => setHistorySheetOpen(false)}>
          <div
            className="modal-card modal-card-wide athlete-history-sheet"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Workout History</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setHistorySheetOpen(false)}
              >
                x
              </button>
            </div>

            <input
              className="input"
              value={historySearch}
              onChange={(event) => setHistorySearch(event.target.value)}
              placeholder="Search dates or notes"
            />

            <div className="log-list athlete-history-sheet-list">
              {filteredHistoryLogs.length === 0 ? (
                <div className="empty-text">No saved workouts match that search.</div>
              ) : (
                filteredHistoryLogs.map((entry) => {
                  const completedActivities = Object.entries(entry.activities)
                    .filter(([, checked]) => checked)
                    .map(([key]) => activityLabel(key as WorkoutActivityKey));

                  return (
                    <article key={entry.id} className="workout-log-card athlete-history-entry">
                      <div className="workout-log-header">
                        <strong>{formatDateLabel(entry.workout_date)}</strong>
                        <span>{completedActivities.length} activities</span>
                      </div>
                      <div className="workout-tag-row">
                        {completedActivities.map((label) => (
                          <span key={`${entry.id}-${label}`} className="badge badge-info">
                            {label}
                          </span>
                        ))}
                      </div>
                      {entry.notes ? (
                        <div className="workout-log-copy history-sheet-copy">{entry.notes}</div>
                      ) : null}
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => {
                          setSelectedDate(entry.workout_date);
                          setHistorySheetOpen(false);
                        }}
                      >
                        Open This Date
                      </button>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AdminWorkoutOverview({
  logs,
  athletePlayers,
  source,
  loading,
  error,
  onRefresh,
}: {
  logs: WorkoutLog[];
  athletePlayers: AthletePlayerOption[];
  source: WorkoutDataSource;
  loading: boolean;
  error: string;
  onRefresh: () => Promise<void>;
}) {
  const [view, setView] = useState<SummaryView>("daily");
  const [search, setSearch] = useState("");
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [athleteFilter, setAthleteFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState("");

  const teamOptions = useMemo(
    () => ["all", ...new Set(logs.map((entry) => entry.team_name))],
    [logs]
  );

  const athleteOptions = useMemo(() => {
    const relevantLogs =
      teamFilter === "all"
        ? logs
        : logs.filter((entry) => entry.team_name === teamFilter);

    return [
      "all",
      ...new Set(
        relevantLogs
          .map((entry) => entry.athlete_name)
          .sort((a, b) => a.localeCompare(b))
      ),
    ];
  }, [logs, teamFilter]);

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();

    return logs.filter((entry) => {
      if (completionFilter === "complete" && !meetsDailyWorkoutRequirement(entry.activities)) {
        return false;
      }

      if (completionFilter === "incomplete" && meetsDailyWorkoutRequirement(entry.activities)) {
        return false;
      }

      if (teamFilter !== "all" && entry.team_name !== teamFilter) {
        return false;
      }

      if (athleteFilter !== "all" && entry.athlete_name !== athleteFilter) {
        return false;
      }

      if (dateFilter && entry.workout_date !== dateFilter) {
        return false;
      }

      if (!term) return true;

      return [
        entry.athlete_name,
        entry.team_name,
        entry.workout_date,
        entry.notes,
        entry.focus_area,
        entry.advanced_notes,
        completionLabel(entry.activities),
        dailyRequirementMessage(entry.activities),
        ...Object.values(entry.activity_notes),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [logs, search, completionFilter, teamFilter, athleteFilter, dateFilter]);

  const completeCount = useMemo(
    () => filteredLogs.filter((entry) => meetsDailyWorkoutRequirement(entry.activities)).length,
    [filteredLogs]
  );

  const incompleteLogs = useMemo(
    () => filteredLogs.filter((entry) => !meetsDailyWorkoutRequirement(entry.activities)),
    [filteredLogs]
  );

  const incompleteCount = incompleteLogs.length;
  const completionRate =
    filteredLogs.length === 0 ? 0 : Math.round((completeCount / filteredLogs.length) * 100);

  const totalCompletions = useMemo(
    () =>
      filteredLogs.reduce(
        (sum, entry) => sum + countCompletedActivities(entry.activities),
        0
      ),
    [filteredLogs]
  );

  const exceptionRows = useMemo(
    () =>
      incompleteLogs.map((entry) => ({
        id: entry.id,
        athlete: entry.athlete_name,
        team: entry.team_name,
        date: entry.workout_date,
        detail: dailyRequirementMessage(entry.activities),
      })),
    [incompleteLogs]
  );
  const focusDate = dateFilter || todayIsoDate();
  const focusDateLogs = useMemo(
    () => logs.filter((entry) => entry.workout_date === focusDate),
    [logs, focusDate]
  );
  const notLoggedToday = useMemo(() => {
    const relevantPlayers =
      teamFilter === "all"
        ? athletePlayers
        : athletePlayers.filter((player) => player.teamName === teamFilter);

    const loggedSet = new Set(
      focusDateLogs.map(
        (entry) => `${entry.team_name}::${entry.athlete_name.trim().toLowerCase()}`
      )
    );

    return relevantPlayers.filter(
      (player) => !loggedSet.has(`${player.teamName}::${player.fullName.trim().toLowerCase()}`)
    );
  }, [athletePlayers, focusDateLogs, teamFilter]);
  const teamCompletionRows = useMemo(() => {
    const relevantPlayers =
      teamFilter === "all"
        ? athletePlayers
        : athletePlayers.filter((player) => player.teamName === teamFilter);
    const teamMap = new Map<
      TeamName,
      { rosterCount: number; loggedCount: number; completeCount: number }
    >();

    relevantPlayers.forEach((player) => {
      const group =
        teamMap.get(player.teamName) ??
        { rosterCount: 0, loggedCount: 0, completeCount: 0 };
      group.rosterCount += 1;
      teamMap.set(player.teamName, group);
    });

    focusDateLogs.forEach((entry) => {
      const group =
        teamMap.get(entry.team_name) ??
        { rosterCount: 0, loggedCount: 0, completeCount: 0 };
      group.loggedCount += 1;
      if (meetsDailyWorkoutRequirement(entry.activities)) {
        group.completeCount += 1;
      }
      teamMap.set(entry.team_name, group);
    });

    return [...teamMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([team, data]) => ({
        team,
        ...data,
      }));
  }, [athletePlayers, focusDateLogs, teamFilter]);

  const dailyRows = useMemo(() => {
    const groups = new Map<
      string,
      { athletes: Set<string>; teams: Set<string>; activityTotal: number; logCount: number }
    >();

    filteredLogs.forEach((entry) => {
      const group =
        groups.get(entry.workout_date) ??
        { athletes: new Set(), teams: new Set(), activityTotal: 0, logCount: 0 };
      group.athletes.add(entry.athlete_name);
      group.teams.add(entry.team_name);
      group.activityTotal += countCompletedActivities(entry.activities);
      group.logCount += 1;
      groups.set(entry.workout_date, group);
    });

    return [...groups.entries()].map(([date, group]) => ({
      id: date,
      title: formatDateLabel(date),
      subtitle: `${group.athletes.size} athletes - ${group.teams.size} teams`,
      stat: `${group.activityTotal} items`,
      detail: `${group.logCount} logs submitted`,
    }));
  }, [filteredLogs]);

  const weeklyRows = useMemo(() => {
    const groups = new Map<
      string,
      { athletes: Set<string>; teams: Set<string>; activityTotal: number; logCount: number }
    >();

    filteredLogs.forEach((entry) => {
      const weekKey = startOfWeekLabel(entry.workout_date);
      const group =
        groups.get(weekKey) ??
        { athletes: new Set(), teams: new Set(), activityTotal: 0, logCount: 0 };
      group.athletes.add(entry.athlete_name);
      group.teams.add(entry.team_name);
      group.activityTotal += countCompletedActivities(entry.activities);
      group.logCount += 1;
      groups.set(weekKey, group);
    });

    return [...groups.entries()].map(([weekStart, group]) => ({
      id: weekStart,
      title: `Week of ${formatDateLabel(weekStart)}`,
      subtitle: `${group.athletes.size} athletes - ${group.teams.size} teams`,
      stat: `${group.activityTotal} items`,
      detail: `${group.logCount} logs submitted`,
    }));
  }, [filteredLogs]);

  const athleteRows = useMemo(() => {
    const groups = new Map<
      string,
      {
        athlete: string;
        team: TeamName;
        activityTotal: number;
        logCount: number;
        lastDate: string;
      }
    >();

    filteredLogs.forEach((entry) => {
      const key = `${entry.athlete_name.toLowerCase()}::${entry.team_name}`;
      const group =
        groups.get(key) ??
        {
          athlete: entry.athlete_name,
          team: entry.team_name,
          activityTotal: 0,
          logCount: 0,
          lastDate: entry.workout_date,
        };

      group.activityTotal += countCompletedActivities(entry.activities);
      group.logCount += 1;
      if (entry.workout_date > group.lastDate) {
        group.lastDate = entry.workout_date;
      }

      groups.set(key, group);
    });

    return [...groups.values()]
      .sort((a, b) => b.logCount - a.logCount || a.athlete.localeCompare(b.athlete))
      .map((group) => ({
        id: `${group.athlete}-${group.team}`,
        title: group.athlete,
        subtitle: `${group.team} - last workout ${formatDateLabel(group.lastDate)}`,
        stat: `${group.logCount} logs`,
        detail: `${group.activityTotal} checked items`,
      }));
  }, [filteredLogs]);

  const rows =
    view === "daily" ? dailyRows : view === "weekly" ? weeklyRows : athleteRows;

  return (
    <div className="admin-workout-shell">
      <div className="summary-row">
        <div className="summary-card">
          <div className="summary-label">Workout Logs</div>
          <div className="summary-value">{filteredLogs.length}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Completed Days</div>
          <div className="summary-value">{completeCount}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Incomplete Days</div>
          <div className="summary-value">{incompleteCount}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Completion Rate</div>
          <div className="summary-value summary-value-small">
            {filteredLogs.length === 0 ? "0%" : `${completionRate}%`}
          </div>
        </div>
      </div>

      <div className="summary-row admin-summary-row-compact">
        <div className="summary-card summary-card-compact">
          <div className="summary-label">Athletes Logged</div>
          <div className="summary-value">
            {new Set(filteredLogs.map((entry) => entry.athlete_name.toLowerCase())).size}
          </div>
        </div>
        <div className="summary-card summary-card-compact">
          <div className="summary-label">Activity Checks</div>
          <div className="summary-value">{totalCompletions}</div>
        </div>
        <div className="summary-card summary-card-compact">
          <div className="summary-label">Storage</div>
          <div className="summary-value summary-value-small">
            {source === "supabase" ? "Supabase" : "Local fallback"}
          </div>
        </div>
      </div>

      <section className="card">
        <div className="admin-toolbar">
          <div>
            <div className="panel-kicker">Workout Reporting</div>
            <h2 className="section-title">Admin workout overview</h2>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={() => void onRefresh()}
          >
            Refresh
          </button>
        </div>

        <div className="toolbar-row">
          <input
            className="input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by athlete, team, date, or note"
          />
          <select
            className="select group-select"
            value={view}
            onChange={(event) => setView(event.target.value as SummaryView)}
          >
            <option value="daily">Daily Overview</option>
            <option value="weekly">Weekly Overview</option>
            <option value="athlete">Person Overview</option>
          </select>
          <select
            className="select group-select"
            value={completionFilter}
            onChange={(event) => setCompletionFilter(event.target.value as CompletionFilter)}
          >
            <option value="all">All Statuses</option>
            <option value="complete">Completed Only</option>
            <option value="incomplete">Incomplete Only</option>
          </select>
          <select
            className="select group-select"
            value={teamFilter}
            onChange={(event) => setTeamFilter(event.target.value)}
          >
            <option value="all">All Teams</option>
            {teamOptions
              .filter((team) => team !== "all")
              .map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
          </select>
          <select
            className="select group-select"
            value={athleteFilter}
            onChange={(event) => setAthleteFilter(event.target.value)}
          >
            <option value="all">All Athletes</option>
            {athleteOptions
              .filter((athlete) => athlete !== "all")
              .map((athlete) => (
                <option key={athlete} value={athlete}>
                  {athlete}
                </option>
              ))}
          </select>
          <input
            className="input admin-date-filter"
            type="date"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
          />
        </div>

        <div className="admin-quick-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setDateFilter(todayIsoDate());
              setCompletionFilter("incomplete");
              setView("daily");
            }}
          >
            Show Incomplete Today
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setDateFilter(todayIsoDate());
              setCompletionFilter("complete");
              setView("daily");
            }}
          >
            Show Completed Today
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setDateFilter(todayIsoDate());
              setCompletionFilter("all");
              setView("daily");
            }}
          >
            Show Today&apos;s Logs
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setDateFilter("");
              setCompletionFilter("all");
              setTeamFilter("all");
              setAthleteFilter("all");
              setView("athlete");
            }}
          >
            Reset Filters
          </button>
        </div>

        <div className="admin-team-grid">
          {teamCompletionRows.map((row) => (
            <article key={row.team} className="team-stat-card admin-team-card">
              <div className="team-stat-title">{row.team}</div>
              <div className="team-stat-line">Roster: {row.rosterCount}</div>
              <div className="team-stat-line">Logged {formatDateLabel(focusDate)}: {row.loggedCount}</div>
              <div className="team-stat-line">Completed: {row.completeCount}</div>
            </article>
          ))}
        </div>

        <div className="admin-not-logged-card">
          <div className="panel-kicker">Accountability</div>
          <h3 className="section-title admin-subsection-title">
            Not logged for {formatDateLabel(focusDate)}
          </h3>
          <div className="admin-not-logged-list">
            {notLoggedToday.length === 0 ? (
              <div className="status-banner success">
                Everyone in the current team filter has logged for {formatDateLabel(focusDate)}.
              </div>
            ) : (
              notLoggedToday.slice(0, 12).map((player) => (
                <article
                  key={`${player.teamName}-${player.fullName}`}
                  className="admin-exception-row"
                >
                  <div className="admin-exception-title">
                    <strong>{player.fullName}</strong>
                    <span>{player.teamName}</span>
                  </div>
                  <div className="overview-card-copy">No workout log found for this date.</div>
                </article>
              ))
            )}
          </div>
        </div>

        {exceptionRows.length > 0 ? (
          <div className="admin-exception-card">
            <div className="panel-kicker">Exception List</div>
            <h3 className="section-title admin-subsection-title">Needs follow-up</h3>
            <div className="admin-exception-list">
              {exceptionRows.slice(0, 6).map((row) => (
                <article key={row.id} className="admin-exception-row">
                  <div className="admin-exception-title">
                    <strong>{row.athlete}</strong>
                    <span>
                      {row.team} - {formatDateLabel(row.date)}
                    </span>
                  </div>
                  <div className="overview-card-copy">{row.detail}</div>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="status-banner success">
            No exceptions in the current filter set. Every visible workout meets the daily requirement.
          </div>
        )}

        {error ? <div className="status-banner error">{error}</div> : null}
        {loading ? <div className="empty-text">Loading workout data...</div> : null}

        {!loading && (
          <div className="overview-grid">
            <div className="overview-list">
              {rows.length === 0 ? (
                <div className="empty-text">No workout logs match the current view.</div>
              ) : (
                rows.map((row) => (
                  <article key={row.id} className="overview-card">
                    <div className="overview-card-header">
                      <strong>{row.title}</strong>
                      <span>{row.stat}</span>
                    </div>
                    <div className="overview-card-copy">{row.subtitle}</div>
                    <div className="overview-card-copy muted">{row.detail}</div>
                  </article>
                ))
              )}
            </div>

            <div className="detail-column">
              <div className="detail-column-title">Latest submitted logs</div>
              <div className="log-list">
                {filteredLogs.slice(0, 10).map((entry) => {
                  const labels = Object.entries(entry.activities)
                    .filter(([, checked]) => checked)
                    .map(([key]) => activityLabel(key as WorkoutActivityKey));
                  const activityNotes = formatActivityNotes(
                    entry.activity_notes,
                    entry.activities
                  );

                  return (
                    <article key={entry.id} className="workout-log-card">
                      <div className="workout-log-header">
                        <strong>{entry.athlete_name}</strong>
                        <span>{formatDateLabel(entry.workout_date)}</span>
                      </div>
                      <div className="workout-log-copy">{entry.team_name}</div>
                      <div className="workout-tag-row">
                        <span
                          className={`badge ${
                            meetsDailyWorkoutRequirement(entry.activities)
                              ? "badge-good"
                              : "badge-neutral"
                          }`}
                        >
                          {completionLabel(entry.activities)}
                        </span>
                      </div>
                      <div className="workout-tag-row">
                        {labels.length === 0 ? (
                          <span className="badge badge-neutral">No activities checked</span>
                        ) : (
                          labels.map((label) => (
                            <span key={`${entry.id}-${label}`} className="badge badge-info">
                              {label}
                            </span>
                          ))
                        )}
                      </div>
                      {entry.notes ? <div className="workout-log-copy">{entry.notes}</div> : null}
                      {!meetsDailyWorkoutRequirement(entry.activities) ? (
                        <div className="status-banner warn admin-inline-warning">
                          {dailyRequirementMessage(entry.activities)}
                        </div>
                      ) : null}
                      {activityNotes.length > 0 ? (
                        <div className="activity-note-list">
                          {activityNotes.map((item) => (
                            <div key={`${entry.id}-${item.label}`} className="activity-note-item">
                              <strong>{item.label}:</strong> {item.note || "Completed"}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {entry.advanced_notes ? (
                        <div className="workout-log-copy muted">{entry.advanced_notes}</div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState<AccessMode>("home");
  const [adminView, setAdminView] = useState<AdminView>("workouts");
  const [athleteForm, setAthleteForm] = useState<AthleteForm>({
    athleteName: "",
    teamName: "15u Salute",
  });
  const [activeAthlete, setActiveAthlete] = useState<AthleteIdentity | null>(null);
  const [adminPassword, setAdminPassword] = useState("");
  const [homeMessage, setHomeMessage] = useState("");

  const { logs, source, loading, error, reload, saveLog } = useWorkoutLogs();
  const {
    players: athletePlayers,
    loading: athletePlayersLoading,
    error: athletePlayersError,
  } = useAthletePlayers();

  useEffect(() => {
    if (athletePlayersLoading) return;

    const matchingPlayers = athletePlayers.filter(
      (player) => player.teamName === athleteForm.teamName
    );

    const stillValid = matchingPlayers.some(
      (player) => player.fullName === athleteForm.athleteName
    );

    if (!stillValid && athleteForm.athleteName) {
      setAthleteForm((current) => ({
        ...current,
        athleteName: "",
      }));
    }
  }, [
    athleteForm.athleteName,
    athleteForm.teamName,
    athletePlayers,
    athletePlayersLoading,
  ]);

  async function handleAthleteSubmit(form: WorkoutForm) {
    if (!activeAthlete) return;
    await saveLog(activeAthlete, form);
  }

  function enterAthleteArea() {
    const trimmedName = athleteForm.athleteName.trim();
    if (!trimmedName) {
      setHomeMessage("Athletes need to enter their name before continuing.");
      return;
    }

    setActiveAthlete({
      athleteName: trimmedName,
      teamName: athleteForm.teamName,
    });
    setHomeMessage("");
    setMode("athlete");
  }

  function enterAdminArea() {
    if (adminPassword !== ADMIN_PASSWORD) {
      setHomeMessage("That admin password was not recognized.");
      return;
    }

    setHomeMessage("");
    setAdminPassword("");
    setMode("admin");
  }

  function returnHome() {
    setMode("home");
    setAdminView("workouts");
    setActiveAthlete(null);
  }

  if (mode === "home") {
    return (
      <HomeScreen
        athleteForm={athleteForm}
        athletePlayers={athletePlayers}
        athletePlayersLoading={athletePlayersLoading}
        athletePlayersError={athletePlayersError}
        adminPassword={adminPassword}
        onAthleteFormChange={setAthleteForm}
        onAthleteEnter={enterAthleteArea}
        onAdminPasswordChange={setAdminPassword}
        onAdminEnter={enterAdminArea}
        message={homeMessage}
      />
    );
  }

  if (mode === "athlete" && activeAthlete) {
    return (
      <AthleteWorkspace
        identity={activeAthlete}
        logs={logs}
        onBack={returnHome}
        onSubmit={handleAthleteSubmit}
      />
    );
  }

  return (
    <div className="admin-app-shell">
      <div className="admin-shell-nav">
        <div className="brand admin-brand">
          <img src={soldiersLogo} alt="San Diego Soldiers logo" className="brand-logo" />
          <div className="brand-text">
            <div className="brand-title">Admin Area</div>
            <div className="brand-subtitle">Protected staff access</div>
          </div>
        </div>

        <div className="admin-nav-buttons">
          <button
            type="button"
            className={`tab-button ${adminView === "workouts" ? "active" : ""}`}
            onClick={() => setAdminView("workouts")}
          >
            Workout Overview
          </button>
          <button
            type="button"
            className={`tab-button ${adminView === "management" ? "active" : ""}`}
            onClick={() => setAdminView("management")}
          >
            Management Portal
          </button>
        </div>

        <button type="button" className="secondary-button" onClick={returnHome}>
          Exit Admin Area
        </button>
      </div>

      <div className="admin-shell-main">
        {adminView === "workouts" ? (
          <AdminWorkoutOverview
            logs={logs}
            athletePlayers={athletePlayers}
            source={source}
            loading={loading}
            error={error}
            onRefresh={reload}
          />
        ) : (
          <AdminPortal />
        )}
      </div>
    </div>
  );
}
