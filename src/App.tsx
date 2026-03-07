import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { supabase } from "./lib/supabase";
import { uploadPlayerPhoto } from "./lib/playerPhotos";
import soldiersLogo from "./assets/soldiers-logo.png";
import "./app.css";

type TeamOption =
  | "15u Salute"
  | "15u Honor"
  | "16u Salute"
  | "16u Honor"
  | "17u Salute"
  | "17u Honor"
  | "Undecided";

type MainTab = "attendance" | "door" | "rosters";

type AttendanceFilter =
  | "all"
  | "checked-in"
  | "not-checked-in"
  | "evaluated"
  | "not-evaluated";

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
  photo_url?: string | null;
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

type TeamStats = {
  team: TeamOption;
  count: number;
  checkedIn: number;
  evaluated: number;
  averageScore: number | null;
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

const ATTENDANCE_FILTER_OPTIONS: {
  value: AttendanceFilter;
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "checked-in", label: "Checked In" },
  { value: "not-checked-in", label: "Not Checked In" },
  { value: "evaluated", label: "Evaluated" },
  { value: "not-evaluated", label: "Not Evaluated" },
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

function getScoreTone(score: number | null | undefined) {
  if (score == null) return "neutral";
  if (score >= 55) return "good";
  if (score >= 45) return "info";
  if (score >= 35) return "warn";
  return "neutral";
}

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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
      className="select"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  );
}

function PlayerPhoto({
  src,
  alt,
  large = false,
}: {
  src?: string | null;
  alt: string;
  large?: boolean;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={large ? "player-photo player-photo-large" : "player-photo"}
      />
    );
  }

  return (
    <div
      className={large ? "player-photo player-photo-large empty" : "player-photo empty"}
      aria-label="No player photo"
    >
      No Photo
    </div>
  );
}

function dataUrlToFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(",");
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }

  return new File([u8arr], filename, { type: mime });
}

