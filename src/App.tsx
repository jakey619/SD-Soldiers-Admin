import { useEffect, useMemo, useState, type FormEvent } from "react";
import AdminPortal from "./AdminPortal";
import soldiersLogo from "./assets/soldiers-logo.png";
import "./app.css";
import {
  fetchWorkoutLogs,
  saveWorkoutLog,
  type ActivityChecks,
  type TeamName,
  type WorkoutActivityKey,
  type WorkoutDataSource,
  type WorkoutLog,
} from "./lib/workoutLogs";

type AccessMode = "home" | "athlete" | "admin";
type AdminView = "workouts" | "management";
type SummaryView = "daily" | "weekly" | "athlete";
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
};

type WorkoutActivityDefinition = {
  key: WorkoutActivityKey;
  label: string;
  description: string;
};

const APP_VERSION = "2.1.0";

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
    key: "dribbles",
    label: "Dribbles",
    description: "Ball-handling reps like pound dribbles, crossovers, combo work, or weak-hand drills.",
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

const ADMIN_PASSWORD =
  import.meta.env.VITE_ADMIN_PASSWORD || "SoldiersAdmin";

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

function createWorkoutForm(): WorkoutForm {
  return {
    workoutDate: todayIsoDate(),
    notes: "",
    focusArea: "",
    effortLevel: "",
    advancedNotes: "",
    activities: createEmptyActivities(),
  };
}

function countCompletedActivities(activities: ActivityChecks) {
  return Object.values(activities).filter(Boolean).length;
}

