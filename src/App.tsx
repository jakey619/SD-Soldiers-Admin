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
import {
  uploadManagementDocument,
  uploadPlayerDocument,
  uploadPlayerPhoto,
} from "./lib/playerPhotos";
import soldiersLogo from "./assets/soldiers-logo.png";
import "./app.css";

type TeamOption =
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

type MainTab =
  | "players"
  | "attendance"
  | "door"
  | "rosters"
  | "roster-management"
  | "documents";

type Player = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  grade: string | null;
  grade_group: string | null;
  school: string | null;
  birth_date: string | null;
  jersey_number: string | null;
  player_phone: string | null;
  player_email: string | null;
  uniform_size: string | null;
  guardian_1_name?: string | null;
  guardian_1_phone?: string | null;
  guardian_1_email?: string | null;
  guardian_2_name?: string | null;
  guardian_2_phone?: string | null;
  guardian_2_email?: string | null;
  parent_phone: string | null;
  parent_email: string | null;
  registered_at: string | null;
  checked_in: boolean;
  suggested_team: TeamOption | null;
  notes: string | null;
  photo_url?: string | null;
  birth_certificate_url?: string | null;
  report_card_url?: string | null;
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
};

const APP_VERSION = "1.2.0";

const VERSION_HISTORY = [
  {
    version: "1.2.0",
    date: "March 13, 2026",
    notes:
      "Added a dedicated Teams section, improved phone navigation, simplified mobile layouts, and updated player counts to reflect rostered players only.",
  },
  {
    version: "1.1.0",
    date: "March 13, 2026",
    notes:
      "Added guardian contact fields, player email, uniform size, richer player details, and version history in About.",
  },
  {
    version: "1.0.0",
    date: "March 2026",
    notes:
      "Initial San Diego Soldiers management dashboard release with player registration, evaluations, rosters, and documents.",
  },
] as const;

type ManagementDocumentCategory =
  | "insurance"
  | "agreement"
  | "receipt"
  | "finance"
  | "other";

type ManagementDocument = {
  name: string;
  path: string;
  url: string;
  createdAtLabel: string;
  title: string;
  category: string;
};

