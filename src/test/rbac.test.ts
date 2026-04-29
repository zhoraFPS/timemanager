import { describe, it, expect } from "vitest";
import {
  callerCanGrant,
  parsePermissionKey,
  permissionKey,
  scopeIsAtLeast,
} from "@/lib/rbac";

describe("permissionKey / parsePermissionKey", () => {
  it("round-trips ein gültiges Permission-Objekt", () => {
    const p = { resource: "time_entries" as const, action: "read" as const, scope: "team" as const };
    expect(parsePermissionKey(permissionKey(p))).toEqual(p);
  });

  it("gibt null bei ungültigem String zurück", () => {
    expect(parsePermissionKey("unknown:read:team")).toBeNull();
    expect(parsePermissionKey("time_entries:delete:own")).toBeNull();
    expect(parsePermissionKey("time_entries:read:universe")).toBeNull();
    expect(parsePermissionKey("garbage")).toBeNull();
  });
});

describe("scopeIsAtLeast", () => {
  it("all deckt alles ab", () => {
    expect(scopeIsAtLeast("all", "own")).toBe(true);
    expect(scopeIsAtLeast("all", "team")).toBe(true);
    expect(scopeIsAtLeast("all", "all")).toBe(true);
  });

  it("team deckt team und own ab, nicht all", () => {
    expect(scopeIsAtLeast("team", "own")).toBe(true);
    expect(scopeIsAtLeast("team", "team")).toBe(true);
    expect(scopeIsAtLeast("team", "all")).toBe(false);
  });

  it("own deckt nur own ab", () => {
    expect(scopeIsAtLeast("own", "own")).toBe(true);
    expect(scopeIsAtLeast("own", "team")).toBe(false);
    expect(scopeIsAtLeast("own", "all")).toBe(false);
  });
});

describe("callerCanGrant (Privilege-Escalation-Schutz)", () => {
  const wantedTeamRead = {
    resource: "time_entries" as const,
    action: "read" as const,
    scope: "team" as const,
  };

  it("erlaubt Grant wenn Caller selbes oder weiteres Scope hat", () => {
    expect(callerCanGrant(["time_entries:read:all"], wantedTeamRead)).toBe(true);
    expect(callerCanGrant(["time_entries:read:team"], wantedTeamRead)).toBe(true);
  });

  it("verweigert wenn Caller engeres Scope hat", () => {
    expect(callerCanGrant(["time_entries:read:own"], wantedTeamRead)).toBe(false);
  });

  it("verweigert wenn andere Resource", () => {
    expect(callerCanGrant(["requests:read:all"], wantedTeamRead)).toBe(false);
  });

  it("verweigert wenn andere Action", () => {
    expect(callerCanGrant(["time_entries:write:all"], wantedTeamRead)).toBe(false);
  });

  it("ignoriert ungültige Held-Keys", () => {
    expect(callerCanGrant(["garbage", "time_entries:read:all"], wantedTeamRead)).toBe(true);
    expect(callerCanGrant(["garbage"], wantedTeamRead)).toBe(false);
  });

  it("verweigert bei leerer Permission-Liste", () => {
    expect(callerCanGrant([], wantedTeamRead)).toBe(false);
  });

  it("HR_ADMIN darf keine roles:write vergeben wenn er roles:* nicht hat", () => {
    const hrPerms = [
      "time_entries:read:all",
      "time_entries:write:all",
      "employees:read:all",
      "employees:write:all",
      "settings:read:all",
      "settings:write:all",
      "audit:read:all",
    ];
    expect(
      callerCanGrant(hrPerms, { resource: "roles", action: "write", scope: "all" })
    ).toBe(false);
  });

  it("SUPERADMIN darf alles inkl. roles:write:all vergeben", () => {
    const superPerms = [
      "roles:read:all",
      "roles:write:all",
      "time_entries:write:all",
    ];
    expect(
      callerCanGrant(superPerms, { resource: "roles", action: "write", scope: "all" })
    ).toBe(true);
  });
});
