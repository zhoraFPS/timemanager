import { describe, it, expect } from "vitest";
import { formatAuditEntry, type AuditLogEntry } from "@/lib/audit-format";

function entry(partial: Partial<AuditLogEntry>): AuditLogEntry {
  return {
    id: "log1",
    userId: "actor1",
    targetUserId: null,
    actor: { id: "actor1", name: "Billy Groemmer", employeeNumber: "1001" },
    target: null,
    action: "UNKNOWN",
    resource: "TimeEntry",
    resourceId: "te1",
    oldValue: null,
    newValue: null,
    createdAt: new Date("2026-04-14T08:00:00Z").toISOString(),
    ...partial,
  };
}

describe("formatAuditEntry", () => {
  it("STAMP_IN → Einstempel-Satz mit Uhrzeit und Typ", () => {
    const f = formatAuditEntry(
      entry({
        action: "STAMP_IN",
        newValue: { type: "WORK", clockIn: "2026-04-14T08:15:00Z", projectId: null },
      })
    );
    expect(f.headline).toContain("Billy Groemmer");
    expect(f.headline).toContain("eingestempelt");
    expect(f.details.some((d) => d.includes("Stempelart: Kommen"))).toBe(true);
  });

  it("STAMP_OUT → zeigt Arbeitszeit-Dauer", () => {
    const f = formatAuditEntry(
      entry({
        action: "STAMP_OUT",
        newValue: {
          type: "WORK",
          clockIn: "2026-04-14T08:00:00Z",
          clockOut: "2026-04-14T16:30:00Z",
        },
      })
    );
    expect(f.headline).toContain("ausgestempelt");
    expect(f.details.some((d) => d.includes("8h 30min"))).toBe(true);
  });

  it("HR_CORRECTION → listet Diffs als alt → neu", () => {
    const f = formatAuditEntry(
      entry({
        action: "HR_CORRECTION",
        target: { id: "u2", name: "Anna Admin", employeeNumber: "2001" },
        oldValue: {
          type: "WORK",
          clockIn: "2026-04-14T08:15:00Z",
          clockOut: "2026-04-14T16:47:00Z",
        },
        newValue: {
          type: "WORK",
          clockIn: "2026-04-14T08:00:00Z",
          clockOut: "2026-04-14T17:00:00Z",
        },
      })
    );
    expect(f.headline).toContain("Anna Admin");
    // Type unchanged → not in diff
    expect(f.details.some((d) => d.startsWith("Stempelart"))).toBe(false);
    // Times changed → in diff
    expect(f.details.some((d) => d.startsWith("Kommen"))).toBe(true);
    expect(f.details.some((d) => d.startsWith("Gehen"))).toBe(true);
  });

  it("DIRECT_EDIT ohne Änderungen → Hinweis 'Keine Änderung'", () => {
    const f = formatAuditEntry(
      entry({
        action: "DIRECT_EDIT",
        oldValue: {
          type: "WORK",
          clockIn: "2026-04-14T08:00:00Z",
          clockOut: "2026-04-14T17:00:00Z",
        },
        newValue: {
          type: "WORK",
          clockIn: "2026-04-14T08:00:00Z",
          clockOut: "2026-04-14T17:00:00Z",
        },
      })
    );
    expect(f.details.some((d) => d.toLowerCase().includes("keine"))).toBe(true);
  });

  it("APPROVE Request → zeigt Request-Typ und Kommentar", () => {
    const f = formatAuditEntry(
      entry({
        action: "APPROVE",
        resource: "Request",
        target: { id: "u2", name: "Anna Antragsteller", employeeNumber: "2001" },
        oldValue: { status: "PENDING", type: "VACATION" },
        newValue: { status: "APPROVED", comment: "Viel Erholung!" },
      })
    );
    expect(f.headline).toContain("Urlaub");
    expect(f.headline).toContain("genehmigt");
    expect(f.details.some((d) => d.includes("Viel Erholung"))).toBe(true);
  });

  it("BALANCE_IMPORT → zeigt alt vs neu mit 2 Nachkommastellen", () => {
    const f = formatAuditEntry(
      entry({
        action: "BALANCE_IMPORT",
        resource: "User",
        target: { id: "u2", name: "Anna", employeeNumber: "2001" },
        oldValue: { initialBalance: 0 },
        newValue: { initialBalance: 12.5 },
      })
    );
    expect(f.details[0]).toContain("0.00h");
    expect(f.details[0]).toContain("12.50h");
  });

  it("AUTO_CLOCKOUT → System als Actor", () => {
    const f = formatAuditEntry(
      entry({
        action: "AUTO_CLOCKOUT",
        userId: "system",
        actor: { id: "system", name: "System", employeeNumber: null },
        target: { id: "u1", name: "Billy", employeeNumber: "1001" },
        oldValue: { type: "WORK", clockIn: "2026-04-14T08:00:00Z" },
        newValue: { cutoff: "22:00", clockOut: "2026-04-14T22:00:00Z" },
      })
    );
    expect(f.headline).toContain("Billy");
    expect(f.headline).toContain("automatisch");
  });
});
