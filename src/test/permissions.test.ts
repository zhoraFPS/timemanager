import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    userRole: {
      findMany: vi.fn(),
    },
  },
}));

import { hasPermission } from "@/lib/permissions";
import { db } from "@/lib/db";

describe("hasPermission", () => {
  beforeEach(() => vi.clearAllMocks());

  it("erlaubt Zugriff wenn scope 'all' vorhanden", async () => {
    (db.userRole.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        role: {
          permissions: [
            { resource: "time_entries", action: "read", scope: "all" },
          ],
        },
      },
    ]);

    const result = await hasPermission("user1", "time_entries", "read", "own");
    expect(result).toBe(true);
  });

  it("erlaubt Zugriff wenn scope 'team' und requiredScope 'own'", async () => {
    (db.userRole.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        role: {
          permissions: [
            { resource: "requests", action: "approve", scope: "team" },
          ],
        },
      },
    ]);

    const result = await hasPermission("manager1", "requests", "approve", "own");
    expect(result).toBe(true);
  });

  it("verweigert Zugriff bei fehlender Permission", async () => {
    (db.userRole.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const result = await hasPermission("user1", "roles", "write");
    expect(result).toBe(false);
  });

  it("verweigert wenn scope 'own' aber 'all' benötigt", async () => {
    (db.userRole.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        role: {
          permissions: [
            { resource: "time_entries", action: "read", scope: "own" },
          ],
        },
      },
    ]);

    const result = await hasPermission("user1", "time_entries", "read", "all");
    expect(result).toBe(false);
  });
});
