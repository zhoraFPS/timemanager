import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { updateSettings } from "@/lib/settings";
import { audit } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_GROUPS = new Set([
  "workday",
  "vacation",
  "homeoffice",
  "approval",
  "stamp",
  "holidays",
  "notify",
  "security",
  "branding",
  "export",
  "smtp",
  "datev",
  "surcharge",
]);

// Keys inside a group are accepted but sanitized to [a-zA-Z0-9_.] to prevent
// SystemConfig pollution via crafted keys.
const KEY_RE = /^[a-zA-Z0-9_.]+$/;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ group: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canWrite = await hasPermission(session.user.id, "settings", "write", "all");
  if (!canWrite) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { group } = await params;
  if (!ALLOWED_GROUPS.has(group)) {
    return NextResponse.json({ error: "Unbekannte Settings-Gruppe" }, { status: 400 });
  }

  const body = await req.json();

  const updates: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (!KEY_RE.test(key)) {
      return NextResponse.json({ error: `Ungueltiger Key: ${key}` }, { status: 400 });
    }
    updates[`${group}.${key}`] = String(value);
  }

  await updateSettings(updates);
  await audit({
    userId: session.user.id,
    action: "UPDATE_SETTINGS",
    resource: "SystemConfig",
    resourceId: group,
    newValue: updates,
  });
  return NextResponse.json({ success: true });
}
