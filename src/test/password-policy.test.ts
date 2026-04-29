import { describe, it, expect } from "vitest";
import {
  validatePasswordShape,
  isPasswordExpired,
  DEFAULT_POLICY,
} from "@/lib/password-policy";

describe("validatePasswordShape", () => {
  it("akzeptiert Passwort das alle Regeln erfüllt", () => {
    const r = validatePasswordShape("StarkesPW2026!", DEFAULT_POLICY);
    expect(r.ok).toBe(true);
  });

  it("lehnt zu kurzes Passwort ab", () => {
    const r = validatePasswordShape("Kurz1!", { ...DEFAULT_POLICY, minLength: 10 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => /10/.test(e))).toBe(true);
  });

  it("lehnt Passwort ohne Großbuchstabe ab wenn gefordert", () => {
    const r = validatePasswordShape("schwaches2026!", DEFAULT_POLICY);
    expect(r.ok).toBe(false);
  });

  it("lehnt Passwort ohne Sonderzeichen ab wenn gefordert", () => {
    const r = validatePasswordShape("StarkesPW2026", DEFAULT_POLICY);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => /Sonderzeichen/.test(e))).toBe(true);
  });

  it("akzeptiert Umlaute als Großbuchstabe", () => {
    const r = validatePasswordShape("Übersoldaten2026!", DEFAULT_POLICY);
    expect(r.ok).toBe(true);
  });

  it("ignoriert deaktivierte Regeln", () => {
    const minimal = {
      ...DEFAULT_POLICY,
      requireUpper: false,
      requireLower: false,
      requireNumber: false,
      requireSymbol: false,
      minLength: 4,
    };
    expect(validatePasswordShape("aaaa", minimal).ok).toBe(true);
  });
});

describe("isPasswordExpired", () => {
  it("false bei expiryDays = 0 (kein Ablauf)", () => {
    const policy = { ...DEFAULT_POLICY, expiryDays: 0 };
    expect(isPasswordExpired(new Date("2020-01-01"), policy)).toBe(false);
  });

  it("false wenn passwordChangedAt null ist", () => {
    expect(isPasswordExpired(null, DEFAULT_POLICY)).toBe(false);
    expect(isPasswordExpired(undefined, DEFAULT_POLICY)).toBe(false);
  });

  it("true wenn Passwort älter als expiryDays", () => {
    const policy = { ...DEFAULT_POLICY, expiryDays: 90 };
    const oldDate = new Date(Date.now() - 100 * 86_400_000);
    expect(isPasswordExpired(oldDate, policy)).toBe(true);
  });

  it("false wenn Passwort neuer als expiryDays", () => {
    const policy = { ...DEFAULT_POLICY, expiryDays: 90 };
    const recent = new Date(Date.now() - 10 * 86_400_000);
    expect(isPasswordExpired(recent, policy)).toBe(false);
  });
});