function activityLabel(key: WorkoutActivityKey) {
  return WORKOUT_ACTIVITIES.find((activity) => activity.key === key)?.label ?? key;
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

  async function saveLog(
    identity: AthleteIdentity,
    form: WorkoutForm
  ) {
    const result = await saveWorkoutLog({
      athlete_name: identity.athleteName,
      team_name: identity.teamName,
      workout_date: form.workoutDate,
      activities: form.activities,
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

function HomeScreen({
  athleteForm,
  adminPassword,
  onAthleteFormChange,
  onAthleteEnter,
  onAdminPasswordChange,
  onAdminEnter,
  message,
}: {
  athleteForm: AthleteForm;
  adminPassword: string;
  onAthleteFormChange: (next: AthleteForm) => void;
  onAthleteEnter: () => void;
  onAdminPasswordChange: (value: string) => void;
  onAdminEnter: () => void;
  message: string;
}) {
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
          <div className="panel-kicker">Program Access</div>
          <h1 className="panel-title">Choose how you want to enter the app.</h1>
          <p className="auth-hero-copy">
            Athletes only see their workout tools. Admin tools and the management
            dashboard stay hidden unless the admin password is entered.
          </p>
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
            <input
              id="athlete-name"
              className="input"
              value={athleteForm.athleteName}
              onChange={(event) =>
                onAthleteFormChange({
                  ...athleteForm,
                  athleteName: event.target.value,
                })
              }
              placeholder="Enter your name"
            />

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
  source,
  onBack,
  onSubmit,
}: {
  identity: AthleteIdentity;
  logs: WorkoutLog[];
  source: WorkoutDataSource;
  onBack: () => void;
  onSubmit: (form: WorkoutForm) => Promise<void>;
}) {
  const [form, setForm] = useState<WorkoutForm>(() => createWorkoutForm());
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const personalLogs = useMemo(
    () =>
      logs.filter(
        (entry) =>
          entry.athlete_name.toLowerCase() === identity.athleteName.toLowerCase() &&
          entry.team_name === identity.teamName
      ),
    [identity.athleteName, identity.teamName, logs]
  );

  const latestLog = personalLogs[0] ?? null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus("");

    try {
      await onSubmit(form);
      setStatus("Workout log saved successfully.");
      setForm((current) => ({
        ...createWorkoutForm(),
        workoutDate: current.workoutDate,
      }));
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : "Unable to save workout log.";
      setStatus(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand">
          <img src={soldiersLogo} alt="San Diego Soldiers logo" className="brand-logo" />
          <div className="brand-text">
            <div className="brand-title">Athlete Workout Log</div>
            <div className="brand-subtitle">
              {identity.athleteName} · {identity.teamName}
            </div>
          </div>
        </div>
        <div className="status-area">
          <div className="app-status">Saving to {source === "supabase" ? "Supabase" : "this device"}</div>
          <button type="button" className="secondary-button" onClick={onBack}>
            Switch User
          </button>
        </div>
      </header>

      <div className="summary-row athlete-summary-row">
        <div className="summary-card">
          <div className="summary-label">My Logs</div>
          <div className="summary-value">{personalLogs.length}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Latest Workout</div>
          <div className="summary-value summary-value-small">
            {latestLog ? formatDateLabel(latestLog.workout_date) : "None yet"}
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Latest Activities</div>
          <div className="summary-value">{latestLog ? countCompletedActivities(latestLog.activities) : 0}</div>
        </div>
      </div>

      <div className="athlete-layout">
        <form className="card" onSubmit={handleSubmit}>
          <div className="panel-kicker">Daily Entry</div>
          <h2 className="section-title">Log today&apos;s workout</h2>

          <label className="field-label" htmlFor="workout-date">
            Date
          </label>
          <input
            id="workout-date"
            className="input"
            type="date"
            value={form.workoutDate}
            onChange={(event) =>
              setForm((current) => ({ ...current, workoutDate: event.target.value }))
            }
          />

          <div className="activity-grid">
            {WORKOUT_ACTIVITIES.map((activity) => (
              <label key={activity.key} className="activity-card">
                <div className="activity-card-top">
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
                  />
                  <span className="activity-card-title">{activity.label}</span>
                </div>
                <p className="activity-card-copy">{activity.description}</p>
              </label>
            ))}
          </div>

          <label className="field-label" htmlFor="workout-notes">
            Notes
          </label>
          <textarea
            id="workout-notes"
            className="textarea"
            value={form.notes}
            onChange={(event) =>
              setForm((current) => ({ ...current, notes: event.target.value }))
            }
            placeholder="What did you work on today?"
          />

          <details className="advanced-details">
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
            <div className={`status-banner ${status.includes("saved") ? "success" : "error"}`}>
              {status}
            </div>
          ) : null}

          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? "Saving..." : "Save Workout Log"}
          </button>
        </form>

        <section className="card">
          <div className="panel-kicker">Recent Activity</div>
          <h2 className="section-title">My latest workout history</h2>
          <div className="log-list">
            {personalLogs.length === 0 ? (
              <div className="empty-text">No workouts logged yet.</div>
            ) : (
              personalLogs.slice(0, 8).map((entry) => {
                const completedActivities = Object.entries(entry.activities)
                  .filter(([, checked]) => checked)
                  .map(([key]) => activityLabel(key as WorkoutActivityKey));

                return (
                  <article key={entry.id} className="workout-log-card">
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
                    {entry.advanced_notes ? (
                      <div className="workout-log-copy muted">{entry.advanced_notes}</div>
                    ) : null}
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function AdminWorkoutOverview({
  logs,
  source,
  loading,
  error,
  onRefresh,
}: {
  logs: WorkoutLog[];
  source: WorkoutDataSource;
  loading: boolean;
  error: string;
  onRefresh: () => Promise<void>;
}) {
  const [view, setView] = useState<SummaryView>("daily");
  const [search, setSearch] = useState("");

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return logs;

    return logs.filter((entry) =>
      [entry.athlete_name, entry.team_name, entry.workout_date, entry.notes, entry.focus_area]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [logs, search]);

  const totalCompletions = useMemo(
    () =>
      filteredLogs.reduce(
        (sum, entry) => sum + countCompletedActivities(entry.activities),
        0
      ),
    [filteredLogs]
  );

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
      subtitle: `${group.athletes.size} athletes · ${group.teams.size} teams`,
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
      subtitle: `${group.athletes.size} athletes · ${group.teams.size} teams`,
      stat: `${group.activityTotal} items`,
      detail: `${group.logCount} logs submitted`,
    }));
  }, [filteredLogs]);

  const athleteRows = useMemo(() => {
    const groups = new Map<
      string,
      { athlete: string; team: TeamName; activityTotal: number; logCount: number; lastDate: string }
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
        subtitle: `${group.team} · last workout ${formatDateLabel(group.lastDate)}`,
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
          <div className="summary-label">Athletes Logged</div>
          <div className="summary-value">
            {new Set(filteredLogs.map((entry) => entry.athlete_name.toLowerCase())).size}
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Activity Checks</div>
          <div className="summary-value">{totalCompletions}</div>
        </div>
        <div className="summary-card">
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
        </div>

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

                  return (
                    <article key={entry.id} className="workout-log-card">
                      <div className="workout-log-header">
                        <strong>{entry.athlete_name}</strong>
                        <span>{formatDateLabel(entry.workout_date)}</span>
                      </div>
                      <div className="workout-log-copy">{entry.team_name}</div>
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
        source={source}
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