const TEAM_OPTIONS: TeamOption[] = [
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

const MANAGEMENT_DOCUMENT_CATEGORIES: {
  value: ManagementDocumentCategory;
  label: string;
}[] = [
  { value: "insurance", label: "Insurance" },
  { value: "agreement", label: "Agreement" },
  { value: "receipt", label: "Receipt" },
  { value: "finance", label: "Finance" },
  { value: "other", label: "Other" },
];

function groupFromGrade(grade: string) {
  const n = parseInt(grade, 10);
  if (!Number.isFinite(n)) return "High School";
  return n <= 8 ? "Middle School" : "High School";
}

function calculateAge(birthDate: string | null) {
  if (!birthDate) return null;

  const date = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const hasHadBirthday =
    today.getMonth() > date.getMonth() ||
    (today.getMonth() === date.getMonth() && today.getDate() >= date.getDate());

  if (!hasHadBirthday) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function formatBirthDate(birthDate: string | null) {
  if (!birthDate) return "-";

  const date = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return birthDate;

  return date.toLocaleDateString();
}

function ordinalSuffix(value: number) {
  const remainder100 = value % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return "th";

  switch (value % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

function formatGradeLabel(grade: string | null) {
  if (!grade) return "-";

  const numericGrade = Number.parseInt(grade, 10);
  if (!Number.isFinite(numericGrade)) {
    return grade;
  }

  return `${numericGrade}${ordinalSuffix(numericGrade)} Grade`;
}

function isProgramTeam(team: TeamOption | null | undefined) {
  return (team ?? "Undecided") !== "Undecided";
}

function sanitizePhoneNumber(phone: string | null) {
  if (!phone) return "";
  return phone.replace(/[^\d+]/g, "");
}

function sanitizeFilenamePart(value: string) {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleaned || "roster-template";
}

function parseCsvRow(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function parseCsvText(text: string) {
  return text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseCsvRow);
}

function getGuardian1Phone(player: Player) {
  return player.guardian_1_phone ?? player.parent_phone;
}

function getGuardian1Email(player: Player) {
  return player.guardian_1_email ?? player.parent_email;
}

function createEmptyPlayerForm(suggestedTeam: TeamOption = "Undecided") {
  return {
    first_name: "",
    last_name: "",
    grade: "",
    school: "",
    birth_date: "",
    jersey_number: "",
    player_phone: "",
    player_email: "",
    uniform_size: "",
    guardian_1_name: "",
    guardian_1_phone: "",
    guardian_1_email: "",
    guardian_2_name: "",
    guardian_2_phone: "",
    guardian_2_email: "",
    suggested_team: suggestedTeam,
  };
}

function playerSearchText(player: Player) {
  return [
    player.first_name,
    player.last_name,
    player.grade,
    player.grade_group,
    player.school,
    player.birth_date,
    player.jersey_number,
    player.player_phone,
    player.player_email,
    player.uniform_size,
    player.guardian_1_name,
    getGuardian1Phone(player),
    getGuardian1Email(player),
    player.guardian_2_name,
    player.guardian_2_phone,
    player.guardian_2_email,
    player.parent_phone,
    player.parent_email,
    player.suggested_team,
    player.notes,
    player.checked_in ? "checked in" : "not checked in",
    player.birth_certificate_url ? "birth certificate" : "missing birth certificate",
    player.report_card_url ? "report card" : "missing report card",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function parseManagementDocument(name: string, url: string): ManagementDocument {
  const [rawTimestamp = "", rawCategory = "other", rawTitleWithExt = name] =
    name.split("__");
  const titleWithoutExt = rawTitleWithExt.replace(/\.[^.]+$/, "");
  const title = titleWithoutExt
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  const timestamp = Number(rawTimestamp);

  return {
    name,
    path: name,
    url,
    createdAtLabel: Number.isFinite(timestamp)
      ? new Date(timestamp).toLocaleString()
      : "-",
    title: title || "Document",
    category: rawCategory
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
  };
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

function DocumentPicker({
  label,
  accept = ".pdf,image/*",
  onFileReady,
  currentUrl,
}: {
  label: string;
  accept?: string;
  onFileReady: (file: File | null) => void;
  currentUrl?: string | null;
}) {
  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    onFileReady(file);
  }

  return (
    <div className="document-picker">
      <label className="field-label">{label}</label>
      <input className="input" type="file" accept={accept} onChange={handleFileChange} />
      {currentUrl && (
        <a
          className="document-link"
          href={currentUrl}
          target="_blank"
          rel="noreferrer"
        >
          View current {label.toLowerCase()}
        </a>
      )}
    </div>
  );
}

function DocumentStatus({
  label,
  url,
}: {
  label: string;
  url?: string | null;
}) {
  const isAvailable = Boolean(url);

  return (
    <div className={`document-status ${isAvailable ? "available" : ""}`}>
      <input type="checkbox" checked={isAvailable} readOnly disabled />
      <span>{label}</span>
      {url && (
        <a href={url} target="_blank" rel="noreferrer" className="document-status-link">
          View
        </a>
      )}
    </div>
  );
}

function FormFieldRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="form-field-row">
      <label className="form-field-label">{label}</label>
      <div>{children}</div>
    </div>
  );
}

function NavButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tab-button ${active ? "active" : ""}`}
    >
      {label}
    </button>
  );
}

function ContactLink({
  type,
  value,
}: {
  type: "phone" | "email";
  value: string | null;
}) {
  if (!value) return <>-</>;

  const href =
    type === "phone"
      ? `tel:${sanitizePhoneNumber(value)}`
      : `mailto:${value.trim()}`;

  return (
    <a className="contact-link" href={href} onClick={(e) => e.stopPropagation()}>
      {value}
    </a>
  );
}

function SummaryListCard({
  title,
  items,
}: {
  title: string;
  items: { label: string; count: number }[];
}) {
  return (
    <div className="summary-card summary-card-compact">
      <div className="summary-label">{title}</div>
      <div className="summary-list">
        {items.map((item) => (
          <div key={item.label} className="summary-list-row">
            <span>{item.label}</span>
            <strong>{item.count}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlayerDetailItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="player-detail-item">
      <div className="player-detail-label">{label}</div>
      <div className="player-detail-value">{value}</div>
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
  const [tab, setTab] = useState<MainTab>("players");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [activeRosterTeam, setActiveRosterTeam] = useState<TeamOption>("15u Salute");
  const [rosterAddPlayerId, setRosterAddPlayerId] = useState("");
  const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);
  const [rosterManagementSearch, setRosterManagementSearch] = useState("");
  const [mobileRosterTargets, setMobileRosterTargets] = useState<
    Record<string, TeamOption>
  >({});
  const [rosterTemplateName, setRosterTemplateName] = useState("");
  const [rosterImportFile, setRosterImportFile] = useState<File | null>(null);
  const [managementDocuments, setManagementDocuments] = useState<ManagementDocument[]>([]);
  const [managementDocumentTitle, setManagementDocumentTitle] = useState("");
  const [managementDocumentCategory, setManagementDocumentCategory] =
    useState<ManagementDocumentCategory>("insurance");
  const [managementDocumentFile, setManagementDocumentFile] = useState<File | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [modalRosterTeam, setModalRosterTeam] = useState<TeamOption | null>(null);
  const [viewingPlayerId, setViewingPlayerId] = useState<string | null>(null);

  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [isEvaluationOpen, setIsEvaluationOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const [editingEvaluationId, setEditingEvaluationId] = useState<string | null>(null);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [evalForm, setEvalForm] = useState<EvalForm>(initialEvalForm());

  const [form, setForm] = useState(createEmptyPlayerForm());
  const [registrationPhotoFile, setRegistrationPhotoFile] = useState<File | null>(null);
  const [registrationBirthCertificateFile, setRegistrationBirthCertificateFile] =
    useState<File | null>(null);
  const [registrationReportCardFile, setRegistrationReportCardFile] =
    useState<File | null>(null);

  const [editForm, setEditForm] = useState({
    ...createEmptyPlayerForm(),
    notes: "",
  });
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [editBirthCertificateFile, setEditBirthCertificateFile] =
    useState<File | null>(null);
  const [editReportCardFile, setEditReportCardFile] = useState<File | null>(null);

  const selectedPlayer = players.find((p) => p.id === selectedPlayerId) ?? null;
  const viewingPlayer = players.find((p) => p.id === viewingPlayerId) ?? null;

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

  async function loadManagementDocuments() {
    const { data, error } = await supabase.storage
      .from("management-documents")
      .list("", { limit: 200, sortBy: { column: "name", order: "desc" } });

    if (error) {
      setStatus(`Management documents load error: ${error.message}`);
      return;
    }

    const docs = (data ?? [])
      .filter((item) => item.name && !item.id?.endsWith("/"))
      .map((item) => {
        const { data: publicUrlData } = supabase.storage
          .from("management-documents")
          .getPublicUrl(item.name);
        return parseManagementDocument(item.name, publicUrlData.publicUrl);
      });

    setManagementDocuments(docs);
  }

  async function refreshAll() {
    await loadPlayers();
    await loadLatestEvaluations();
    await loadManagementDocuments();
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

  const gradeOptions = useMemo(() => {
    return [
      ...new Set(
        players
          .filter((player) => (player.suggested_team ?? "Undecided") !== "Undecided")
          .map((player) => player.grade)
          .filter(Boolean)
      ),
    ]
      .map((grade) => grade as string)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [players]);

  const filteredPlayers = useMemo(() => {
    return players.filter((player) => {
      const matchesSearch = playerSearchText(player).includes(search.toLowerCase());
      return matchesSearch;
    });
  }, [players, search]);

  const doorPlayers = useMemo(() => {
    const term = doorSearch.toLowerCase();
    return players
      .filter((player) => {
        return playerSearchText(player).includes(term);
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
      "2030 Salute": [],
      "2030 Honor": [],
      "2031 Salute": [],
      "2031 Honor": [],
      "2032 Salute": [],
      "2032 Honor": [],
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

  const activeRosterPlayers = rosterGroups[activeRosterTeam] ?? [];

  const rosterAssignablePlayers = useMemo(() => {
    return [...players]
      .filter((player) => (player.suggested_team ?? "Undecided") !== activeRosterTeam)
      .sort((a, b) =>
        `${a.last_name ?? ""} ${a.first_name ?? ""}`.localeCompare(
          `${b.last_name ?? ""} ${b.first_name ?? ""}`
        )
      );
  }, [players, activeRosterTeam, rosterAddPlayerId]);

  const rosterManagementFilteredPlayers = useMemo(() => {
    const term = rosterManagementSearch.toLowerCase();
    const source = term
      ? players.filter((player) => playerSearchText(player).includes(term))
      : players;

    return [...source].sort((a, b) =>
      `${a.last_name ?? ""} ${a.first_name ?? ""}`.localeCompare(
        `${b.last_name ?? ""} ${b.first_name ?? ""}`
      )
    );
  }, [players, rosterManagementSearch]);

  const checkedInCount = useMemo(
    () => players.filter((p) => p.checked_in).length,
    [players]
  );
  const rosteredPlayers = useMemo(
    () => players.filter((player) => (player.suggested_team ?? "Undecided") !== "Undecided"),
    [players]
  );

  const evaluatedCount = useMemo(() => {
    const ids = new Set(latestEvaluations.map((ev) => ev.player_id));
    return ids.size;
  }, [latestEvaluations]);

  const notCheckedInCount = players.length - checkedInCount;
  const mobileTabItems: { key: MainTab; shortLabel: string }[] = [
    { key: "players", shortLabel: "Players" },
    { key: "rosters", shortLabel: "Teams" },
    { key: "attendance", shortLabel: "Evals" },
    { key: "door", shortLabel: "Tryouts" },
    { key: "roster-management", shortLabel: "Manage" },
    { key: "documents", shortLabel: "Docs" },
  ];

  const gradeCounts = useMemo(() => {
    return gradeOptions.map((grade) => ({
      grade,
      count: rosteredPlayers.filter((player) => player.grade === grade).length,
    }));
  }, [rosteredPlayers, gradeOptions]);

  function goToTab(nextTab: MainTab) {
    setTab(nextTab);
    setIsMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const teamStats = useMemo<TeamStats[]>(() => {
    return TEAM_OPTIONS.filter((team) => team !== "Undecided").map((team) => {
      const teamPlayers = rosteredPlayers.filter(
        (player) => (player.suggested_team ?? "Undecided") === team
      );

      return {
        team,
        count: teamPlayers.length,
      };
    });
  }, [rosteredPlayers]);

  function exportAllPlayersCsv() {
    const rows: string[][] = [
      [
        "Last Name",
        "First Name",
        "Grade Group",
        "Grade",
        "School",
        "Jersey Number",
        "Birthdate",
        "Age",
        "Checked In",
        "Suggested Team",
        "Latest Score",
        "Evaluated",
        "Player Phone",
        "Player Email",
        "Uniform Size",
        "Guardian 1 Name",
        "Guardian 1 Phone",
        "Guardian 1 Email",
        "Guardian 2 Name",
        "Guardian 2 Phone",
        "Guardian 2 Email",
        "Birth Certificate",
        "Report Card",
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
        player.jersey_number ?? "",
        player.birth_date ?? "",
        calculateAge(player.birth_date)?.toString() ?? "",
        player.checked_in ? "Yes" : "No",
        player.suggested_team ?? "Undecided",
        latest?.total_score?.toString() ?? "",
        latest ? "Yes" : "No",
        player.player_phone ?? "",
        player.player_email ?? "",
        player.uniform_size ?? "",
        player.guardian_1_name ?? "",
        getGuardian1Phone(player) ?? "",
        getGuardian1Email(player) ?? "",
        player.guardian_2_name ?? "",
        player.guardian_2_phone ?? "",
        player.guardian_2_email ?? "",
        player.birth_certificate_url ? "Yes" : "No",
        player.report_card_url ? "Yes" : "No",
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
        "Jersey Number",
        "Birthdate",
        "Age",
        "Checked In",
        "Latest Score",
        "Evaluator",
        "Player Phone",
        "Player Email",
        "Uniform Size",
        "Guardian 1 Name",
        "Guardian 1 Phone",
        "Guardian 1 Email",
        "Guardian 2 Name",
        "Guardian 2 Phone",
        "Guardian 2 Email",
        "Birth Certificate",
        "Report Card",
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
          player.jersey_number ?? "",
          player.birth_date ?? "",
          calculateAge(player.birth_date)?.toString() ?? "",
          player.checked_in ? "Yes" : "No",
          latest?.total_score?.toString() ?? "",
          latest?.evaluator ?? "",
          player.player_phone ?? "",
          player.player_email ?? "",
          player.uniform_size ?? "",
          player.guardian_1_name ?? "",
          getGuardian1Phone(player) ?? "",
          getGuardian1Email(player) ?? "",
          player.guardian_2_name ?? "",
          player.guardian_2_phone ?? "",
          player.guardian_2_email ?? "",
          player.birth_certificate_url ? "Yes" : "No",
          player.report_card_url ? "Yes" : "No",
        ]);
      });
    });

    downloadCsv("soldiers-rosters.csv", rows);
    setStatus("Exported soldiers-rosters.csv");
  }

  function openRegistrationModal(suggestedTeam: TeamOption = "Undecided") {
    setForm(createEmptyPlayerForm(suggestedTeam));
    setRegistrationPhotoFile(null);
    setRegistrationBirthCertificateFile(null);
    setRegistrationReportCardFile(null);
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
      jersey_number: player.jersey_number ?? "",
      player_phone: player.player_phone ?? "",
      player_email: player.player_email ?? "",
      uniform_size: player.uniform_size ?? "",
      guardian_1_name: player.guardian_1_name ?? "",
      guardian_1_phone: getGuardian1Phone(player) ?? "",
      guardian_1_email: getGuardian1Email(player) ?? "",
      guardian_2_name: player.guardian_2_name ?? "",
      guardian_2_phone: player.guardian_2_phone ?? "",
      guardian_2_email: player.guardian_2_email ?? "",
      suggested_team: player.suggested_team ?? "Undecided",
      notes: player.notes ?? "",
    });
    setEditPhotoFile(null);
    setEditBirthCertificateFile(null);
    setEditReportCardFile(null);
    setIsEditOpen(true);
    setStatus(`Editing ${player.first_name} ${player.last_name}.`);
  }

  function closeEditModal() {
    setIsEditOpen(false);
    setEditingPlayerId(null);
    setEditPhotoFile(null);
    setEditBirthCertificateFile(null);
    setEditReportCardFile(null);
    setStatus("Edit cancelled.");
  }

  async function uploadPlayerAssets(
    playerId: string,
    currentPlayer: Player | null,
    assets: {
      photoFile?: File | null;
      birthCertificateFile?: File | null;
      reportCardFile?: File | null;
    }
  ) {
    const payload: Partial<Player> = {};
    const errors: string[] = [];

    payload.photo_url = currentPlayer?.photo_url ?? null;
    payload.birth_certificate_url = currentPlayer?.birth_certificate_url ?? null;
    payload.report_card_url = currentPlayer?.report_card_url ?? null;

    if (assets.photoFile) {
      try {
        payload.photo_url = await uploadPlayerPhoto(assets.photoFile, playerId);
      } catch (error) {
        errors.push(
          error instanceof Error ? `Photo: ${error.message}` : "Photo upload failed."
        );
      }
    }

    if (assets.birthCertificateFile) {
      try {
        payload.birth_certificate_url = await uploadPlayerDocument(
          assets.birthCertificateFile,
          playerId,
          "birth-certificate"
        );
      } catch (error) {
        errors.push(
          error instanceof Error
            ? `Birth certificate: ${error.message}`
            : "Birth certificate upload failed."
        );
      }
    }

    if (assets.reportCardFile) {
      try {
        payload.report_card_url = await uploadPlayerDocument(
          assets.reportCardFile,
          playerId,
          "report-card"
        );
      } catch (error) {
        errors.push(
          error instanceof Error
            ? `Report card: ${error.message}`
            : "Report card upload failed."
        );
      }
    }

    return { payload, errors };
  }

  async function addPlayer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!form.first_name.trim() || !form.last_name.trim()) {
      setStatus("First name and last name are required.");
      return;
    }

    const { data, error } = await supabase
      .from("players")
      .insert([
        {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          grade: form.grade.trim(),
          grade_group: groupFromGrade(form.grade.trim()),
          school: form.school || null,
          birth_date: form.birth_date || null,
          jersey_number: form.jersey_number || null,
          player_phone: form.player_phone || null,
          player_email: form.player_email || null,
          uniform_size: form.uniform_size || null,
          guardian_1_name: form.guardian_1_name || null,
          guardian_1_phone: form.guardian_1_phone || null,
          guardian_1_email: form.guardian_1_email || null,
          guardian_2_name: form.guardian_2_name || null,
          guardian_2_phone: form.guardian_2_phone || null,
          guardian_2_email: form.guardian_2_email || null,
          parent_phone: form.guardian_1_phone || null,
          parent_email: form.guardian_1_email || null,
          checked_in: true,
          suggested_team: form.suggested_team,
          notes: "Onsite registration",
        },
      ])
      .select()
      .single();

    if (error || !data) {
      setStatus(`Insert error: ${error?.message ?? "Unable to create player."}`);
      return;
    }

    const { payload: assetPayload, errors: assetErrors } = await uploadPlayerAssets(
      data.id,
      null,
      {
        photoFile: registrationPhotoFile,
        birthCertificateFile: registrationBirthCertificateFile,
        reportCardFile: registrationReportCardFile,
      }
    );

    if (
      registrationPhotoFile ||
      registrationBirthCertificateFile ||
      registrationReportCardFile
    ) {
      const { error: assetUpdateError } = await supabase
        .from("players")
        .update(assetPayload)
        .eq("id", data.id);

      if (assetUpdateError) {
        assetErrors.push(assetUpdateError.message);
      }
    }

    closeRegistrationModal();
    await refreshAll();
    setSelectedPlayerId(data.id);
    setTab(isProgramTeam(form.suggested_team) ? "rosters" : "players");
    setStatus(
      assetErrors.length > 0
        ? `Player registered. Upload issues: ${assetErrors.join(" ")}`
        : isProgramTeam(form.suggested_team)
          ? "Player registered successfully."
          : "Player saved to the player pool. Assign a team to include them in Total Players."
    );
  }

  async function savePlayerEdits(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!editingPlayerId) return;

    const currentPlayer = players.find((p) => p.id === editingPlayerId) ?? null;

    const payload = {
      first_name: editForm.first_name,
      last_name: editForm.last_name,
      grade: editForm.grade,
      grade_group: groupFromGrade(editForm.grade),
      school: editForm.school || null,
      birth_date: editForm.birth_date || null,
      jersey_number: editForm.jersey_number || null,
      player_phone: editForm.player_phone || null,
      player_email: editForm.player_email || null,
      uniform_size: editForm.uniform_size || null,
      guardian_1_name: editForm.guardian_1_name || null,
      guardian_1_phone: editForm.guardian_1_phone || null,
      guardian_1_email: editForm.guardian_1_email || null,
      guardian_2_name: editForm.guardian_2_name || null,
      guardian_2_phone: editForm.guardian_2_phone || null,
      guardian_2_email: editForm.guardian_2_email || null,
      parent_phone: editForm.guardian_1_phone || null,
      parent_email: editForm.guardian_1_email || null,
      suggested_team: editForm.suggested_team,
      notes: editForm.notes || null,
      photo_url: currentPlayer?.photo_url ?? null,
    };

    const { payload: assetPayload, errors: assetErrors } = await uploadPlayerAssets(
      editingPlayerId,
      currentPlayer,
      {
        photoFile: editPhotoFile,
        birthCertificateFile: editBirthCertificateFile,
        reportCardFile: editReportCardFile,
      }
    );

    payload.photo_url = assetPayload.photo_url ?? currentPlayer?.photo_url ?? null;
    const fullPayload = {
      ...payload,
      birth_certificate_url: assetPayload.birth_certificate_url ?? null,
      report_card_url: assetPayload.report_card_url ?? null,
    };

    const { error } = await supabase
      .from("players")
      .update(fullPayload)
      .eq("id", editingPlayerId);

    if (error) {
      setStatus(`Edit error: ${error.message}`);
      return;
    }

    setPlayers((prev) =>
      prev.map((p) => (p.id === editingPlayerId ? { ...p, ...fullPayload } : p))
    );

    setIsEditOpen(false);
    setEditingPlayerId(null);
    setEditPhotoFile(null);
    setEditBirthCertificateFile(null);
    setEditReportCardFile(null);
    setStatus(
      assetErrors.length > 0
        ? `Player updated with upload issues: ${assetErrors.join(" ")}`
        : "Player info updated."
    );
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

  async function addPlayerToRoster() {
    if (!rosterAddPlayerId) {
      setStatus("Select a player to add to the roster.");
      return;
    }

    const player = players.find((entry) => entry.id === rosterAddPlayerId);
    if (!player) {
      setStatus("Selected player was not found.");
      return;
    }

    await updateSuggestedTeam(player, activeRosterTeam);
    setRosterAddPlayerId("");
  }

  async function handleRosterDrop(team: TeamOption) {
    if (!draggedPlayerId) return;

    const player = players.find((entry) => entry.id === draggedPlayerId);
    setDraggedPlayerId(null);

    if (!player) {
      setStatus("Dragged player was not found.");
      return;
    }

    if ((player.suggested_team ?? "Undecided") === team) {
      return;
    }

    await updateSuggestedTeam(player, team);
  }

  function getMobileRosterTarget(player: Player) {
    return mobileRosterTargets[player.id] ?? (player.suggested_team ?? "Undecided");
  }

  async function movePlayerFromMobile(player: Player) {
    const targetTeam = getMobileRosterTarget(player);

    if ((player.suggested_team ?? "Undecided") === targetTeam) {
      setStatus(`${player.first_name} ${player.last_name} is already on ${targetTeam}.`);
      return;
    }

    await updateSuggestedTeam(player, targetTeam);
  }

  function downloadRosterImportTemplate() {
    const templateName = rosterTemplateName.trim();
    const rows: string[][] = [
      [
        "Team",
        "First Name",
        "Last Name",
        "Grade",
        "School",
        "Jersey Number",
        "Player Phone",
        "Player Email",
        "Uniform Size",
        "Guardian 1 Name",
        "Guardian 1 Phone",
        "Guardian 1 Email",
        "Guardian 2 Name",
        "Guardian 2 Phone",
        "Guardian 2 Email",
        "Notes",
      ],
      [
        activeRosterTeam,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ],
    ];

    const filename = `${sanitizeFilenamePart(
      templateName || `${activeRosterTeam} roster`
    )}.csv`;
    downloadCsv(filename, rows);
    setStatus(`Downloaded roster upload template: ${filename}`);
  }

  async function importRosterTemplate() {
    if (!rosterImportFile) {
      setStatus("Choose a filled roster template to upload.");
      return;
    }

    const text = await rosterImportFile.text();
    const rows = parseCsvText(text);

    if (rows.length < 2) {
      setStatus("The uploaded roster file is empty.");
      return;
    }

    const headers = rows[0];
    const requiredHeaders = ["Team", "First Name", "Last Name"];
    const missingHeaders = requiredHeaders.filter(
      (header) => !headers.includes(header)
    );

    if (missingHeaders.length > 0) {
      setStatus(`Template is missing required columns: ${missingHeaders.join(", ")}`);
      return;
    }

    const headerIndex = new Map(headers.map((header, index) => [header, index]));
    const getValue = (row: string[], key: string) =>
      row[headerIndex.get(key) ?? -1]?.trim() ?? "";

    let createdCount = 0;
    let updatedCount = 0;

    for (const row of rows.slice(1)) {
      const firstName = getValue(row, "First Name");
      const lastName = getValue(row, "Last Name");
      const grade = getValue(row, "Grade");
      const teamValue = getValue(row, "Team");

      if (!firstName || !lastName) {
        continue;
      }

      const matchedTeam = TEAM_OPTIONS.find((team) => team === teamValue) ?? "Undecided";
      const existingPlayer = players.find((player) => {
        const sameFirst =
          (player.first_name ?? "").trim().toLowerCase() === firstName.toLowerCase();
        const sameLast =
          (player.last_name ?? "").trim().toLowerCase() === lastName.toLowerCase();
        const sameGrade =
          !grade || (player.grade ?? "").trim().toLowerCase() === grade.toLowerCase();

        return sameFirst && sameLast && sameGrade;
      });

      const payload = {
        first_name: firstName,
        last_name: lastName,
        grade: grade || null,
        grade_group: grade ? groupFromGrade(grade) : null,
        school: getValue(row, "School") || null,
        jersey_number: getValue(row, "Jersey Number") || null,
        player_phone: getValue(row, "Player Phone") || null,
        player_email: getValue(row, "Player Email") || null,
        uniform_size: getValue(row, "Uniform Size") || null,
        guardian_1_name: getValue(row, "Guardian 1 Name") || null,
        guardian_1_phone: getValue(row, "Guardian 1 Phone") || null,
        guardian_1_email: getValue(row, "Guardian 1 Email") || null,
        guardian_2_name: getValue(row, "Guardian 2 Name") || null,
        guardian_2_phone: getValue(row, "Guardian 2 Phone") || null,
        guardian_2_email: getValue(row, "Guardian 2 Email") || null,
        parent_phone: getValue(row, "Guardian 1 Phone") || null,
        parent_email: getValue(row, "Guardian 1 Email") || null,
        suggested_team: matchedTeam,
        notes: getValue(row, "Notes") || null,
      };

      if (existingPlayer) {
        const { error } = await supabase
          .from("players")
          .update(payload)
          .eq("id", existingPlayer.id);

        if (error) {
          setStatus(`Roster upload error: ${error.message}`);
          return;
        }

        updatedCount += 1;
      } else {
        const { error } = await supabase.from("players").insert([
          {
            ...payload,
            checked_in: false,
          },
        ]);

        if (error) {
          setStatus(`Roster upload error: ${error.message}`);
          return;
        }

        createdCount += 1;
      }
    }

    await refreshAll();
    setRosterImportFile(null);
    setStatus(
      `Roster upload complete. Updated ${updatedCount} player(s), created ${createdCount} player(s).`
    );
  }

  async function uploadManagementDoc(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!managementDocumentFile) {
      setStatus("Choose a file to upload.");
      return;
    }

    const title = managementDocumentTitle.trim() || managementDocumentFile.name;

    try {
      await uploadManagementDocument(
        managementDocumentFile,
        title,
        managementDocumentCategory
      );
      setManagementDocumentTitle("");
      setManagementDocumentCategory("insurance");
      setManagementDocumentFile(null);
      await loadManagementDocuments();
      setStatus("Management document uploaded.");
    } catch (error) {
      setStatus(
        `Management document upload error: ${
          error instanceof Error ? error.message : "Upload failed."
        }`
      );
    }
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
            <div className="brand-subtitle">
              Team Management Dashboard | Version {APP_VERSION}
            </div>
          </div>
        </div>

        <div className="status-area">
          <button
            type="button"
            className="mobile-menu-button"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            aria-label="Open navigation menu"
            aria-expanded={isMobileMenuOpen}
          >
            <span />
            <span />
            <span />
          </button>
          <div className="app-status">{status}</div>
        </div>
      </div>

      <div className="tab-row">
        <NavButton label="Players" active={tab === "players"} onClick={() => goToTab("players")} />
        <NavButton label="Teams" active={tab === "rosters"} onClick={() => goToTab("rosters")} />
        <NavButton
          label="Evaluations"
          active={tab === "attendance"}
          onClick={() => goToTab("attendance")}
        />
        <NavButton label="Tryouts" active={tab === "door"} onClick={() => goToTab("door")} />
        <NavButton
          label="Roster Management"
          active={tab === "roster-management"}
          onClick={() => goToTab("roster-management")}
        />
        <NavButton
          label="Team Documents"
          active={tab === "documents"}
          onClick={() => goToTab("documents")}
        />
      </div>

      <div className={`mobile-menu-sheet ${isMobileMenuOpen ? "open" : ""}`}>
        <div className="mobile-menu-header">
          <div>
            <div className="panel-kicker">Navigation</div>
            <div className="mobile-menu-title">San Diego Soldiers</div>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            ×
          </button>
        </div>
        <div className="mobile-menu-list">
          <NavButton label="Players" active={tab === "players"} onClick={() => goToTab("players")} />
          <NavButton label="Teams" active={tab === "rosters"} onClick={() => goToTab("rosters")} />
          <NavButton
            label="Evaluations"
            active={tab === "attendance"}
            onClick={() => goToTab("attendance")}
          />
          <NavButton label="Tryouts" active={tab === "door"} onClick={() => goToTab("door")} />
          <NavButton
            label="Roster Management"
            active={tab === "roster-management"}
            onClick={() => goToTab("roster-management")}
          />
          <NavButton
            label="Team Documents"
            active={tab === "documents"}
            onClick={() => goToTab("documents")}
          />
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setIsMobileMenuOpen(false);
              setIsAboutOpen(true);
            }}
          >
            About
          </button>
          <div className="mobile-menu-counts">
            <div className="mobile-menu-counts-title">Player Counts</div>
            <div className="mobile-menu-count-card">
              <span>Total Players</span>
              <strong>{rosteredPlayers.length}</strong>
            </div>
            {gradeCounts.map((entry) => (
              <div key={entry.grade} className="mobile-menu-count-card">
                <span>{formatGradeLabel(entry.grade)}</span>
                <strong>{entry.count}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="mobile-menu-footer">Version {APP_VERSION}</div>
      </div>

      <div className="summary-row">
        <SummaryListCard
          title="Grade Counts"
          items={gradeCounts.map((entry) => ({
            label: formatGradeLabel(entry.grade),
            count: entry.count,
          }))}
        />
        <SummaryListCard
          title="Team Counts"
          items={teamStats.map((entry) => ({
            label: entry.team,
            count: entry.count,
          }))}
        />
        <div className="summary-card">
          <div className="summary-label">Total Players</div>
          <div className="summary-value">{rosteredPlayers.length}</div>
        </div>
      </div>

      {tab === "players" ? (
        <div className="players-page">
          <div className="card">
            <div className="card-header-row">
              <h2>Players</h2>
              <button
                type="button"
                className="primary-button"
                onClick={() => openRegistrationModal()}
              >
                New Registration
              </button>
            </div>

            <div className="toolbar-row">
              <input
                className="input"
                placeholder="Search any player detail"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="players-grid">
              {filteredPlayers.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  className="player-card"
                  onClick={() => setSelectedPlayerId(player.id)}
                  onDoubleClick={() => openEditModal(player)}
                >
                  <div className="player-card-header">
                    <PlayerPhoto
                      src={player.photo_url}
                      alt={`${player.first_name ?? ""} ${player.last_name ?? ""}`}
                    />
                    <div>
                      <div className="player-card-name">
                        {player.last_name}, {player.first_name}
                      </div>
                      <div className="player-card-meta">
                        {player.grade_group ?? "-"} | {formatGradeLabel(player.grade)}
                      </div>
                      <div className="player-card-meta">{player.school ?? "-"}</div>
                    </div>
                  </div>
                  <div className="player-card-meta">
                    Birthdate {formatBirthDate(player.birth_date)} | Age{" "}
                    {calculateAge(player.birth_date) ?? "-"} | Jersey #{player.jersey_number || "-"}
                  </div>
                  <div className="player-card-meta">Team: {player.suggested_team ?? "Undecided"}</div>
                  <div className="player-card-actions">
                    <button
                      type="button"
                      className="secondary-button player-card-action-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewingPlayerId(player.id);
                      }}
                    >
                      View Details
                    </button>
                  </div>
                </button>
              ))}
              {filteredPlayers.length === 0 && (
                <div className="empty-text">No players match the current filters.</div>
              )}
            </div>
          </div>
        </div>
      ) : tab === "attendance" ? (
        <div className="attendance-grid">
          <div className="card">
            <div className="card-header-row">
              <h2>Check-In</h2>
              <button
                type="button"
                className="primary-button"
                onClick={() => openRegistrationModal()}
              >
                New Registration
              </button>
            </div>

            <div className="toolbar-row">
              <input
                className="input"
                placeholder="Search any player detail"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
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
                    onDoubleClick={() => openEditModal(player)}
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
                        {player.grade_group} | {formatGradeLabel(player.grade)} | {player.school}
                      </div>
                      <div className="checkin-row-meta">
                        Jersey #{player.jersey_number || "-"} | Age{" "}
                        {calculateAge(player.birth_date) ?? "-"}
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
                      <div className="document-status-row compact">
                        <DocumentStatus
                          label="Birth Cert"
                          url={player.birth_certificate_url}
                        />
                        <DocumentStatus
                          label="Report Card"
                          url={player.report_card_url}
                        />
                      </div>
                      <button
                        type="button"
                        className="secondary-button mobile-card-action"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(player);
                        }}
                      >
                        Edit Player
                      </button>
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
                      {selectedPlayer.grade_group} | {formatGradeLabel(selectedPlayer.grade)}
                    </div>
                    <div className="player-meta">{selectedPlayer.school}</div>
                    <div className="player-meta">
                      Jersey #{selectedPlayer.jersey_number || "-"} | Birthdate{" "}
                      {formatBirthDate(selectedPlayer.birth_date)} | Age{" "}
                      {calculateAge(selectedPlayer.birth_date) ?? "-"}
                    </div>

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
                    <strong>Birth Certificate:</strong>
                    <span className="detail-inline-status">
                      <DocumentStatus
                        label="On File"
                        url={selectedPlayer.birth_certificate_url}
                      />
                    </span>
                  </div>
                  <div className="detail-line">
                    <strong>Report Card:</strong>
                    <span className="detail-inline-status">
                      <DocumentStatus
                        label="On File"
                        url={selectedPlayer.report_card_url}
                      />
                    </span>
                  </div>
                  <div className="detail-line">
                    <strong>Player Cell:</strong>{" "}
                    <ContactLink type="phone" value={selectedPlayer.player_phone} />
                  </div>
                  <div className="detail-line">
                    <strong>Player Email:</strong>{" "}
                    <ContactLink type="email" value={selectedPlayer.player_email} />
                  </div>
                  <div className="detail-line">
                    <strong>Uniform Size:</strong> {selectedPlayer.uniform_size || "-"}
                  </div>
                  <div className="detail-line">
                    <strong>Guardian #1:</strong> {selectedPlayer.guardian_1_name || "-"}
                  </div>
                  <div className="detail-line">
                    <strong>Guardian #1 Phone:</strong>{" "}
                    <ContactLink type="phone" value={getGuardian1Phone(selectedPlayer)} />
                  </div>
                  <div className="detail-line">
                    <strong>Guardian #1 Email:</strong>{" "}
                    <ContactLink type="email" value={getGuardian1Email(selectedPlayer)} />
                  </div>
                  <div className="detail-line">
                    <strong>Guardian #2:</strong> {selectedPlayer.guardian_2_name || "-"}
                  </div>
                  <div className="detail-line">
                    <strong>Guardian #2 Phone:</strong>{" "}
                    <ContactLink type="phone" value={selectedPlayer.guardian_2_phone ?? null} />
                  </div>
                  <div className="detail-line">
                    <strong>Guardian #2 Email:</strong>{" "}
                    <ContactLink type="email" value={selectedPlayer.guardian_2_email ?? null} />
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
          <div className="summary-row tryout-summary-row">
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

          <div className="card">
            <div className="card-header-row">
              <h2>Tryout Check-In</h2>
              <button
                type="button"
                className="primary-button"
                onClick={() => openRegistrationModal()}
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
                        {player.grade_group} | {formatGradeLabel(player.grade)} | {player.school}
                      </div>
                      <div className="door-meta">
                        Jersey #{player.jersey_number || "-"} | Age{" "}
                        {calculateAge(player.birth_date) ?? "-"}
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
      ) : tab === "rosters" ? (
        <div className="rosters-page">
          <div className="rosters-toolbar">
            <h2 className="roster-title">Teams</h2>
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
              </div>
            ))}
          </div>

          <div className="card roster-focus-card">
            <div className="card-header-row">
              <h3>{activeRosterTeam} Roster</h3>
              <select
                className="select roster-team-select"
                value={activeRosterTeam}
                onChange={(e) => setActiveRosterTeam(e.target.value as TeamOption)}
              >
                {TEAM_OPTIONS.map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
            </div>

            <div className="roster-focus-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => openRegistrationModal(activeRosterTeam)}
              >
                Add New Player To {activeRosterTeam}
              </button>
              <select
                className="select"
                value={rosterAddPlayerId}
                onChange={(e) => setRosterAddPlayerId(e.target.value)}
              >
                <option value="">Add existing player to this roster</option>
                {rosterAssignablePlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.last_name}, {player.first_name} ({player.suggested_team ?? "Undecided"})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="primary-button"
                onClick={addPlayerToRoster}
              >
                Add To {activeRosterTeam}
              </button>
            </div>

            <div className="roster-focus-summary">
              <span>Players: {activeRosterPlayers.length}</span>
              <span>
                Checked In: {activeRosterPlayers.filter((player) => player.checked_in).length}
              </span>
              <span>
                Evaluated:{" "}
                {activeRosterPlayers.filter((player) => latestEvalMap.has(player.id)).length}
              </span>
            </div>

            <div className="roster-focus-list">
              {activeRosterPlayers.length === 0 ? (
                <div className="empty-text">No players assigned to this roster yet.</div>
              ) : (
                activeRosterPlayers.map((player) => (
                  <div key={player.id} className="roster-player-card roster-player-card-wide">
                    <div className="roster-player-top">
                      <PlayerPhoto
                        src={player.photo_url}
                        alt={`${player.first_name ?? ""} ${player.last_name ?? ""}`}
                      />
                      <div>
                        <div className="roster-player-name">
                          {player.last_name}, {player.first_name}
                        </div>
                        <div className="roster-player-meta">
                          {formatGradeLabel(player.grade)} | Birthdate {formatBirthDate(player.birth_date)} | Jersey #{player.jersey_number || "-"}
                        </div>
                      </div>
                    </div>
                    <div className="document-status-row compact">
                      <DocumentStatus
                        label="Birth Cert"
                        url={player.birth_certificate_url}
                      />
                      <DocumentStatus
                        label="Report Card"
                        url={player.report_card_url}
                      />
                    </div>
                    <div className="roster-team-move-row">
                      <select
                        className="select"
                        value={getMobileRosterTarget(player)}
                        onChange={(e) =>
                          setMobileRosterTargets((prev) => ({
                            ...prev,
                            [player.id]: e.target.value as TeamOption,
                          }))
                        }
                      >
                        {TEAM_OPTIONS.map((team) => (
                          <option key={team} value={team}>
                            {team}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => movePlayerFromMobile(player)}
                      >
                        Move
                      </button>
                    </div>
                    <div className="roster-card-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setViewingPlayerId(player.id)}
                      >
                        View
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => openEditModal(player)}
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="roster-grid">
            {TEAM_OPTIONS.filter((team) => team !== "Undecided").map((team) => (
              <div
                key={team}
                className="card roster-summary-card"
              >
                <button
                  type="button"
                  className="roster-team-title roster-team-title-button"
                  onClick={() => setModalRosterTeam(team)}
                  onDoubleClick={() => setModalRosterTeam(team)}
                >
                  {team}
                </button>
                <div className="roster-count">
                  Count: {rosterGroups[team].length}
                </div>

                <div className="roster-list">
                  {rosterGroups[team].length === 0 ? (
                    <div className="empty-text">No players assigned.</div>
                  ) : (
                    rosterGroups[team].map((player) => (
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
                            <div className="roster-player-meta">
                              {formatGradeLabel(player.grade)} | Birthdate {formatBirthDate(player.birth_date)} | Jersey #{player.jersey_number || "-"}
                            </div>
                          </div>
                        </div>
                        <div className="roster-team-move-row">
                          <select
                            className="select"
                            value={getMobileRosterTarget(player)}
                            onChange={(e) =>
                              setMobileRosterTargets((prev) => ({
                                ...prev,
                                [player.id]: e.target.value as TeamOption,
                              }))
                            }
                          >
                            {TEAM_OPTIONS.map((optionTeam) => (
                              <option key={optionTeam} value={optionTeam}>
                                {optionTeam}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => movePlayerFromMobile(player)}
                          >
                            Move
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : tab === "roster-management" ? (
        <div className="roster-management-shell">
          <div className="card roster-template-tools-card">
            <div className="card-header-row">
              <div>
                <div className="panel-kicker">Template Tools</div>
                <h2 className="panel-title">Roster Templates</h2>
              </div>
              <div className="empty-text">Download a template or upload a completed roster CSV.</div>
            </div>

            <div className="roster-import-tools">
              <input
                className="input"
                placeholder="Roster template name"
                value={rosterTemplateName}
                onChange={(e) => setRosterTemplateName(e.target.value)}
              />
              <button
                type="button"
                className="secondary-button"
                onClick={downloadRosterImportTemplate}
              >
                Download Upload Template
              </button>
              <input
                className="input"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setRosterImportFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                className="primary-button"
                onClick={importRosterTemplate}
              >
                Upload Template
              </button>
            </div>
          </div>

          <div className="roster-management-page">
            <div className="card roster-management-pool">
              <div className="card-header-row">
                <div>
                  <div className="panel-kicker">Roster Control</div>
                  <h2 className="panel-title">Player Pool</h2>
                </div>
                <div className="empty-text">Drag a player onto a team.</div>
              </div>

              <input
                className="input"
                placeholder="Search players on the left"
                value={rosterManagementSearch}
                onChange={(e) => setRosterManagementSearch(e.target.value)}
              />

              <div className="roster-management-left-scroll">
                <div
                  className="roster-drop-zone roster-drop-zone-pool"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleRosterDrop("Undecided")}
                >
                  <div className="roster-drop-zone-title">Unassigned / Available</div>
                  <div className="roster-management-list">
                    {rosterManagementFilteredPlayers
                      .filter((player) => (player.suggested_team ?? "Undecided") === "Undecided")
                      .map((player) => (
                        <div
                          key={player.id}
                          className="roster-management-card"
                          draggable
                          onDragStart={() => setDraggedPlayerId(player.id)}
                          onDragEnd={() => setDraggedPlayerId(null)}
                          onDoubleClick={() => openEditModal(player)}
                        >
                          <div className="roster-management-name">
                            {player.last_name}, {player.first_name}
                          </div>
                          <div className="roster-management-meta">
                            {player.grade_group ?? "-"} | {formatGradeLabel(player.grade)} | #{player.jersey_number || "-"}
                          </div>
                          <div className="mobile-roster-assignment">
                            <select
                              className="select mobile-roster-select"
                              value={getMobileRosterTarget(player)}
                              onChange={(e) =>
                                setMobileRosterTargets((prev) => ({
                                  ...prev,
                                  [player.id]: e.target.value as TeamOption,
                                }))
                              }
                            >
                              {TEAM_OPTIONS.map((team) => (
                                <option key={team} value={team}>
                                  {team}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="secondary-button mobile-roster-move"
                              onClick={() => movePlayerFromMobile(player)}
                            >
                              Move
                            </button>
                          </div>
                        </div>
                      ))}
                    {rosterManagementFilteredPlayers.filter(
                      (player) => (player.suggested_team ?? "Undecided") === "Undecided"
                    ).length === 0 && (
                      <div className="empty-text">No unassigned players.</div>
                    )}
                  </div>
                </div>

                <div className="roster-management-list">
                  {rosterManagementFilteredPlayers
                    .filter((player) => (player.suggested_team ?? "Undecided") !== "Undecided")
                    .map((player) => (
                      <div
                        key={player.id}
                        className="roster-management-card"
                        draggable
                        onDragStart={() => setDraggedPlayerId(player.id)}
                        onDragEnd={() => setDraggedPlayerId(null)}
                        onDoubleClick={() => openEditModal(player)}
                      >
                        <div className="roster-management-name">
                          {player.last_name}, {player.first_name}
                        </div>
                        <div className="roster-management-meta">
                          {player.suggested_team ?? "Undecided"} | {formatGradeLabel(player.grade)} | #{player.jersey_number || "-"}
                        </div>
                        <div className="mobile-roster-assignment">
                          <select
                            className="select mobile-roster-select"
                            value={getMobileRosterTarget(player)}
                            onChange={(e) =>
                              setMobileRosterTargets((prev) => ({
                                ...prev,
                                [player.id]: e.target.value as TeamOption,
                              }))
                            }
                          >
                            {TEAM_OPTIONS.map((team) => (
                              <option key={team} value={team}>
                                {team}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="secondary-button mobile-roster-move"
                            onClick={() => movePlayerFromMobile(player)}
                          >
                            Move
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header-row">
                <div>
                  <div className="panel-kicker">Drag And Drop</div>
                  <h2 className="panel-title">Team Boards</h2>
                </div>
                <div className="empty-text">Drop players onto a roster to move them.</div>
              </div>

              <div className="roster-management-grid">
                {TEAM_OPTIONS.filter((team) => team !== "Undecided").map((team) => (
                  <div
                    key={team}
                    className="roster-drop-zone"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleRosterDrop(team)}
                  >
                    <div className="roster-drop-zone-title">
                      {team} ({rosterGroups[team].length})
                    </div>
                    <div className="roster-management-list">
                      {rosterGroups[team].map((player) => (
                        <div
                          key={player.id}
                          className="roster-management-card"
                          draggable
                          onDragStart={() => setDraggedPlayerId(player.id)}
                          onDragEnd={() => setDraggedPlayerId(null)}
                          onDoubleClick={() => openEditModal(player)}
                        >
                          <div className="roster-management-name">
                            {player.last_name}, {player.first_name}
                          </div>
                          <div className="roster-management-meta">
                            {formatGradeLabel(player.grade)} | #{player.jersey_number || "-"} | {player.school ?? "-"}
                          </div>
                          <div className="mobile-roster-assignment">
                            <select
                              className="select mobile-roster-select"
                              value={getMobileRosterTarget(player)}
                              onChange={(e) =>
                                setMobileRosterTargets((prev) => ({
                                  ...prev,
                                  [player.id]: e.target.value as TeamOption,
                                }))
                              }
                            >
                              {TEAM_OPTIONS.map((optionTeam) => (
                                <option key={optionTeam} value={optionTeam}>
                                  {optionTeam}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="secondary-button mobile-roster-move"
                              onClick={() => movePlayerFromMobile(player)}
                            >
                              Move
                            </button>
                          </div>
                        </div>
                      ))}
                      {rosterGroups[team].length === 0 && (
                        <div className="empty-text">Drop players here.</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="documents-page">
          <div className="card documents-upload-card">
            <div className="card-header-row">
              <h2>Team Documents</h2>
              <div className="empty-text">
                Upload organization-wide files like insurance, agreements, and receipts.
              </div>
            </div>

            <form onSubmit={uploadManagementDoc} className="form-stack">
              <FormFieldRow label="Document Title">
                <input
                  className="input"
                  value={managementDocumentTitle}
                  onChange={(e) => setManagementDocumentTitle(e.target.value)}
                  placeholder="Insurance Certificate 2026"
                />
              </FormFieldRow>
              <FormFieldRow label="Category">
                <select
                  className="select"
                  value={managementDocumentCategory}
                  onChange={(e) =>
                    setManagementDocumentCategory(
                      e.target.value as ManagementDocumentCategory
                    )
                  }
                >
                  {MANAGEMENT_DOCUMENT_CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </FormFieldRow>
              <FormFieldRow label="File">
                <input
                  className="input"
                  type="file"
                  accept=".pdf,image/*,.doc,.docx,.xls,.xlsx"
                  onChange={(e) =>
                    setManagementDocumentFile(e.target.files?.[0] ?? null)
                  }
                />
              </FormFieldRow>

              <div className="edit-actions">
                <button type="submit" className="primary-button">
                  Upload Document
                </button>
              </div>
            </form>
          </div>

          <div className="card">
            <div className="card-header-row">
              <h2>Library</h2>
              <button
                type="button"
                className="secondary-button"
                onClick={loadManagementDocuments}
              >
                Refresh
              </button>
            </div>

            <div className="documents-grid">
              {managementDocuments.length === 0 ? (
                <div className="empty-text">No team documents uploaded yet.</div>
              ) : (
                managementDocuments.map((document) => (
                  <div key={document.path} className="document-library-card">
                    <div className="document-library-title">{document.title}</div>
                    <div className="document-library-meta">
                      Category: {document.category || "Other"}
                    </div>
                    <div className="document-library-meta">
                      Uploaded: {document.createdAtLabel}
                    </div>
                    <div className="document-library-meta">{document.name}</div>
                    <div className="document-library-actions">
                      <a
                        href={document.url}
                        target="_blank"
                        rel="noreferrer"
                        className="secondary-button document-action-link"
                      >
                        Open
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
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
              <DocumentPicker
                label="Birth Certificate"
                onFileReady={(file) => setRegistrationBirthCertificateFile(file)}
              />
              <DocumentPicker
                label="Report Card"
                onFileReady={(file) => setRegistrationReportCardFile(file)}
              />

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
                placeholder="Jersey Number"
                value={form.jersey_number}
                onChange={(e) =>
                  setForm({ ...form, jersey_number: e.target.value })
                }
              />
              <select
                className="select"
                value={form.suggested_team}
                onChange={(e) =>
                  setForm({ ...form, suggested_team: e.target.value as TeamOption })
                }
              >
                {TEAM_OPTIONS.map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
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
                placeholder="Player Email"
                value={form.player_email}
                onChange={(e) =>
                  setForm({ ...form, player_email: e.target.value })
                }
              />
              <input
                className="input"
                placeholder="Uniform Size"
                value={form.uniform_size}
                onChange={(e) =>
                  setForm({ ...form, uniform_size: e.target.value })
                }
              />
              <input
                className="input"
                placeholder="Guardian #1 Name"
                value={form.guardian_1_name}
                onChange={(e) =>
                  setForm({ ...form, guardian_1_name: e.target.value })
                }
              />
              <input
                className="input"
                placeholder="Guardian #1 Phone"
                value={form.guardian_1_phone}
                onChange={(e) =>
                  setForm({ ...form, guardian_1_phone: e.target.value })
                }
              />
              <input
                className="input"
                placeholder="Guardian #1 Email"
                value={form.guardian_1_email}
                onChange={(e) =>
                  setForm({ ...form, guardian_1_email: e.target.value })
                }
              />
              <input
                className="input"
                placeholder="Guardian #2 Name"
                value={form.guardian_2_name}
                onChange={(e) =>
                  setForm({ ...form, guardian_2_name: e.target.value })
                }
              />
              <input
                className="input"
                placeholder="Guardian #2 Phone"
                value={form.guardian_2_phone}
                onChange={(e) =>
                  setForm({ ...form, guardian_2_phone: e.target.value })
                }
              />
              <input
                className="input"
                placeholder="Guardian #2 Email"
                value={form.guardian_2_email}
                onChange={(e) =>
                  setForm({ ...form, guardian_2_email: e.target.value })
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

      {viewingPlayer && (
        <div className="modal-overlay" onClick={() => setViewingPlayerId(null)}>
          <div className="modal-card modal-card-narrow" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Player Details</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setViewingPlayerId(null)}
              >
                Ã—
              </button>
            </div>

            <div className="player-details-modal">
              <div className="selected-player-top player-details-hero">
                <PlayerPhoto
                  src={viewingPlayer.photo_url}
                  alt={`${viewingPlayer.first_name ?? ""} ${viewingPlayer.last_name ?? ""}`}
                  large
                />
                <div className="selected-player-info">
                  <div className="player-name">
                    {viewingPlayer.last_name}, {viewingPlayer.first_name}
                  </div>
                  <div className="player-meta">
                    {viewingPlayer.grade_group ?? "-"} | {formatGradeLabel(viewingPlayer.grade)}
                  </div>
                  <div className="player-meta">{viewingPlayer.school ?? "-"}</div>
                  <div className="player-meta">
                    Jersey #{viewingPlayer.jersey_number || "-"} | Birthdate{" "}
                    {formatBirthDate(viewingPlayer.birth_date)} | Age{" "}
                    {calculateAge(viewingPlayer.birth_date) ?? "-"}
                  </div>
                  <div className="badge-row">
                    <span
                      className={`badge ${
                        viewingPlayer.checked_in ? "badge-good" : "badge-neutral"
                      }`}
                    >
                      {viewingPlayer.checked_in ? "Checked In" : "Not Checked In"}
                    </span>
                    <span className="badge badge-team">
                      {viewingPlayer.suggested_team ?? "Undecided"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="player-quick-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    setViewingPlayerId(null);
                    setSelectedPlayerId(viewingPlayer.id);
                    setTab("attendance");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  Open Full Profile
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setViewingPlayerId(null);
                    openEditModal(viewingPlayer);
                  }}
                >
                  Edit Player
                </button>
              </div>

              <div className="player-detail-section">
                <div className="player-detail-section-title">Player Contact</div>
                <div className="player-detail-grid">
                  <PlayerDetailItem
                    label="Player Cell"
                    value={<ContactLink type="phone" value={viewingPlayer.player_phone} />}
                  />
                  <PlayerDetailItem
                    label="Player Email"
                    value={<ContactLink type="email" value={viewingPlayer.player_email} />}
                  />
                  <PlayerDetailItem
                    label="Uniform Size"
                    value={viewingPlayer.uniform_size || "-"}
                  />
                  <PlayerDetailItem
                    label="School"
                    value={viewingPlayer.school || "-"}
                  />
                </div>
              </div>

              <div className="player-detail-section">
                <div className="player-detail-section-title">Guardian Contacts</div>
                <div className="player-detail-grid">
                  <PlayerDetailItem
                    label="Guardian #1"
                    value={viewingPlayer.guardian_1_name || "-"}
                  />
                  <PlayerDetailItem
                    label="Guardian #1 Phone"
                    value={<ContactLink type="phone" value={getGuardian1Phone(viewingPlayer)} />}
                  />
                  <PlayerDetailItem
                    label="Guardian #1 Email"
                    value={<ContactLink type="email" value={getGuardian1Email(viewingPlayer)} />}
                  />
                  <PlayerDetailItem
                    label="Guardian #2"
                    value={viewingPlayer.guardian_2_name || "-"}
                  />
                  <PlayerDetailItem
                    label="Guardian #2 Phone"
                    value={<ContactLink type="phone" value={viewingPlayer.guardian_2_phone ?? null} />}
                  />
                  <PlayerDetailItem
                    label="Guardian #2 Email"
                    value={<ContactLink type="email" value={viewingPlayer.guardian_2_email ?? null} />}
                  />
                </div>
              </div>

              <div className="player-detail-section">
                <div className="player-detail-section-title">Documents And Notes</div>
                <div className="document-status-row">
                  <DocumentStatus
                    label="Birth Certificate"
                    url={viewingPlayer.birth_certificate_url}
                  />
                  <DocumentStatus
                    label="Report Card"
                    url={viewingPlayer.report_card_url}
                  />
                </div>
                <PlayerDetailItem label="Notes" value={viewingPlayer.notes || "-"} />
              </div>

              <button
                type="button"
                className="secondary-button"
                onClick={() => setViewingPlayerId(null)}
              >
                Close
              </button>
            </div>
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
              <DocumentPicker
                label="Birth Certificate"
                onFileReady={(file) => setEditBirthCertificateFile(file)}
                currentUrl={
                  players.find((p) => p.id === editingPlayerId)?.birth_certificate_url
                }
              />
              <DocumentPicker
                label="Report Card"
                onFileReady={(file) => setEditReportCardFile(file)}
                currentUrl={
                  players.find((p) => p.id === editingPlayerId)?.report_card_url
                }
              />

              <FormFieldRow label="First Name">
                <input
                  className="input"
                  value={editForm.first_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, first_name: e.target.value })
                  }
                />
              </FormFieldRow>
              <FormFieldRow label="Last Name">
                <input
                  className="input"
                  value={editForm.last_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, last_name: e.target.value })
                  }
                />
              </FormFieldRow>
              <FormFieldRow label="Grade">
                <input
                  className="input"
                  value={editForm.grade}
                  onChange={(e) =>
                    setEditForm({ ...editForm, grade: e.target.value })
                  }
                />
              </FormFieldRow>
              <FormFieldRow label="School">
                <input
                  className="input"
                  value={editForm.school}
                  onChange={(e) =>
                    setEditForm({ ...editForm, school: e.target.value })
                  }
                />
              </FormFieldRow>
              <FormFieldRow label="Birthdate">
                <input
                  className="input"
                  type="date"
                  value={editForm.birth_date}
                  onChange={(e) =>
                    setEditForm({ ...editForm, birth_date: e.target.value })
                  }
                />
              </FormFieldRow>
              <FormFieldRow label="Jersey Number">
                <input
                  className="input"
                  value={editForm.jersey_number}
                  onChange={(e) =>
                    setEditForm({ ...editForm, jersey_number: e.target.value })
                  }
                />
              </FormFieldRow>
              <FormFieldRow label="Team">
                <select
                  className="select"
                  value={editForm.suggested_team}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
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
              </FormFieldRow>
              <FormFieldRow label="Player Cell">
                <input
                  className="input"
                  value={editForm.player_phone}
                  onChange={(e) =>
                    setEditForm({ ...editForm, player_phone: e.target.value })
                  }
                />
              </FormFieldRow>
              <FormFieldRow label="Player Email">
                <input
                  className="input"
                  value={editForm.player_email}
                  onChange={(e) =>
                    setEditForm({ ...editForm, player_email: e.target.value })
                  }
                />
              </FormFieldRow>
              <FormFieldRow label="Uniform Size">
                <input
                  className="input"
                  value={editForm.uniform_size}
                  onChange={(e) =>
                    setEditForm({ ...editForm, uniform_size: e.target.value })
                  }
                />
              </FormFieldRow>
              <FormFieldRow label="Guardian #1 Name">
                <input
                  className="input"
                  value={editForm.guardian_1_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, guardian_1_name: e.target.value })
                  }
                />
              </FormFieldRow>
              <FormFieldRow label="Guardian #1 Phone">
                <input
                  className="input"
                  value={editForm.guardian_1_phone}
                  onChange={(e) =>
                    setEditForm({ ...editForm, guardian_1_phone: e.target.value })
                  }
                />
              </FormFieldRow>
              <FormFieldRow label="Guardian #1 Email">
                <input
                  className="input"
                  value={editForm.guardian_1_email}
                  onChange={(e) =>
                    setEditForm({ ...editForm, guardian_1_email: e.target.value })
                  }
                />
              </FormFieldRow>
              <FormFieldRow label="Guardian #2 Name">
                <input
                  className="input"
                  value={editForm.guardian_2_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, guardian_2_name: e.target.value })
                  }
                />
              </FormFieldRow>
              <FormFieldRow label="Guardian #2 Phone">
                <input
                  className="input"
                  value={editForm.guardian_2_phone}
                  onChange={(e) =>
                    setEditForm({ ...editForm, guardian_2_phone: e.target.value })
                  }
                />
              </FormFieldRow>
              <FormFieldRow label="Guardian #2 Email">
                <input
                  className="input"
                  value={editForm.guardian_2_email}
                  onChange={(e) =>
                    setEditForm({ ...editForm, guardian_2_email: e.target.value })
                  }
                />
              </FormFieldRow>
              <FormFieldRow label="Notes">
                <textarea
                  className="textarea"
                  value={editForm.notes}
                  onChange={(e) =>
                    setEditForm({ ...editForm, notes: e.target.value })
                  }
                />
              </FormFieldRow>

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

      {isAboutOpen && (
        <div className="modal-overlay" onClick={() => setIsAboutOpen(false)}>
          <div className="modal-card modal-card-narrow" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>About</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setIsAboutOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="about-stack">
              <div className="detail-line">
                <strong>App:</strong> San Diego Soldiers Management Tool
              </div>
              <div className="detail-line">
                <strong>Current Version:</strong> {APP_VERSION}
              </div>
              <div className="detail-line">
                <strong>Developer:</strong> Robret J. Rush, Jr.
              </div>
              <div className="version-history">
                <div className="version-history-title">Version History</div>
                {VERSION_HISTORY.map((release) => (
                  <div key={release.version} className="version-history-card">
                    <div className="version-history-header">
                      <strong>{release.version}</strong>
                      <span>{release.date}</span>
                    </div>
                    <div className="version-history-notes">{release.notes}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {modalRosterTeam && (
        <div className="modal-overlay" onClick={() => setModalRosterTeam(null)}>
          <div className="modal-card modal-card-wide roster-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modalRosterTeam} Roster</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setModalRosterTeam(null)}
              >
                ×
              </button>
            </div>

            <div className="roster-modal-list">
              {rosterGroups[modalRosterTeam].length === 0 ? (
                <div className="empty-text">No players assigned.</div>
              ) : (
                rosterGroups[modalRosterTeam].map((player) => (
                  <div key={player.id} className="roster-modal-row">
                    <div className="roster-modal-name roster-modal-cell">
                      {player.last_name}, {player.first_name}
                    </div>
                    <div className="roster-modal-meta roster-modal-cell">
                      Jersey #{player.jersey_number || "-"}
                    </div>
                    <div className="roster-modal-meta roster-modal-cell">
                      Birthdate {formatBirthDate(player.birth_date)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {mobileTabItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`mobile-bottom-nav-button ${tab === item.key ? "active" : ""}`}
            onClick={() => goToTab(item.key)}
          >
            <span className="mobile-bottom-nav-label">{item.shortLabel}</span>
          </button>
        ))}
      </nav>
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

