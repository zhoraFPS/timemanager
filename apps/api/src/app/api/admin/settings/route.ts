import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { NextResponse } from "next/server";

const GROUPS = ["workday", "vacation", "homeoffice", "approval", "stamp", "holidays", "notify", "security", "branding", "export", "smtp", "datev", "surcharge"];

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canRead = await hasPermission(session.user.id, "settings", "read", "all");
  if (!canRead) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const allConfigs = await db.systemConfig.findMany({ orderBy: { key: "asc" } });
  const grouped: Record<string, Record<string, string>> = {};

  for (const group of GROUPS) {
    grouped[group] = {};
  }

  for (const cfg of allConfigs) {
    const [group, ...rest] = cfg.key.split(".");
    if (grouped[group] !== undefined) {
      grouped[group][rest.join(".")] = cfg.value;
    }
  }

  return NextResponse.json({ settings: grouped });
}
