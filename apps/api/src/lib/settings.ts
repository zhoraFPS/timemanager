import { db } from "@/lib/db";

export type SettingsGroup =
  | "workday" | "vacation" | "homeoffice" | "approval"
  | "stamp" | "holidays" | "notify" | "security"
  | "branding" | "export" | "smtp" | "datev" | "surcharge";

export async function getSettings(group?: SettingsGroup): Promise<Record<string, string>> {
  const configs = await db.systemConfig.findMany(
    group ? { where: { key: { startsWith: `${group}.` } } } : undefined
  );
  return Object.fromEntries(configs.map((c) => [c.key, c.value]));
}

export async function getSetting(key: string, fallback = ""): Promise<string> {
  const cfg = await db.systemConfig.findUnique({ where: { key } });
  return cfg?.value ?? fallback;
}

export async function updateSettings(updates: Record<string, string>): Promise<void> {
  await Promise.all(
    Object.entries(updates).map(([key, value]) =>
      db.systemConfig.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    )
  );
}
