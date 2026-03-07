import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type CSSProperties,
  type ReactNode,
} from "react";
import { supabase } from "./lib/supabase";

type TeamOption =
  | "15u Salute"
  | "15u Honor"
  | "16u Salute"
  | "16u Honor"
  | "17u Salute"
  | "17u Honor"
  | "Undecided";

type Player = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  grade: string | null;
  grade_group: string | null;
  school: string | null;
  birth_date: string | null;
  player_phone: string | null;
  parent_phone: string | null;
  parent_email: string | null;
  registered_at: string | null;
  checked_in: boolean;
  suggested_team: TeamOption | null;
  notes: string | null;
};

type LatestEvaluation = {
  player_id: string;
  evaluator: string | null;
  tryout_date: string | null;
  total_score: number | null;
  general_notes: string | null;
  suggested_team: TeamOption | null;
  created_at: string | null;
};

type EvalForm = {
  evaluator: string;
  speed_quickness: number;
  strength: number;
  endurance: number;
  ball_handling: number;
  shooting_mechanics: number;
  shooting_consistency: number;
  passing: number;
  rebounding: number;
  on_ball_defense: number;
  off_ball_defense: number;
  offensive_knowledge: number;
  court_vision: number;
  attitude_coachability: number;
  general_notes: string;
  suggested_team: TeamOption;
};

type Evaluation = {
  id: string;
  player_id: string;
  evaluator: string | null;
  tryout_date: string | null;
  speed_quickness: number | null;
  strength: number | null;
  endurance: number | null;
  ball_handling: number | null;
  shooting_mechanics: number | null;
  shooting_consistency: number | null;
  passing: number | null;
  rebounding: number | null;
  on_ball_defense: number | null;
  off_ball_defense: number | null;
  offensive_knowledge: number | null;
  court_vision: number | null;
  attitude_coachability: number | null;
  total_score: number | null;
  general_notes: string | null;
  suggested_team: TeamOption | null;
  created_at: string | null;
};

const TEAM_OPTIONS: TeamOption[] = [
  "15u Salute",
  "15u Honor",
  "16u Salute",
  "16u Honor",
  "17u Salute",
  "17u Honor",
  "Undecided",
];

function groupFromGrade(grade: string) {
  const n = parseInt(grade, 10);
  if (!Number.isFinite(n)) return "High School";
  return n <= 8 ? "Middle School" : "High School";
}

function initialEvalForm(): EvalForm {
  return {
    evaluator: "",
    speed_quickness: 3,
    strength: 3,
    endurance: 3,
    ball_handling: 3,
    shooting_mechanics: 3,
    shooting_consistency: 3,
    passing: 3,
    rebounding: 3,
    on_ball_defense: 3,
    off_ball_defense: 3,
    offensive_knowledge: 3,
    court_vision: 3,
    attitude_coachability: 3,
    general_notes: "",
    suggested_team: "Undecided",
  };
}

function totalScore(evalForm: EvalForm) {
  return (
    evalForm.speed_quickness +
    evalForm.strength +
    evalForm.endurance +
    evalForm.ball_handling +
    evalForm.shooting_mechanics +
    evalForm.shooting_consistency +
    evalForm.passing +
    evalForm.rebounding +
    evalForm.on_ball_defense +
    evalForm.off_ball_defense +
    evalForm.offensive_knowledge +
    evalForm.court_vision +
    evalForm.attitude_coachability
  );
}

function ScoreSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={inputStyle}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  );
}

