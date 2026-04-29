import { format, differenceInMinutes } from "date-fns";
import { de } from "date-fns/locale";
import { STAMP_IN_TYPES, STAMP_OUT_TYPE } from "@/lib/stamp-types";
import { REQUEST_TYPES } from "@/lib/request-types";

interface ActorInfo {
  id: string;
  name: string;
  employeeNumber: string | null;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  targetUserId: string | null;
  actor: ActorInfo;
  target: ActorInfo | null;
  action: string;
  resource: string;
  resourceId: string;
  oldValue: unknown;
  newValue: unknown;
  createdAt: string;
}

type Dict = Record<string, unknown>;

function asObject(v: unknown): Dict | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Dict) : null;
}

function fmtTime(v: unknown): string {
  if (typeof v !== "string") return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : format(d, "HH:mm", { locale: de });
}

function fmtDate(v: unknown): string {
  if (typeof v !== "string") return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : format(d, "dd.MM.yyyy", { locale: de });
}

function fmtDuration(fromIso: unknown, toIso: unknown): string {
  if (typeof fromIso !== "string" || typeof toIso !== "string") return "—";
  const a = new Date(fromIso);
  const b = new Date(toIso);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return "—";
  const mins = Math.max(0, differenceInMinutes(b, a));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${String(m).padStart(2, "0")}min`;
}

function typeLabel(type: unknown): string {
  if (type === STAMP_OUT_TYPE) return "Ausstempeln";
  if (typeof type === "string" && type in STAMP_IN_TYPES) {
    return STAMP_IN_TYPES[type as keyof typeof STAMP_IN_TYPES].label;
  }
  if (typeof type === "string" && type in REQUEST_TYPES) {
    return REQUEST_TYPES[type as keyof typeof REQUEST_TYPES].label;
  }
  return typeof type === "string" ? type : "—";
}

function requestTypeLabel(type: unknown): string {
  if (typeof type === "string" && type in REQUEST_TYPES) {
    return REQUEST_TYPES[type as keyof typeof REQUEST_TYPES].label;
  }
  const MAP: Record<string, string> = {
    CANCEL_VACATION: "Stornierungsantrag",
    OVERTIME: "Überstundenantrag",
    MISSING_ENTRY: "Nachtragung",
    TIME_CORRECTION: "Zeitkorrektur",
  };
  if (typeof type === "string" && MAP[type]) return MAP[type];
  return typeof type === "string" ? type : "Antrag";
}

function settingLabel(group: string): string {
  const MAP: Record<string, string> = {
    workday: "Arbeitszeit",
    vacation: "Urlaub & Homeoffice",
    approval: "Genehmigung",
    stamp: "Stempel",
    notify: "Benachrichtigungen",
    security: "Sicherheit",
    branding: "Branding",
    holidays: "Feiertage",
    organization: "Organisation",
    datev: "DATEV",
    surcharge: "Zuschläge",
    smtp: "SMTP",
    homeoffice: "Homeoffice",
  };
  return MAP[group] ?? group;
}

function diffFields(
  oldV: Dict,
  newV: Dict,
  fields: Array<{ key: string; label: string; format?: (v: unknown) => string }>
): string[] {
  const out: string[] = [];
  for (const f of fields) {
    const fmt = f.format ?? ((v) => (v == null ? "—" : String(v)));
    const oldStr = fmt(oldV[f.key]);
    const newStr = fmt(newV[f.key]);
    // Only show when the field was actually touched (new value present AND differs)
    if (!(f.key in newV)) continue;
    if (oldStr === newStr) continue;
    out.push(`${f.label}: ${oldStr} → ${newStr}`);
  }
  return out;
}

export interface FormattedEntry {
  headline: string;
  details: string[];
}

/**
 * Render an audit-log entry into a fully readable German sentence plus an
 * optional list of field-level diffs. Nothing is left as raw JSON.
 */
export function formatAuditEntry(log: AuditLogEntry): FormattedEntry {
  const actorName = log.actor.name;
  const targetName = log.target?.name ?? "Mitarbeiter";
  const oldV = asObject(log.oldValue) ?? {};
  const newV = asObject(log.newValue) ?? {};

  switch (log.action) {
    case "STAMP_IN": {
      const time = fmtTime(newV.clockIn);
      const t = typeLabel(newV.type);
      return {
        headline: `${actorName} hat um ${time} Uhr eingestempelt`,
        details: [`Stempelart: ${t}`],
      };
    }

    case "STAMP_OUT": {
      const out = fmtTime(newV.clockOut);
      const dur = fmtDuration(newV.clockIn, newV.clockOut);
      const t = typeLabel(newV.type);
      return {
        headline: `${actorName} hat um ${out} Uhr ausgestempelt`,
        details: [
          `Stempelart: ${t}`,
          `Arbeitszeit: ${dur}`,
          `Eingestempelt um: ${fmtTime(newV.clockIn)} Uhr`,
        ],
      };
    }

    case "AUTO_CLOCKOUT": {
      const cutoff = typeof newV.cutoff === "string" ? newV.cutoff : "";
      const dur = fmtDuration(oldV.clockIn, newV.clockOut);
      return {
        headline: `${targetName} wurde vom System automatisch ausgestempelt${cutoff ? ` um ${cutoff} Uhr` : ""}`,
        details: [
          `Eingestempelt war: ${fmtTime(oldV.clockIn)} Uhr`,
          `Gezählte Arbeitszeit: ${dur}`,
          `Stempelart: ${typeLabel(oldV.type)}`,
        ],
      };
    }

    case "DIRECT_EDIT": {
      const date = fmtDate(oldV.clockIn);
      const changes = diffFields(oldV, newV, [
        { key: "type", label: "Stempelart", format: typeLabel },
        { key: "clockIn", label: "Kommen", format: fmtTime },
        { key: "clockOut", label: "Gehen", format: fmtTime },
      ]);
      return {
        headline: `${actorName} hat eigenen Zeiteintrag vom ${date} korrigiert`,
        details: changes.length > 0 ? changes : ["Keine Änderung erkannt"],
      };
    }

    case "HR_CORRECTION": {
      const date = fmtDate(oldV.clockIn);
      const changes = diffFields(oldV, newV, [
        { key: "type", label: "Stempelart", format: typeLabel },
        { key: "clockIn", label: "Kommen", format: fmtTime },
        { key: "clockOut", label: "Gehen", format: fmtTime },
        { key: "note", label: "Notiz" },
      ]);
      return {
        headline: `${actorName} hat Zeiteintrag von ${targetName} vom ${date} korrigiert`,
        details: changes.length > 0 ? changes : ["Keine Änderung erkannt"],
      };
    }

    case "HR_DELETE": {
      const date = fmtDate(oldV.clockIn);
      return {
        headline: `${actorName} hat Zeiteintrag von ${targetName} vom ${date} gelöscht`,
        details: [
          `Stempelart war: ${typeLabel(oldV.type)}`,
          `Zeitraum: ${fmtTime(oldV.clockIn)} – ${fmtTime(oldV.clockOut)} Uhr`,
        ],
      };
    }

    case "APPROVE":
    case "REJECT": {
      const label = requestTypeLabel(oldV.type);
      const action = log.action === "APPROVE" ? "genehmigt" : "abgelehnt";
      const details: string[] = [];
      if (typeof newV.comment === "string" && newV.comment.trim()) {
        details.push(`Kommentar: „${newV.comment.trim()}"`);
      }
      return {
        headline: `${actorName} hat ${label} von ${targetName} ${action}`,
        details,
      };
    }

    case "UPDATE":
      if (log.resource === "User") {
        const changes = diffFields(oldV, newV, [
          { key: "name", label: "Name" },
          { key: "email", label: "E-Mail" },
          { key: "departmentId", label: "Abteilung" },
          { key: "managerId", label: "Vorgesetzter" },
          { key: "deputyId", label: "Stellvertreter" },
          { key: "contractType", label: "Vertragsart" },
          { key: "isActive", label: "Aktiv", format: (v) => (v ? "Ja" : "Nein") },
          { key: "startDate", label: "Eintrittsdatum", format: (v) => typeof v === "string" ? fmtDate(v) : "—" },
          { key: "initialBalance", label: "Anfangssaldo (h)" },
        ]);
        const pwReset = newV.passwordReset === true;
        if (pwReset) changes.unshift("Passwort zurückgesetzt");
        return {
          headline: `${actorName} hat Profil von ${targetName} geändert`,
          details: changes.length > 0 ? changes : ["Keine inhaltliche Änderung"],
        };
      }
      if (log.resource === "Role") {
        return {
          headline: `${actorName} hat Rolle "${(oldV.name as string) ?? "?"}" geändert`,
          details: diffRoleBlock(oldV, newV),
        };
      }
      return {
        headline: `${actorName} hat ${log.resource} geändert`,
        details: [],
      };

    case "CREATE":
      if (log.resource === "Role") {
        const perms = Array.isArray(newV.permissions) ? newV.permissions : [];
        return {
          headline: `${actorName} hat Rolle "${(newV.name as string) ?? "?"}" erstellt`,
          details: [`${perms.length} Berechtigung${perms.length === 1 ? "" : "en"} zugewiesen`],
        };
      }
      return {
        headline: `${actorName} hat ${log.resource} erstellt`,
        details: [],
      };

    case "DELETE":
      if (log.resource === "Role") {
        return {
          headline: `${actorName} hat Rolle "${(oldV.name as string) ?? "?"}" gelöscht`,
          details: [],
        };
      }
      return {
        headline: `${actorName} hat ${log.resource} gelöscht`,
        details: [],
      };

    case "UPDATE_SETTINGS": {
      const keys = Object.keys(newV);
      return {
        headline: `${actorName} hat Einstellungen in "${settingLabel(log.resourceId)}" geändert`,
        details: keys.length > 0
          ? keys.map((k) => `${k.replace(`${log.resourceId}.`, "")}: ${String(newV[k])}`)
          : ["Keine Felder geändert"],
      };
    }

    case "BALANCE_IMPORT": {
      const oldB = typeof oldV.initialBalance === "number" ? oldV.initialBalance.toFixed(2) : "—";
      const newB = typeof newV.initialBalance === "number" ? newV.initialBalance.toFixed(2) : "—";
      return {
        headline: `${actorName} hat Anfangssaldo von ${targetName} angepasst`,
        details: [`Saldo: ${oldB}h → ${newB}h`],
      };
    }

    default:
      return {
        headline: `${actorName} · ${log.action} · ${log.resource}`,
        details: [],
      };
  }
}

