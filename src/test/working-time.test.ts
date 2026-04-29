import { describe, it, expect } from "vitest";
import { calcNetMins, countWorkingDays } from "@/lib/working-time";

describe("calcNetMins", () => {
  const opts = { autoBreak: true, breakAfterHours: 6, breakMinutes: 30 };

  it("zählt volle Minuten zwischen Kommen und Gehen", () => {
    const ci = new Date("2026-04-14T08:00:00");
    const co = new Date("2026-04-14T12:00:00");
    expect(calcNetMins(ci, co, { ...opts, autoBreak: false })).toBe(240);
  });

  it("zieht Pause ab wenn autoBreak aktiv und Schwelle überschritten", () => {
    const ci = new Date("2026-04-14T08:00:00");
    const co = new Date("2026-04-14T15:00:00"); // 7h
    expect(calcNetMins(ci, co, opts)).toBe(7 * 60 - 30);
  });

  it("zieht Pause NICHT ab wenn Schwelle nicht erreicht", () => {
    const ci = new Date("2026-04-14T08:00:00");
    const co = new Date("2026-04-14T13:00:00"); // 5h < 6h
    expect(calcNetMins(ci, co, opts)).toBe(5 * 60);
  });

  it("zieht Pause NICHT ab wenn autoBreak deaktiviert", () => {
    const ci = new Date("2026-04-14T08:00:00");
    const co = new Date("2026-04-14T20:00:00");
    expect(calcNetMins(ci, co, { ...opts, autoBreak: false })).toBe(12 * 60);
  });

  it("gibt nicht-negative Werte zurück bei großer Pausen-Konfiguration", () => {
    const ci = new Date("2026-04-14T08:00:00");
    const co = new Date("2026-04-14T14:01:00"); // knapp über Schwelle
    const result = calcNetMins(ci, co, { autoBreak: true, breakAfterHours: 6, breakMinutes: 500 });
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it("berechnet exakt über Mitternacht", () => {
    const ci = new Date("2026-04-14T22:00:00");
    const co = new Date("2026-04-15T06:00:00");
    expect(calcNetMins(ci, co, { ...opts, autoBreak: false })).toBe(8 * 60);
  });
});

describe("countWorkingDays", () => {
  it("zählt eine volle Woche Mo-Fr als 5 Arbeitstage", () => {
    // Montag - Sonntag
    expect(countWorkingDays(new Date("2026-04-13"), new Date("2026-04-19"))).toBe(5);
  });

  it("zählt einzelnen Werktag als 1", () => {
    expect(countWorkingDays(new Date("2026-04-14"), new Date("2026-04-14"))).toBe(1);
  });

  it("zählt Wochenendtag als 0", () => {
    expect(countWorkingDays(new Date("2026-04-18"), new Date("2026-04-19"))).toBe(0);
  });

  it("zählt über Monatsgrenze korrekt", () => {
    // 27.04. (Mo) bis 04.05. (Mo) = 6 Werktage (27,28,29,30,01,04) — Sa/So raus
    expect(countWorkingDays(new Date("2026-04-27"), new Date("2026-05-04"))).toBe(6);
  });

  it("zählt 0 wenn to < from", () => {
    expect(countWorkingDays(new Date("2026-04-15"), new Date("2026-04-14"))).toBe(0);
  });
});
