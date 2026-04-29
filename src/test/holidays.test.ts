import { describe, it, expect } from "vitest";
import { countWorkingDaysExcludingHolidays } from "@/lib/holidays";

describe("countWorkingDaysExcludingHolidays", () => {
  it("ignoriert Feiertage innerhalb der Range", () => {
    const holidays = new Set(["2026-04-14"]); // einzelner Werktag als Feiertag markiert
    // Mo 13.04. - Fr 17.04. = 5 Werktage minus 1 Feiertag
    expect(
      countWorkingDaysExcludingHolidays(
        new Date("2026-04-13"),
        new Date("2026-04-17"),
        holidays
      )
    ).toBe(4);
  });

  it("ignoriert Wochenend-Feiertage (die zaehlen sowieso nicht)", () => {
    const holidays = new Set(["2026-04-18"]); // ein Samstag
    expect(
      countWorkingDaysExcludingHolidays(
        new Date("2026-04-13"),
        new Date("2026-04-19"),
        holidays
      )
    ).toBe(5);
  });

  it("gibt 0 bei leerer Range zurueck", () => {
    expect(
      countWorkingDaysExcludingHolidays(
        new Date("2026-04-15"),
        new Date("2026-04-14"),
        new Set()
      )
    ).toBe(0);
  });

  it("gibt korrekten Wert wenn alle Feiertage in Range", () => {
    // Karfreitag und Ostermontag 2026: 03.04. (Fr) und 06.04. (Mo)
    const holidays = new Set(["2026-04-03", "2026-04-06"]);
    // Do 02.04. - Fr 10.04. — Werktage Do/Fr/Mo/Di/Mi/Do/Fr minus 2 = 5
    expect(
      countWorkingDaysExcludingHolidays(
        new Date("2026-04-02"),
        new Date("2026-04-10"),
        holidays
      )
    ).toBe(5);
  });
});