function diffRoleBlock(oldV: Dict, newV: Dict): string[] {
  const details: string[] = [];
  if (oldV.name !== newV.name && newV.name) {
    details.push(`Name: ${String(oldV.name)} → ${String(newV.name)}`);
  }
  if (oldV.description !== newV.description && "description" in newV) {
    details.push(`Beschreibung geändert`);
  }
  const oldPerms = new Set(Array.isArray(oldV.permissions) ? oldV.permissions as string[] : []);
  const newPerms = new Set(Array.isArray(newV.permissions) ? newV.permissions as string[] : []);
  const added = [...newPerms].filter((p) => !oldPerms.has(p));
  const removed = [...oldPerms].filter((p) => !newPerms.has(p));
  if (added.length > 0) details.push(`Hinzugefügt: ${added.join(", ")}`);
  if (removed.length > 0) details.push(`Entfernt: ${removed.join(", ")}`);
  if (details.length === 0) details.push("Keine inhaltliche Änderung");
  return details;
}

export const ACTION_TONES: Record<string, string> = {
  STAMP_IN: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  STAMP_OUT: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
  AUTO_CLOCKOUT: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  DIRECT_EDIT: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
  HR_CORRECTION: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  HR_DELETE: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  CREATE: "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30",
  DELETE: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  APPROVE: "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30",
  REJECT: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  UPDATE: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  BALANCE_IMPORT: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
  UPDATE_SETTINGS: "bg-muted text-muted-foreground border-border",
};

export const ACTION_LABELS: Record<string, string> = {
  STAMP_IN: "Eingestempelt",
  STAMP_OUT: "Ausgestempelt",
  AUTO_CLOCKOUT: "Auto-Ausstempeln",
  DIRECT_EDIT: "Selbst-Korrektur",
  HR_CORRECTION: "HR-Korrektur",
  HR_DELETE: "HR-Löschung",
  APPROVE: "Genehmigt",
  REJECT: "Abgelehnt",
  CREATE: "Erstellt",
  UPDATE: "Geändert",
  DELETE: "Gelöscht",
  UPDATE_SETTINGS: "Einstellung",
  BALANCE_IMPORT: "Saldo-Import",
};