export default function App() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [latestEvaluations, setLatestEvaluations] = useState<
    LatestEvaluation[]
  >([]);
  const [playerEvaluations, setPlayerEvaluations] = useState<Evaluation[]>([]);
  const [status, setStatus] = useState("Loading...");
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("All");
  const [tab, setTab] = useState<"attendance" | "evaluations" | "rosters">(
    "attendance"
  );
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [editingEvaluationId, setEditingEvaluationId] = useState<string | null>(
    null
  );
  const [evalForm, setEvalForm] = useState<EvalForm>(initialEvalForm());

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    grade: "",
    school: "",
    birth_date: "",
    player_phone: "",
    parent_phone: "",
    parent_email: "",
  });

  const selectedPlayer = players.find((p) => p.id === selectedPlayerId) ?? null;

  async function loadPlayers() {
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .order("last_name", { ascending: true });

    if (error) {
      setStatus(`Players load error: ${error.message}`);
      return;
    }

    const loaded = (data ?? []) as Player[];
    setPlayers(loaded);

    if (!selectedPlayerId && loaded.length > 0) {
      setSelectedPlayerId(loaded[0].id);
    }
  }

  async function loadLatestEvaluations() {
    const { data, error } = await supabase
      .from("latest_player_evaluations")
      .select("*");

    if (error) {
      setStatus(`Latest evaluation load error: ${error.message}`);
      return;
    }

    setLatestEvaluations((data ?? []) as LatestEvaluation[]);
  }

  async function loadPlayerEvaluations(playerId: string) {
    const { data, error } = await supabase
      .from("evaluations")
      .select("*")
      .eq("player_id", playerId)
      .order("created_at", { ascending: false });

    if (error) {
      setStatus(`Evaluation history error: ${error.message}`);
      return;
    }

    setPlayerEvaluations((data ?? []) as Evaluation[]);
  }

  async function refreshAll() {
    await loadPlayers();
    await loadLatestEvaluations();
    setStatus("Data loaded.");
  }

  function loadEvaluationIntoForm(evaluation: Evaluation) {
    setEditingEvaluationId(evaluation.id);

    setEvalForm({
      evaluator: evaluation.evaluator ?? "",
      speed_quickness: evaluation.speed_quickness ?? 3,
      strength: evaluation.strength ?? 3,
      endurance: evaluation.endurance ?? 3,
      ball_handling: evaluation.ball_handling ?? 3,
      shooting_mechanics: evaluation.shooting_mechanics ?? 3,
      shooting_consistency: evaluation.shooting_consistency ?? 3,
      passing: evaluation.passing ?? 3,
      rebounding: evaluation.rebounding ?? 3,
      on_ball_defense: evaluation.on_ball_defense ?? 3,
      off_ball_defense: evaluation.off_ball_defense ?? 3,
      offensive_knowledge: evaluation.offensive_knowledge ?? 3,
      court_vision: evaluation.court_vision ?? 3,
      attitude_coachability: evaluation.attitude_coachability ?? 3,
      general_notes: evaluation.general_notes ?? "",
      suggested_team: evaluation.suggested_team ?? "Undecided",
    });

    setStatus(
      `Loaded evaluation${
        evaluation.evaluator ? ` by ${evaluation.evaluator}` : ""
      }.`
    );
  }

  function startNewEvaluation() {
    setEditingEvaluationId(null);
    setEvalForm(initialEvalForm());
    setStatus(
      selectedPlayer
        ? `Starting new evaluation for ${selectedPlayer.first_name} ${selectedPlayer.last_name}.`
        : "Starting new evaluation."
    );
  }

  useEffect(() => {
    refreshAll();
  }, []);

  useEffect(() => {
    if (selectedPlayerId) {
      setEvalForm(initialEvalForm());
      setEditingEvaluationId(null);
      loadPlayerEvaluations(selectedPlayerId);
    } else {
      setPlayerEvaluations([]);
    }
  }, [selectedPlayerId]);

  const filteredPlayers = useMemo(() => {
    return players.filter((player) => {
      const text =
        `${player.first_name ?? ""} ${player.last_name ?? ""} ${player.school ?? ""} ${player.parent_phone ?? ""} ${player.parent_email ?? ""}`.toLowerCase();

      const matchesSearch = text.includes(search.toLowerCase());
      const matchesGroup =
        groupFilter === "All" || player.grade_group === groupFilter;

      return matchesSearch && matchesGroup;
    });
  }, [players, search, groupFilter]);

  const latestEvalMap = useMemo(() => {
    const map = new Map<string, LatestEvaluation>();
    latestEvaluations.forEach((ev) => map.set(ev.player_id, ev));
    return map;
  }, [latestEvaluations]);

  const rosterGroups = useMemo(() => {
    const groups: Record<TeamOption, Player[]> = {
      "15u Salute": [],
      "15u Honor": [],
      "16u Salute": [],
      "16u Honor": [],
      "17u Salute": [],
      "17u Honor": [],
      Undecided: [],
    };

    players.forEach((player) => {
      const team = player.suggested_team ?? "Undecided";
      groups[team].push(player);
    });

    Object.keys(groups).forEach((key) => {
      groups[key as TeamOption].sort((a, b) =>
        `${a.last_name ?? ""} ${a.first_name ?? ""}`.localeCompare(
          `${b.last_name ?? ""} ${b.first_name ?? ""}`
        )
      );
    });

    return groups;
  }, [players]);

  async function addPlayer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const { error } = await supabase.from("players").insert([
      {
        first_name: form.first_name,
        last_name: form.last_name,
        grade: form.grade,
        grade_group: groupFromGrade(form.grade),
        school: form.school || null,
        birth_date: form.birth_date || null,
        player_phone: form.player_phone || null,
        parent_phone: form.parent_phone || null,
        parent_email: form.parent_email || null,
        checked_in: true,
        suggested_team: "Undecided",
        notes: "Onsite registration",
      },
    ]);

    if (error) {
      setStatus(`Insert error: ${error.message}`);
      return;
    }

    setForm({
      first_name: "",
      last_name: "",
      grade: "",
      school: "",
      birth_date: "",
      player_phone: "",
      parent_phone: "",
      parent_email: "",
    });

    await refreshAll();
    setStatus("Player registered successfully.");
  }

  async function toggleCheckIn(player: Player) {
    const newValue = !player.checked_in;

    const { error } = await supabase
      .from("players")
      .update({ checked_in: newValue })
      .eq("id", player.id);

    if (error) {
      setStatus(`Attendance error: ${error.message}`);
      return;
    }

    setPlayers((prev) =>
      prev.map((p) => (p.id === player.id ? { ...p, checked_in: newValue } : p))
    );

    setStatus(
      `${player.first_name} ${player.last_name} ${
        newValue ? "checked in" : "marked absent"
      }.`
    );
  }

  async function updateSuggestedTeam(player: Player, team: TeamOption) {
    const { error } = await supabase
      .from("players")
      .update({ suggested_team: team })
      .eq("id", player.id);

    if (error) {
      setStatus(`Team update error: ${error.message}`);
      return;
    }

    setPlayers((prev) =>
      prev.map((p) => (p.id === player.id ? { ...p, suggested_team: team } : p))
    );

    setStatus(
      `${player.first_name} ${player.last_name} assigned to ${team}.`
    );
  }

  async function saveEvaluation(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!selectedPlayer) {
      setStatus("Please select a player first.");
      return;
    }

    const isEditing = Boolean(editingEvaluationId);

    const payload = {
      player_id: selectedPlayer.id,
      evaluator: evalForm.evaluator || null,
      speed_quickness: evalForm.speed_quickness,
      strength: evalForm.strength,
      endurance: evalForm.endurance,
      ball_handling: evalForm.ball_handling,
      shooting_mechanics: evalForm.shooting_mechanics,
      shooting_consistency: evalForm.shooting_consistency,
      passing: evalForm.passing,
      rebounding: evalForm.rebounding,
      on_ball_defense: evalForm.on_ball_defense,
      off_ball_defense: evalForm.off_ball_defense,
      offensive_knowledge: evalForm.offensive_knowledge,
      court_vision: evalForm.court_vision,
      attitude_coachability: evalForm.attitude_coachability,
      total_score: totalScore(evalForm),
      general_notes: evalForm.general_notes,
      suggested_team: evalForm.suggested_team,
    };

    let error: { message: string } | null = null;

    if (editingEvaluationId) {
      const result = await supabase
        .from("evaluations")
        .update(payload)
        .eq("id", editingEvaluationId);

      error = result.error;
    } else {
      const result = await supabase.from("evaluations").insert([payload]);
      error = result.error;
    }

    if (error) {
      setStatus(`Evaluation save error: ${error.message}`);
      return;
    }

    await supabase
      .from("players")
      .update({ suggested_team: evalForm.suggested_team })
      .eq("id", selectedPlayer.id);

    setPlayers((prev) =>
      prev.map((p) =>
        p.id === selectedPlayer.id
          ? { ...p, suggested_team: evalForm.suggested_team }
          : p
      )
    );

    await loadLatestEvaluations();
    await loadPlayerEvaluations(selectedPlayer.id);

    setEvalForm(initialEvalForm());
    setEditingEvaluationId(null);

    setStatus(
      isEditing
        ? `Evaluation updated for ${selectedPlayer.first_name} ${selectedPlayer.last_name}.`
        : `Evaluation saved for ${selectedPlayer.first_name} ${selectedPlayer.last_name}.`
    );
  }

  return (
    <div
      style={{
        padding: 32,
        background: "#06153a",
        minHeight: "100vh",
        color: "white",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 60, marginBottom: 12 }}>Soldiers Try-Outs</h1>
      <p style={{ fontSize: 18, marginBottom: 20 }}>{status}</p>

      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={() => setTab("attendance")}
          style={{
            ...buttonStyle,
            background: tab === "attendance" ? "#15803d" : "#111111",
          }}
        >
          Attendance
        </button>
        <button
          type="button"
          onClick={() => setTab("evaluations")}
          style={{
            ...buttonStyle,
            background: tab === "evaluations" ? "#15803d" : "#111111",
          }}
        >
          Evaluations
        </button>
        <button
          type="button"
          onClick={() => setTab("rosters")}
          style={{
            ...buttonStyle,
            background: tab === "rosters" ? "#15803d" : "#111111",
          }}
        >
          Rosters
        </button>
      </div>

      {tab === "attendance" ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.2fr",
            gap: 32,
            alignItems: "start",
          }}
        >
          <div>
            <h2 style={{ fontSize: 34 }}>Onsite Registration</h2>

            <form onSubmit={addPlayer} style={{ display: "grid", gap: 12 }}>
              <input
                placeholder="First Name"
                value={form.first_name}
                onChange={(e) =>
                  setForm({ ...form, first_name: e.target.value })
                }
                style={inputStyle}
              />
              <input
                placeholder="Last Name"
                value={form.last_name}
                onChange={(e) =>
                  setForm({ ...form, last_name: e.target.value })
                }
                style={inputStyle}
              />
              <input
                placeholder="Grade"
                value={form.grade}
                onChange={(e) => setForm({ ...form, grade: e.target.value })}
                style={inputStyle}
              />
              <input
                placeholder="School"
                value={form.school}
                onChange={(e) => setForm({ ...form, school: e.target.value })}
                style={inputStyle}
              />
              <input
                type="date"
                value={form.birth_date}
                onChange={(e) =>
                  setForm({ ...form, birth_date: e.target.value })
                }
                style={inputStyle}
              />
              <input
                placeholder="Player Cell"
                value={form.player_phone}
                onChange={(e) =>
                  setForm({ ...form, player_phone: e.target.value })
                }
                style={inputStyle}
              />
              <input
                placeholder="Parent Cell"
                value={form.parent_phone}
                onChange={(e) =>
                  setForm({ ...form, parent_phone: e.target.value })
                }
                style={inputStyle}
              />
              <input
                placeholder="Parent Email"
                value={form.parent_email}
                onChange={(e) =>
                  setForm({ ...form, parent_email: e.target.value })
                }
                style={inputStyle}
              />
              <button type="submit" style={buttonStyle}>
                Register Player
              </button>
            </form>
          </div>

          <div>
            <h2 style={{ fontSize: 34 }}>Players</h2>

            <div
              style={{
                display: "flex",
                gap: 12,
                marginBottom: 16,
                flexWrap: "wrap",
              }}
            >
              <input
                placeholder="Search player, school, phone, email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ ...inputStyle, flex: 1, minWidth: 260 }}
              />

              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                style={{ ...inputStyle, width: 180 }}
              >
                <option value="All">All</option>
                <option value="High School">High School</option>
                <option value="Middle School">Middle School</option>
              </select>
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              {filteredPlayers.map((player) => (
                <div key={player.id} style={cardStyle}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 16,
                      alignItems: "start",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 24, fontWeight: 700 }}>
                        {player.last_name}, {player.first_name}
                      </div>
                      <div style={{ fontSize: 18, marginTop: 8 }}>
                        {player.grade_group} • {player.grade}
                      </div>
                      <div style={{ fontSize: 18, marginTop: 4 }}>
                        {player.school}
                      </div>
                      <div style={{ fontSize: 18, marginTop: 10 }}>
                        Player: {player.player_phone || "-"}
                      </div>
                      <div style={{ fontSize: 18, marginTop: 4 }}>
                        Parent: {player.parent_phone || "-"}
                      </div>
                      <div style={{ fontSize: 18, marginTop: 4 }}>
                        Email: {player.parent_email || "-"}
                      </div>
                    </div>

                    <div style={{ minWidth: 190 }}>
                      <button
                        type="button"
                        onClick={() => toggleCheckIn(player)}
                        style={{
                          ...smallButton,
                          background: player.checked_in ? "#15803d" : "#374151",
                          marginBottom: 10,
                          width: "100%",
                        }}
                      >
                        {player.checked_in ? "Checked In" : "Mark Present"}
                      </button>

                      <select
                        value={player.suggested_team ?? "Undecided"}
                        onChange={(e) =>
                          updateSuggestedTeam(
                            player,
                            e.target.value as TeamOption
                          )
                        }
                        style={{ ...inputStyle, width: "100%" }}
                      >
                        {TEAM_OPTIONS.map((team) => (
                          <option key={team} value={team}>
                            {team}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}

              {filteredPlayers.length === 0 && <p>No players found.</p>}
            </div>
          </div>
        </div>
      ) : tab === "evaluations" ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "340px 1fr",
            gap: 24,
            alignItems: "start",
          }}
        >
          <div>
            <h2 style={{ fontSize: 34 }}>Select Player</h2>

            <div style={{ display: "grid", gap: 10 }}>
              {players.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => setSelectedPlayerId(player.id)}
                  style={{
                    ...smallButton,
                    textAlign: "left",
                    background:
                      selectedPlayerId === player.id ? "#15803d" : "#111827",
                    border: "1px solid #334155",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>
                    {player.last_name}, {player.first_name}
                  </div>
                  <div>
                    {player.grade_group} • {player.grade}
                  </div>
                </button>
              ))}
            </div>

            <div style={{ marginTop: 24, ...cardStyle }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <h3 style={{ fontSize: 24, margin: 0 }}>Evaluation History</h3>
                <button
                  type="button"
                  onClick={startNewEvaluation}
                  style={smallButton}
                >
                  New Evaluation
                </button>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {playerEvaluations.length === 0 ? (
                  <div style={{ color: "#cbd5e1" }}>No evaluations yet.</div>
                ) : (
                  playerEvaluations.map((evaluation) => (
                    <button
                      key={evaluation.id}
                      type="button"
                      onClick={() => loadEvaluationIntoForm(evaluation)}
                      style={{
                        ...smallButton,
                        textAlign: "left",
                        background:
                          editingEvaluationId === evaluation.id
                            ? "#15803d"
                            : "#111827",
                        border: "1px solid #334155",
                      }}
                    >
                      <div>
                        Evaluator: {evaluation.evaluator || "Unknown"}
                      </div>
                      <div>Score: {evaluation.total_score ?? "-"} / 65</div>
                      <div>
                        Team: {evaluation.suggested_team ?? "Undecided"}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div>
            <h2 style={{ fontSize: 34 }}>
              Evaluation{" "}
              {selectedPlayer
                ? `- ${selectedPlayer.first_name} ${selectedPlayer.last_name}`
                : ""}
            </h2>

            {selectedPlayer ? (
              <form onSubmit={saveEvaluation} style={{ display: "grid", gap: 18 }}>
                <div style={cardStyle}>
                  <label style={labelStyle}>Evaluator</label>
                  <input
                    value={evalForm.evaluator}
                    onChange={(e) =>
                      setEvalForm({ ...evalForm, evaluator: e.target.value })
                    }
                    style={inputStyle}
                    placeholder="Coach name"
                  />

                  <label style={labelStyle}>Suggested Team</label>
                  <select
                    value={evalForm.suggested_team}
                    onChange={(e) =>
                      setEvalForm({
                        ...evalForm,
                        suggested_team: e.target.value as TeamOption,
                      })
                    }
                    style={inputStyle}
                  >
                    {TEAM_OPTIONS.map((team) => (
                      <option key={team} value={team}>
                        {team}
                      </option>
                    ))}
                  </select>

                  <div style={{ marginTop: 10, fontSize: 22, fontWeight: 700 }}>
                    Total Score: {totalScore(evalForm)} / 65
                  </div>
                </div>

                <div style={cardStyle}>
                  <h3 style={sectionTitle}>Physical Attributes</h3>
                  <EvalRow
                    label="Speed/Quickness"
                    control={
                      <ScoreSelect
                        value={evalForm.speed_quickness}
                        onChange={(value) =>
                          setEvalForm({ ...evalForm, speed_quickness: value })
                        }
                      />
                    }
                  />
                  <EvalRow
                    label="Strength"
                    control={
                      <ScoreSelect
                        value={evalForm.strength}
                        onChange={(value) =>
                          setEvalForm({ ...evalForm, strength: value })
                        }
                      />
                    }
                  />
                  <EvalRow
                    label="Endurance"
                    control={
                      <ScoreSelect
                        value={evalForm.endurance}
                        onChange={(value) =>
                          setEvalForm({ ...evalForm, endurance: value })
                        }
                      />
                    }
                  />
                </div>

                <div style={cardStyle}>
                  <h3 style={sectionTitle}>Skill Evaluation</h3>
                  <EvalRow
                    label="Ball Handling"
                    control={
                      <ScoreSelect
                        value={evalForm.ball_handling}
                        onChange={(value) =>
                          setEvalForm({ ...evalForm, ball_handling: value })
                        }
                      />
                    }
                  />
                  <EvalRow
                    label="Shooting Mechanics/Form"
                    control={
                      <ScoreSelect
                        value={evalForm.shooting_mechanics}
                        onChange={(value) =>
                          setEvalForm({
                            ...evalForm,
                            shooting_mechanics: value,
                          })
                        }
                      />
                    }
                  />
                  <EvalRow
                    label="Shooting Consistency"
                    control={
                      <ScoreSelect
                        value={evalForm.shooting_consistency}
                        onChange={(value) =>
                          setEvalForm({
                            ...evalForm,
                            shooting_consistency: value,
                          })
                        }
                      />
                    }
                  />
                  <EvalRow
                    label="Passing Ability/Accuracy"
                    control={
                      <ScoreSelect
                        value={evalForm.passing}
                        onChange={(value) =>
                          setEvalForm({ ...evalForm, passing: value })
                        }
                      />
                    }
                  />
                  <EvalRow
                    label="Rebounding"
                    control={
                      <ScoreSelect
                        value={evalForm.rebounding}
                        onChange={(value) =>
                          setEvalForm({ ...evalForm, rebounding: value })
                        }
                      />
                    }
                  />
                  <EvalRow
                    label="On-Ball Defense"
                    control={
                      <ScoreSelect
                        value={evalForm.on_ball_defense}
                        onChange={(value) =>
                          setEvalForm({ ...evalForm, on_ball_defense: value })
                        }
                      />
                    }
                  />
                  <EvalRow
                    label="Off-Ball Defense/Awareness"
                    control={
                      <ScoreSelect
                        value={evalForm.off_ball_defense}
                        onChange={(value) =>
                          setEvalForm({ ...evalForm, off_ball_defense: value })
                        }
                      />
                    }
                  />
                </div>

                <div style={cardStyle}>
                  <h3 style={sectionTitle}>Basketball IQ & Intangibles</h3>
                  <EvalRow
                    label="Offensive Knowledge/Spacing"
                    control={
                      <ScoreSelect
                        value={evalForm.offensive_knowledge}
                        onChange={(value) =>
                          setEvalForm({
                            ...evalForm,
                            offensive_knowledge: value,
                          })
                        }
                      />
                    }
                  />
                  <EvalRow
                    label="Court Vision/Decision Making"
                    control={
                      <ScoreSelect
                        value={evalForm.court_vision}
                        onChange={(value) =>
                          setEvalForm({ ...evalForm, court_vision: value })
                        }
                      />
                    }
                  />
                  <EvalRow
                    label="Attitude/Work Ethic/Coachability"
                    control={
                      <ScoreSelect
                        value={evalForm.attitude_coachability}
                        onChange={(value) =>
                          setEvalForm({
                            ...evalForm,
                            attitude_coachability: value,
                          })
                        }
                      />
                    }
                  />
                </div>

                <div style={cardStyle}>
                  <h3 style={sectionTitle}>General Notes</h3>
                  <textarea
                    value={evalForm.general_notes}
                    onChange={(e) =>
                      setEvalForm({
                        ...evalForm,
                        general_notes: e.target.value,
                      })
                    }
                    style={{ ...inputStyle, minHeight: 120, resize: "vertical" }}
                    placeholder="Add strengths, concerns, fit, upside, and notes..."
                  />
                </div>

                <div style={{ fontSize: 18, fontWeight: 700 }}>
                  Mode:{" "}
                  {editingEvaluationId
                    ? "Editing Existing Evaluation"
                    : "New Evaluation"}
                </div>

                <button type="submit" style={buttonStyle}>
                  Save Evaluation
                </button>
              </form>
            ) : (
              <p>Select a player first.</p>
            )}
          </div>
        </div>
      ) : (
        <div>
          <h2 style={{ fontSize: 34, marginBottom: 16 }}>Rosters</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 18,
            }}
          >
            {TEAM_OPTIONS.map((team) => (
              <div key={team} style={cardStyle}>
                <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 10 }}>
                  {team}
                </div>
                <div style={{ marginBottom: 14, fontSize: 18 }}>
                  Count: {rosterGroups[team].length}
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  {rosterGroups[team].length === 0 ? (
                    <div style={{ color: "#cbd5e1" }}>No players assigned.</div>
                  ) : (
                    rosterGroups[team].map((player) => {
                      const latest = latestEvalMap.get(player.id);
                      return (
                        <div
                          key={player.id}
                          style={{
                            border: "1px solid #334155",
                            borderRadius: 14,
                            padding: 12,
                            background: "#0b1c44",
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: 18 }}>
                            {player.last_name}, {player.first_name}
                          </div>
                          <div style={{ marginTop: 4 }}>
                            {player.grade_group} • {player.grade}
                          </div>
                          <div style={{ marginTop: 4 }}>{player.school}</div>
                          <div style={{ marginTop: 8 }}>
                            Latest Eval Score: {latest?.total_score ?? "-"} / 65
                          </div>
                          <div style={{ marginTop: 4 }}>
                            Checked In: {player.checked_in ? "Yes" : "No"}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EvalRow({
  label,
  control,
}: {
  label: string;
  control: ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 120px",
        gap: 14,
        alignItems: "center",
        marginBottom: 12,
      }}
    >
      <div style={{ fontSize: 18 }}>{label}</div>
      <div>{control}</div>
    </div>
  );
}

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: 8,
  marginTop: 6,
  fontSize: 18,
  fontWeight: 600,
};

const sectionTitle: CSSProperties = {
  fontSize: 24,
  marginBottom: 16,
};

const inputStyle: CSSProperties = {
  padding: "14px 16px",
  borderRadius: 8,
  border: "1px solid #6b7280",
  background: "#3f3f46",
  color: "white",
  fontSize: 16,
  width: "100%",
};

const buttonStyle: CSSProperties = {
  padding: "16px 18px",
  borderRadius: 16,
  border: "none",
  background: "#111111",
  color: "white",
  fontSize: 18,
  cursor: "pointer",
};

const smallButton: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 10,
  border: "none",
  color: "white",
  fontSize: 16,
  cursor: "pointer",
};

const cardStyle: CSSProperties = {
  border: "1px solid #334155",
  padding: 18,
  borderRadius: 20,
  background: "#081735",
};