function CameraCapture({
  onFileReady,
}: {
  onFileReady: (file: File) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string>("");

  async function openCamera() {
    setCameraError("");
    setPreviewUrl("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });

      streamRef.current = stream;
      setCameraOpen(true);

      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to access camera.";
      setCameraError(message);
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setPreviewUrl(dataUrl);

    const file = dataUrlToFile(dataUrl, `player-photo-${Date.now()}.jpg`);
    onFileReady(file);
    stopCamera();
  }

  function clearPreview() {
    setPreviewUrl("");
  }

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="camera-capture">
      <div className="camera-actions">
        <button type="button" className="secondary-button" onClick={openCamera}>
          Open Camera
        </button>
        {previewUrl && (
          <button type="button" className="secondary-button" onClick={clearPreview}>
            Retake
          </button>
        )}
      </div>

      {cameraError && <div className="camera-error">{cameraError}</div>}

      {cameraOpen && (
        <div className="camera-box">
          <video ref={videoRef} className="camera-video" playsInline muted />
          <div className="camera-actions">
            <button type="button" className="primary-button" onClick={capturePhoto}>
              Capture Photo
            </button>
            <button type="button" className="secondary-button" onClick={stopCamera}>
              Cancel Camera
            </button>
          </div>
        </div>
      )}

      {previewUrl && (
        <div className="camera-preview-wrap">
          <img src={previewUrl} alt="Captured preview" className="camera-preview" />
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}

function PhotoPicker({
  onFileReady,
  currentPhotoUrl,
}: {
  onFileReady: (file: File | null) => void;
  currentPhotoUrl?: string | null;
}) {
  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    onFileReady(file);
  }

  return (
    <div className="photo-picker">
      <label className="field-label">Player Photo</label>
      <CameraCapture onFileReady={(file) => onFileReady(file)} />

      <div className="photo-divider">or</div>

      <input className="input" type="file" accept="image/*" onChange={handleFileChange} />

      {currentPhotoUrl && (
        <div className="existing-photo-wrap">
          <PlayerPhoto src={currentPhotoUrl} alt="Current player photo" large />
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [latestEvaluations, setLatestEvaluations] = useState<LatestEvaluation[]>([]);
  const [playerEvaluations, setPlayerEvaluations] = useState<Evaluation[]>([]);
  const [status, setStatus] = useState("Loading...");
  const [search, setSearch] = useState("");
  const [doorSearch, setDoorSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("All");
  const [attendanceFilter, setAttendanceFilter] = useState<AttendanceFilter>("all");
  const [tab, setTab] = useState<MainTab>("attendance");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");

  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [isEvaluationOpen, setIsEvaluationOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const [editingEvaluationId, setEditingEvaluationId] = useState<string | null>(null);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
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
  const [registrationPhotoFile, setRegistrationPhotoFile] = useState<File | null>(null);

  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    grade: "",
    school: "",
    birth_date: "",
    player_phone: "",
    parent_phone: "",
    parent_email: "",
    notes: "",
  });
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);

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

  useEffect(() => {
    refreshAll();
  }, []);

  const latestEvalMap = useMemo(() => {
    const map = new Map<string, LatestEvaluation>();
    latestEvaluations.forEach((ev) => map.set(ev.player_id, ev));
    return map;
  }, [latestEvaluations]);

  useEffect(() => {
    if (selectedPlayerId) {
      loadPlayerEvaluations(selectedPlayerId);
    } else {
      setPlayerEvaluations([]);
    }
  }, [selectedPlayerId]);

  const filteredPlayers = useMemo(() => {
    return players.filter((player) => {
      const latest = latestEvalMap.get(player.id);
      const isEvaluated = Boolean(latest);

      const text =
        `${player.first_name ?? ""} ${player.last_name ?? ""} ${player.school ?? ""} ${player.parent_phone ?? ""} ${player.parent_email ?? ""}`.toLowerCase();

      const matchesSearch = text.includes(search.toLowerCase());
      const matchesGroup =
        groupFilter === "All" || player.grade_group === groupFilter;

      let matchesAttendanceFilter = true;
      switch (attendanceFilter) {
        case "checked-in":
          matchesAttendanceFilter = player.checked_in;
          break;
        case "not-checked-in":
          matchesAttendanceFilter = !player.checked_in;
          break;
        case "evaluated":
          matchesAttendanceFilter = isEvaluated;
          break;
        case "not-evaluated":
          matchesAttendanceFilter = !isEvaluated;
          break;
        default:
          matchesAttendanceFilter = true;
      }

      return matchesSearch && matchesGroup && matchesAttendanceFilter;
    });
  }, [players, search, groupFilter, attendanceFilter, latestEvalMap]);

  const doorPlayers = useMemo(() => {
    const term = doorSearch.toLowerCase();
    return players
      .filter((player) => {
        const text =
          `${player.first_name ?? ""} ${player.last_name ?? ""} ${player.school ?? ""}`.toLowerCase();
        return text.includes(term);
      })
      .sort((a, b) =>
        `${a.last_name ?? ""} ${a.first_name ?? ""}`.localeCompare(
          `${b.last_name ?? ""} ${b.first_name ?? ""}`
        )
      );
  }, [players, doorSearch]);

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
      groups[key as TeamOption].sort((a, b) => {
        const aScore = latestEvalMap.get(a.id)?.total_score ?? -1;
        const bScore = latestEvalMap.get(b.id)?.total_score ?? -1;
        if (bScore !== aScore) return bScore - aScore;
        return `${a.last_name ?? ""} ${a.first_name ?? ""}`.localeCompare(
          `${b.last_name ?? ""} ${b.first_name ?? ""}`
        );
      });
    });

    return groups;
  }, [players, latestEvalMap]);

  const checkedInCount = useMemo(
    () => players.filter((p) => p.checked_in).length,
    [players]
  );

  const evaluatedCount = useMemo(() => {
    const ids = new Set(latestEvaluations.map((ev) => ev.player_id));
    return ids.size;
  }, [latestEvaluations]);

  const notCheckedInCount = players.length - checkedInCount;

  const teamStats = useMemo<TeamStats[]>(() => {
    return TEAM_OPTIONS.map((team) => {
      const teamPlayers = players.filter(
        (player) => (player.suggested_team ?? "Undecided") === team
      );
      const scores = teamPlayers
        .map((player) => latestEvalMap.get(player.id)?.total_score ?? null)
        .filter((score): score is number => score != null);

      const averageScore =
        scores.length > 0
          ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1))
          : null;

      return {
        team,
        count: teamPlayers.length,
        checkedIn: teamPlayers.filter((player) => player.checked_in).length,
        evaluated: teamPlayers.filter((player) => latestEvalMap.has(player.id)).length,
        averageScore,
      };
    });
  }, [players, latestEvalMap]);

  function exportAllPlayersCsv() {
    const rows: string[][] = [
      [
        "Last Name",
        "First Name",
        "Grade Group",
        "Grade",
        "School",
        "Checked In",
        "Suggested Team",
        "Latest Score",
        "Evaluated",
        "Player Phone",
        "Parent Phone",
        "Parent Email",
        "Notes",
        "Photo URL",
      ],
    ];

    const sortedPlayers = [...players].sort((a, b) =>
      `${a.last_name ?? ""} ${a.first_name ?? ""}`.localeCompare(
        `${b.last_name ?? ""} ${b.first_name ?? ""}`
      )
    );

    sortedPlayers.forEach((player) => {
      const latest = latestEvalMap.get(player.id);
      rows.push([
        player.last_name ?? "",
        player.first_name ?? "",
        player.grade_group ?? "",
        player.grade ?? "",
        player.school ?? "",
        player.checked_in ? "Yes" : "No",
        player.suggested_team ?? "Undecided",
        latest?.total_score?.toString() ?? "",
        latest ? "Yes" : "No",
        player.player_phone ?? "",
        player.parent_phone ?? "",
        player.parent_email ?? "",
        player.notes ?? "",
        player.photo_url ?? "",
      ]);
    });

    downloadCsv("soldiers-players.csv", rows);
    setStatus("Exported soldiers-players.csv");
  }

  function exportRosterCsv() {
    const rows: string[][] = [
      [
        "Team",
        "Last Name",
        "First Name",
        "Grade Group",
        "Grade",
        "School",
        "Checked In",
        "Latest Score",
        "Evaluator",
        "Player Phone",
        "Parent Phone",
        "Parent Email",
      ],
    ];

    TEAM_OPTIONS.forEach((team) => {
      rosterGroups[team].forEach((player) => {
        const latest = latestEvalMap.get(player.id);
        rows.push([
          team,
          player.last_name ?? "",
          player.first_name ?? "",
          player.grade_group ?? "",
          player.grade ?? "",
          player.school ?? "",
          player.checked_in ? "Yes" : "No",
          latest?.total_score?.toString() ?? "",
          latest?.evaluator ?? "",
          player.player_phone ?? "",
          player.parent_phone ?? "",
          player.parent_email ?? "",
        ]);
      });
    });

    downloadCsv("soldiers-rosters.csv", rows);
    setStatus("Exported soldiers-rosters.csv");
  }

  function openRegistrationModal() {
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
    setRegistrationPhotoFile(null);
    setIsRegistrationOpen(true);
  }

  function closeRegistrationModal() {
    setIsRegistrationOpen(false);
  }

  function openEvaluationModal(player: Player) {
    setSelectedPlayerId(player.id);
    setEditingEvaluationId(null);
    setEvalForm({
      ...initialEvalForm(),
      suggested_team: player.suggested_team ?? "Undecided",
    });
    setIsEvaluationOpen(true);
  }

  function closeEvaluationModal() {
    setIsEvaluationOpen(false);
    setEditingEvaluationId(null);
    setEvalForm(initialEvalForm());
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
    setIsEvaluationOpen(true);
    setStatus(
      `Loaded evaluation${
        evaluation.evaluator ? ` by ${evaluation.evaluator}` : ""
      }.`
    );
  }

  function startNewEvaluation() {
    setEditingEvaluationId(null);
    setEvalForm({
      ...initialEvalForm(),
      suggested_team: selectedPlayer?.suggested_team ?? "Undecided",
    });
    setStatus(
      selectedPlayer
        ? `Starting new evaluation for ${selectedPlayer.first_name} ${selectedPlayer.last_name}.`
        : "Starting new evaluation."
    );
  }

  function openEditModal(player: Player) {
    setEditingPlayerId(player.id);
    setEditForm({
      first_name: player.first_name ?? "",
      last_name: player.last_name ?? "",
      grade: player.grade ?? "",
      school: player.school ?? "",
      birth_date: player.birth_date ?? "",
      player_phone: player.player_phone ?? "",
      parent_phone: player.parent_phone ?? "",
      parent_email: player.parent_email ?? "",
      notes: player.notes ?? "",
    });
    setEditPhotoFile(null);
    setIsEditOpen(true);
    setStatus(`Editing ${player.first_name} ${player.last_name}.`);
  }

  function closeEditModal() {
    setIsEditOpen(false);
    setEditingPlayerId(null);
    setEditPhotoFile(null);
    setStatus("Edit cancelled.");
  }

  async function addPlayer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const { data, error } = await supabase
      .from("players")
      .insert([
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
      ])
      .select()
      .single();

    if (error || !data) {
      setStatus(`Insert error: ${error?.message ?? "Unable to create player."}`);
      return;
    }

    if (registrationPhotoFile) {
      try {
        const photoUrl = await uploadPlayerPhoto(registrationPhotoFile, data.id);
        const { error: photoUpdateError } = await supabase
          .from("players")
          .update({ photo_url: photoUrl })
          .eq("id", data.id);

        if (photoUpdateError) {
          setStatus(
            `Player created, but photo save failed: ${photoUpdateError.message}`
          );
        }
      } catch (photoError) {
        const message =
          photoError instanceof Error ? photoError.message : "Photo upload failed.";
        setStatus(`Player created, but photo upload failed: ${message}`);
      }
    }

    closeRegistrationModal();
    await refreshAll();
    setSelectedPlayerId(data.id);
    setStatus("Player registered successfully.");
  }

  async function savePlayerEdits(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!editingPlayerId) return;

    const currentPlayer = players.find((p) => p.id === editingPlayerId) ?? null;
    let photoUrl = currentPlayer?.photo_url ?? null;

    if (editPhotoFile) {
      try {
        photoUrl = await uploadPlayerPhoto(editPhotoFile, editingPlayerId);
      } catch (photoError) {
        const message =
          photoError instanceof Error ? photoError.message : "Photo upload failed.";
        setStatus(`Edit error: ${message}`);
        return;
      }
    }

    const payload = {
      first_name: editForm.first_name,
      last_name: editForm.last_name,
      grade: editForm.grade,
      grade_group: groupFromGrade(editForm.grade),
      school: editForm.school || null,
      birth_date: editForm.birth_date || null,
      player_phone: editForm.player_phone || null,
      parent_phone: editForm.parent_phone || null,
      parent_email: editForm.parent_email || null,
      notes: editForm.notes || null,
      photo_url: photoUrl,
    };

    const { error } = await supabase
      .from("players")
      .update(payload)
      .eq("id", editingPlayerId);

    if (error) {
      setStatus(`Edit error: ${error.message}`);
      return;
    }

    setPlayers((prev) =>
      prev.map((p) => (p.id === editingPlayerId ? { ...p, ...payload } : p))
    );

    setIsEditOpen(false);
    setEditingPlayerId(null);
    setEditPhotoFile(null);
    setStatus("Player info updated.");
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

    setStatus(`${player.first_name} ${player.last_name} assigned to ${team}.`);
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
    setIsEvaluationOpen(false);

    setStatus(
      isEditing
        ? `Evaluation updated for ${selectedPlayer.first_name} ${selectedPlayer.last_name}.`
        : `Evaluation saved for ${selectedPlayer.first_name} ${selectedPlayer.last_name}.`
    );
  }

  return (
    <div className="app-shell">
      <div className="top-bar">
        <div className="brand">
          <img
            src={soldiersLogo}
            alt="San Diego Soldiers logo"
            className="brand-logo"
          />
          <div className="brand-text">
            <div className="brand-title">San Diego Soldiers</div>
            <div className="brand-subtitle">Tryout Admin Dashboard</div>
          </div>
        </div>

        <div className="status-area">
          <div className="app-status">{status}</div>
        </div>
      </div>

      <div className="summary-row">
        <div className="summary-card">
          <div className="summary-label">Registered</div>
          <div className="summary-value">{players.length}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Checked In</div>
          <div className="summary-value">{checkedInCount}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Not Checked In</div>
          <div className="summary-value">{notCheckedInCount}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Evaluated</div>
          <div className="summary-value">{evaluatedCount}</div>
        </div>
      </div>

      <div className="tab-row">
        <button
          type="button"
          onClick={() => setTab("attendance")}
          className={`tab-button ${tab === "attendance" ? "active" : ""}`}
        >
          Attendance
        </button>
        <button
          type="button"
          onClick={() => setTab("door")}
          className={`tab-button ${tab === "door" ? "active" : ""}`}
        >
          Door Mode
        </button>
        <button
          type="button"
          onClick={() => setTab("rosters")}
          className={`tab-button ${tab === "rosters" ? "active" : ""}`}
        >
          Rosters
        </button>
      </div>

      {tab === "attendance" ? (
        <div className="attendance-grid">
          <div className="card">
            <div className="card-header-row">
              <h2>Check-In</h2>
              <button
                type="button"
                className="primary-button"
                onClick={openRegistrationModal}
              >
                New Registration
              </button>
            </div>

            <div className="toolbar-row">
              <input
                className="input"
                placeholder="Search player, school, phone, email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <select
                className="select group-select"
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
              >
                <option value="All">All</option>
                <option value="High School">High School</option>
                <option value="Middle School">Middle School</option>
              </select>
            </div>

            <div className="filter-chip-row">
              {ATTENDANCE_FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`filter-chip ${
                    attendanceFilter === option.value ? "active" : ""
                  }`}
                  onClick={() => setAttendanceFilter(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="checkin-list">
              {filteredPlayers.map((player) => {
                const latest = latestEvalMap.get(player.id);
                const isSelected = selectedPlayerId === player.id;

                return (
                  <button
                    key={player.id}
                    type="button"
                    className={`checkin-row ${isSelected ? "active" : ""}`}
                    onClick={() => setSelectedPlayerId(player.id)}
                  >
                    <PlayerPhoto
                      src={player.photo_url}
                      alt={`${player.first_name ?? ""} ${player.last_name ?? ""}`}
                    />
                    <div className="checkin-row-main">
                      <div className="checkin-row-name">
                        {player.last_name}, {player.first_name}
                      </div>
                      <div className="checkin-row-meta">
                        {player.grade_group} • {player.grade} • {player.school}
                      </div>
                      <div className="badge-row">
                        <span
                          className={`badge ${
                            player.checked_in ? "badge-good" : "badge-neutral"
                          }`}
                        >
                          {player.checked_in ? "Checked In" : "Not Checked In"}
                        </span>
                        <span
                          className={`badge ${
                            latest ? "badge-info" : "badge-neutral"
                          }`}
                        >
                          {latest ? "Evaluated" : "Not Evaluated"}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}

              {filteredPlayers.length === 0 && <p>No players found.</p>}
            </div>
          </div>

          <div className="card">
            <div className="card-header-row">
              <h2>Selected Player</h2>
              {selectedPlayer && (
                <div className="selected-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => openEditModal(selectedPlayer)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => openEvaluationModal(selectedPlayer)}
                  >
                    Evaluate
                  </button>
                </div>
              )}
            </div>

            {selectedPlayer ? (
              <div className="selected-player-panel">
                <div className="selected-player-top">
                  <PlayerPhoto
                    src={selectedPlayer.photo_url}
                    alt={`${selectedPlayer.first_name ?? ""} ${selectedPlayer.last_name ?? ""}`}
                    large
                  />

                  <div className="selected-player-info">
                    <div className="player-name">
                      {selectedPlayer.last_name}, {selectedPlayer.first_name}
                    </div>
                    <div className="player-meta">
                      {selectedPlayer.grade_group} • {selectedPlayer.grade}
                    </div>
                    <div className="player-meta">{selectedPlayer.school}</div>

                    <div className="badge-row">
                      <span
                        className={`badge ${
                          selectedPlayer.checked_in
                            ? "badge-good"
                            : "badge-neutral"
                        }`}
                      >
                        {selectedPlayer.checked_in
                          ? "Checked In"
                          : "Not Checked In"}
                      </span>

                      <span className="badge badge-team">
                        {selectedPlayer.suggested_team ?? "Undecided"}
                      </span>

                      <span
                        className={`badge ${
                          latestEvalMap.get(selectedPlayer.id)
                            ? "badge-info"
                            : "badge-neutral"
                        }`}
                      >
                        {latestEvalMap.get(selectedPlayer.id)
                          ? "Evaluated"
                          : "Not Evaluated"}
                      </span>
                    </div>

                    <div className="score-line">
                      Latest Score:{" "}
                      <span
                        className={`score-pill score-${getScoreTone(
                          latestEvalMap.get(selectedPlayer.id)?.total_score
                        )}`}
                      >
                        {latestEvalMap.get(selectedPlayer.id)?.total_score ?? "-"} / 65
                      </span>
                    </div>
                  </div>
                </div>

                <div className="selected-player-details">
                  <div className="detail-line">
                    <strong>Player Cell:</strong> {selectedPlayer.player_phone || "-"}
                  </div>
                  <div className="detail-line">
                    <strong>Parent Cell:</strong> {selectedPlayer.parent_phone || "-"}
                  </div>
                  <div className="detail-line">
                    <strong>Parent Email:</strong> {selectedPlayer.parent_email || "-"}
                  </div>
                  <div className="detail-line">
                    <strong>Notes:</strong> {selectedPlayer.notes || "-"}
                  </div>
                </div>

                <div className="selected-player-buttons">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => toggleCheckIn(selectedPlayer)}
                  >
                    {selectedPlayer.checked_in ? "Mark Absent" : "Check In"}
                  </button>

                  <select
                    className="select"
                    value={selectedPlayer.suggested_team ?? "Undecided"}
                    onChange={(e) =>
                      updateSuggestedTeam(
                        selectedPlayer,
                        e.target.value as TeamOption
                      )
                    }
                  >
                    {TEAM_OPTIONS.map((team) => (
                      <option key={team} value={team}>
                        {team}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <p>Select a player from the check-in list.</p>
            )}
          </div>
        </div>
      ) : tab === "door" ? (
        <div className="door-grid">
          <div className="card">
            <div className="card-header-row">
              <h2>Door Mode</h2>
              <button
                type="button"
                className="primary-button"
                onClick={openRegistrationModal}
              >
                New Registration
              </button>
            </div>

            <input
              className="input door-search"
              placeholder="Search by player name or school"
              value={doorSearch}
              onChange={(e) => setDoorSearch(e.target.value)}
            />

            <div className="door-list">
              {doorPlayers.map((player) => (
                <div key={player.id} className="door-row">
                  <div className="door-row-main">
                    <PlayerPhoto
                      src={player.photo_url}
                      alt={`${player.first_name ?? ""} ${player.last_name ?? ""}`}
                    />
                    <div>
                      <div className="door-name">
                        {player.last_name}, {player.first_name}
                      </div>
                      <div className="door-meta">
                        {player.grade_group} • {player.grade} • {player.school}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={`door-checkin-button ${
                      player.checked_in ? "checked" : ""
                    }`}
                    onClick={() => toggleCheckIn(player)}
                  >
                    {player.checked_in ? "Checked In" : "Check In"}
                  </button>
                </div>
              ))}

              {doorPlayers.length === 0 && <p>No players found.</p>}
            </div>
          </div>
        </div>
      ) : (
        <div className="rosters-page">
          <div className="rosters-toolbar">
            <h2 className="roster-title">Rosters & Team Stats</h2>
            <div className="rosters-toolbar-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={exportAllPlayersCsv}
              >
                Export All Players CSV
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={exportRosterCsv}
              >
                Export Rosters CSV
              </button>
            </div>
          </div>

          <div className="team-stats-grid">
            {teamStats.map((stat) => (
              <div key={stat.team} className="team-stat-card">
                <div className="team-stat-title">{stat.team}</div>
                <div className="team-stat-line">Players: {stat.count}</div>
                <div className="team-stat-line">Checked In: {stat.checkedIn}</div>
                <div className="team-stat-line">Evaluated: {stat.evaluated}</div>
                <div className="team-stat-line">
                  Avg Score: {stat.averageScore ?? "-"}
                </div>
              </div>
            ))}
          </div>

          <div className="roster-grid">
            {TEAM_OPTIONS.map((team) => (
              <div key={team} className="card">
                <div className="roster-team-title">{team}</div>
                <div className="roster-count">
                  Count: {rosterGroups[team].length}
                </div>

                <div className="roster-list">
                  {rosterGroups[team].length === 0 ? (
                    <div className="empty-text">No players assigned.</div>
                  ) : (
                    rosterGroups[team].map((player) => {
                      const latest = latestEvalMap.get(player.id);
                      return (
                        <div key={player.id} className="roster-player-card">
                          <div className="roster-player-top">
                            <PlayerPhoto
                              src={player.photo_url}
                              alt={`${player.first_name ?? ""} ${player.last_name ?? ""}`}
                            />
                            <div>
                              <div className="roster-player-name">
                                {player.last_name}, {player.first_name}
                              </div>
                              <div>
                                {player.grade_group} • {player.grade}
                              </div>
                              <div>{player.school}</div>
                            </div>
                          </div>
                          <div className="roster-player-meta">
                            Latest Eval Score: {latest?.total_score ?? "-"} / 65
                          </div>
                          <div className="roster-player-meta">
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

      {isRegistrationOpen && (
        <div className="modal-overlay" onClick={closeRegistrationModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>New Registration</h3>
              <button
                type="button"
                className="modal-close"
                onClick={closeRegistrationModal}
              >
                ×
              </button>
            </div>

            <form onSubmit={addPlayer} className="form-stack">
              <PhotoPicker onFileReady={(file) => setRegistrationPhotoFile(file)} />

              <input
                className="input"
                placeholder="First Name"
                value={form.first_name}
                onChange={(e) =>
                  setForm({ ...form, first_name: e.target.value })
                }
              />
              <input
                className="input"
                placeholder="Last Name"
                value={form.last_name}
                onChange={(e) =>
                  setForm({ ...form, last_name: e.target.value })
                }
              />
              <input
                className="input"
                placeholder="Grade"
                value={form.grade}
                onChange={(e) => setForm({ ...form, grade: e.target.value })}
              />
              <input
                className="input"
                placeholder="School"
                value={form.school}
                onChange={(e) => setForm({ ...form, school: e.target.value })}
              />
              <input
                className="input"
                type="date"
                value={form.birth_date}
                onChange={(e) =>
                  setForm({ ...form, birth_date: e.target.value })
                }
              />
              <input
                className="input"
                placeholder="Player Cell"
                value={form.player_phone}
                onChange={(e) =>
                  setForm({ ...form, player_phone: e.target.value })
                }
              />
              <input
                className="input"
                placeholder="Parent Cell"
                value={form.parent_phone}
                onChange={(e) =>
                  setForm({ ...form, parent_phone: e.target.value })
                }
              />
              <input
                className="input"
                placeholder="Parent Email"
                value={form.parent_email}
                onChange={(e) =>
                  setForm({ ...form, parent_email: e.target.value })
                }
              />

              <div className="edit-actions">
                <button type="submit" className="primary-button">
                  Register Player
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeRegistrationModal}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditOpen && editingPlayerId && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Player</h3>
              <button
                type="button"
                className="modal-close"
                onClick={closeEditModal}
              >
                ×
              </button>
            </div>

            <form onSubmit={savePlayerEdits} className="form-stack">
              <PhotoPicker
                onFileReady={(file) => setEditPhotoFile(file)}
                currentPhotoUrl={
                  players.find((p) => p.id === editingPlayerId)?.photo_url
                }
              />

              <input
                className="input"
                placeholder="First Name"
                value={editForm.first_name}
                onChange={(e) =>
                  setEditForm({ ...editForm, first_name: e.target.value })
                }
              />
              <input
                className="input"
                placeholder="Last Name"
                value={editForm.last_name}
                onChange={(e) =>
                  setEditForm({ ...editForm, last_name: e.target.value })
                }
              />
              <input
                className="input"
                placeholder="Grade"
                value={editForm.grade}
                onChange={(e) =>
                  setEditForm({ ...editForm, grade: e.target.value })
                }
              />
              <input
                className="input"
                placeholder="School"
                value={editForm.school}
                onChange={(e) =>
                  setEditForm({ ...editForm, school: e.target.value })
                }
              />
              <input
                className="input"
                type="date"
                value={editForm.birth_date}
                onChange={(e) =>
                  setEditForm({ ...editForm, birth_date: e.target.value })
                }
              />
              <input
                className="input"
                placeholder="Player Cell"
                value={editForm.player_phone}
                onChange={(e) =>
                  setEditForm({ ...editForm, player_phone: e.target.value })
                }
              />
              <input
                className="input"
                placeholder="Parent Cell"
                value={editForm.parent_phone}
                onChange={(e) =>
                  setEditForm({ ...editForm, parent_phone: e.target.value })
                }
              />
              <input
                className="input"
                placeholder="Parent Email"
                value={editForm.parent_email}
                onChange={(e) =>
                  setEditForm({ ...editForm, parent_email: e.target.value })
                }
              />
              <textarea
                className="textarea"
                placeholder="Notes"
                value={editForm.notes}
                onChange={(e) =>
                  setEditForm({ ...editForm, notes: e.target.value })
                }
              />

              <div className="edit-actions">
                <button type="submit" className="primary-button">
                  Save Changes
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeEditModal}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEvaluationOpen && selectedPlayer && (
        <div className="modal-overlay" onClick={closeEvaluationModal}>
          <div
            className="modal-card modal-card-wide"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>
                Evaluation - {selectedPlayer.first_name} {selectedPlayer.last_name}
              </h3>
              <button
                type="button"
                className="modal-close"
                onClick={closeEvaluationModal}
              >
                ×
              </button>
            </div>

            <div className="evaluation-modal-grid">
              <div className="history-panel">
                <div className="history-header">
                  <h3>Evaluation History</h3>
                  <button
                    type="button"
                    onClick={startNewEvaluation}
                    className="secondary-button"
                  >
                    New Evaluation
                  </button>
                </div>

                <div className="history-list">
                  {playerEvaluations.length === 0 ? (
                    <div className="empty-text">No evaluations yet.</div>
                  ) : (
                    playerEvaluations.map((evaluation) => (
                      <button
                        key={evaluation.id}
                        type="button"
                        onClick={() => loadEvaluationIntoForm(evaluation)}
                        className={`history-button ${
                          editingEvaluationId === evaluation.id ? "active" : ""
                        }`}
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

              <form onSubmit={saveEvaluation} className="form-stack">
                <div className="card sub-card">
                  <label className="field-label">Evaluator</label>
                  <input
                    className="input"
                    value={evalForm.evaluator}
                    onChange={(e) =>
                      setEvalForm({ ...evalForm, evaluator: e.target.value })
                    }
                    placeholder="Coach name"
                  />

                  <label className="field-label">Suggested Team</label>
                  <select
                    className="select"
                    value={evalForm.suggested_team}
                    onChange={(e) =>
                      setEvalForm({
                        ...evalForm,
                        suggested_team: e.target.value as TeamOption,
                      })
                    }
                  >
                    {TEAM_OPTIONS.map((team) => (
                      <option key={team} value={team}>
                        {team}
                      </option>
                    ))}
                  </select>

                  <div className="score-total">
                    Total Score: {totalScore(evalForm)} / 65
                  </div>
                </div>

                <div className="card sub-card">
                  <h3 className="section-title">Physical Attributes</h3>
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

                <div className="card sub-card">
                  <h3 className="section-title">Skill Evaluation</h3>
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

                <div className="card sub-card">
                  <h3 className="section-title">Basketball IQ & Intangibles</h3>
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

                <div className="card sub-card">
                  <h3 className="section-title">General Notes</h3>
                  <textarea
                    className="textarea"
                    value={evalForm.general_notes}
                    onChange={(e) =>
                      setEvalForm({
                        ...evalForm,
                        general_notes: e.target.value,
                      })
                    }
                    placeholder="Add strengths, concerns, fit, upside, and notes..."
                  />
                </div>

                <div className="mode-text">
                  Mode:{" "}
                  {editingEvaluationId
                    ? "Editing Existing Evaluation"
                    : "New Evaluation"}
                </div>

                <div className="edit-actions">
                  <button type="submit" className="primary-button">
                    Save Evaluation
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={closeEvaluationModal}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
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
    <div className="eval-row">
      <div>{label}</div>
      <div>{control}</div>
    </div>
  );
}