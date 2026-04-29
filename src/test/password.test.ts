import { describe, it, expect } from "vitest";
import { generateInitialPassword } from "@/lib/password";

describe("generateInitialPassword", () => {
  it("hat default-Länge 12", () => {
    expect(generateInitialPassword()).toHaveLength(12);
  });

  it("respektiert benutzerdefinierte Länge", () => {
    expect(generateInitialPassword(20)).toHaveLength(20);
    expect(generateInitialPassword(8)).toHaveLength(8);
  });

  it("enthält keine ambigen Glyphen (0/O/1/l/I)", () => {
    // Check 100 samples to reduce flakiness
    for (let i = 0; i < 100; i++) {
      const pw = generateInitialPassword(16);
      expect(pw).not.toMatch(/[0O1lI]/);
    }
  });

  it("produziert unterschiedliche Passwörter (Entropie-Check)", () => {
    const samples = new Set<string>();
    for (let i = 0; i < 50; i++) samples.add(generateInitialPassword());
    // Collisions über 50 Versuche sind astronomisch unwahrscheinlich
    expect(samples.size).toBe(50);
  });
});
