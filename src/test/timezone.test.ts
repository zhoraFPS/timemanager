import { describe, it, expect } from "vitest";
import {
  toLocalDateString,
  startOfLocalDay,
  endOfLocalDay,
  parseLocalDate,
} from "@/lib/local-date";
import { countWorkingDays } from "@/lib/working-time";

describe("toLocalDateString", () => {
  it("produziert YYYY-MM-DD im lokalen Zeitraum", () => {
    const d = new Date(2026, 3, 14, 14, 30); // 14.04.2026 14:30 local
    expect(toLocalDateString(d)).toBe("2026-04-14");
  });

  it("respektiert Monats/Jahreswechsel korrekt", () => {
    expect(toLocalDateString(new Date(2026, 0, 1, 0, 0))).toBe("2026-01-01");
    expect(toLocalDateString(new Date(2025, 11, 31, 23, 59))).toBe("2025-12-31");
  });

  it("bleibt stabil an der Grenze zu Mitternacht", () => {
    // 14.04.2026 00:00 local — muss 14.04. bleiben, nicht 13.04. wie bei UTC
    const d = new Date(2026, 3, 14, 0, 0, 0, 0);
    expect(toLocalDateString(d)).toBe("2026-04-14");
  });
});

describe("startOfLocalDay / endOfLocalDay", () => {
  it("kollabieren auf 00:00 bzw. 23:59:59.999", () => {
    const d = new Date(2026, 3, 14, 14, 30, 15, 500);
    const start = startOfLocalDay(d);
    const end = endOfLocalDay(d);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getSeconds()).toBe(59);
  });
});

describe("parseLocalDate", () => {
  it("erzeugt Datum zur lokalen Mitternacht", () => {
    const d = parseLocalDate("2026-04-14");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3);
    expect(d.getDate()).toBe(14);
    expect(d.getHours()).toBe(0);
  });

  it("gibt NaN bei ungültigem String", () => {
    expect(isNaN(parseLocalDate("garbage").getTime())).toBe(true);
  });
});

describe("DST-Übergang", () => {
  it("countWorkingDays zählt DST-Wechsel-Woche korrekt (Frühjahrs-Vorstellen)", () => {
    // 23.-29. März 2026, DST-Umstellung in DE: 29.03.2026 (+1h)
    // Als Mo-So: 5 Werktage, unabhängig vom DST
    expect(
      countWorkingDays(new Date(2026, 2, 23), new Date(2026, 2, 29))
    ).toBe(5);
  });

  it("countWorkingDays zählt DST-Wechsel-Woche korrekt (Herbst-Zurückstellen)", () => {
    // 26.10.2026 ist DST-Ende. 26.-01.11. umfasst den Rueckwechsel
    expect(
      countWorkingDays(new Date(2026, 9, 26), new Date(2026, 10, 1))
    ).toBe(5);
  });
});
