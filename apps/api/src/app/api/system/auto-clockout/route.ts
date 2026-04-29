import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import { audit } from "@/lib/audit";

/**
 * Auto-clockout cron job.
 *
 * Runs periodically (e.g. hourly). For every still-open time entry:
 *  - If the entry is older than `workday.forgotClockoutHours`, notify the user
 *    that they likely forgot to stamp out.
 *  - At or after `workday.autoClockoutTime` (HH:MM), forcibly close the entry
 *    by setting `clockOut = the configured cutoff on the entry's day`.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` or Vercel's cron header.
 */
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const vercelCron = req.headers.get("x-vercel-cron");

  if (!vercelCron) {
    if (!cronSecret) {
      return NextResponse.json(
        { error: "CRON_SECRET not configured" },
        { status: 500 }
      );
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const cfg = await db.systemConfig.findMany({
    where: {
      key: {
        in: [
          "workday.autoClockout",
          "workday.autoClockoutTime",
          "workday.forgotClockoutHours",
          "notify.forgotClockout",
        ],
      },
    },
  });
  const cfgMap = Object.fromEntries(cfg.map((c) => [c.key, c.value]));

  const autoEnabled = cfgMap["workday.autoClockout"] === "true";
  const autoTime = cfgMap["workday.autoClockoutTime"] ?? "22:00";
  const forgotHours = parseFloat(cfgMap["workday.forgotClockoutHours"] ?? "2");
  const forgotNotify = cfgMap["notify.forgotClockout"] === "true";

  const now = new Date();
  const [hh, mm] = autoTime.split(":").map((n) => parseInt(n));
  const todayCutoff = new Date(now);
  todayCutoff.setHours(hh, mm, 0, 0);

  const openEntries = await db.timeEntry.findMany({
    where: { clockOut: null },
    select: { id: true, userId: true, clockIn: true, type: true },
  });

  let autoClosed = 0;
  let notified = 0;

  for (const entry of openEntries) {
    const entryDay = new Date(entry.clockIn);
    const dayCutoff = new Date(entryDay);
    dayCutoff.setHours(hh, mm, 0, 0);

    // If entry is from a previous day → close at that day's cutoff
    // If it's today → close only if we're past today's cutoff
    const closeTime =
      entryDay.toDateString() === now.toDateString()
        ? todayCutoff
        : dayCutoff;

    if (autoEnabled && now >= closeTime) {
      // Guard: clockOut must be after clockIn
      const effective = closeTime > entry.clockIn ? closeTime : new Date(entry.clockIn.getTime() + 60_000);
      await db.timeEntry.update({
        where: { id: entry.id },
        data: { clockOut: effective },
      });
      autoClosed++;

      // "system" as actor — this is a cron job, not a human action.
      await audit({
        userId: "system",
        targetUserId: entry.userId,
        action: "AUTO_CLOCKOUT",
        resource: "TimeEntry",
        resourceId: entry.id,
        oldValue: { clockIn: entry.clockIn, clockOut: null, type: entry.type },
        newValue: { clockOut: effective.toISOString(), cutoff: autoTime },
      });

      if (forgotNotify) {
        await createNotification({
          userId: entry.userId,
          type: "AUTO_CLOCKOUT",
          title: "Automatisches Ausstempeln",
          body: `Du wurdest um ${autoTime} automatisch ausgestempelt. Bitte korrigiere bei Bedarf.`,
          link: "/dashboard/zeitansicht",
        }).catch(() => {});
      }
      continue;
    }

    // Forgotten-clockout reminder (between forgotHours and cutoff)
    if (forgotNotify) {
      const ageMs = now.getTime() - entry.clockIn.getTime();
      const ageHours = ageMs / 3_600_000;
      if (ageHours >= forgotHours) {
        // Only once per day per entry — use a soft dedupe via notification lookup
        const recent = await db.notification.findFirst({
          where: {
            userId: entry.userId,
            type: "FORGOT_CLOCKOUT",
            createdAt: { gte: new Date(now.getTime() - 6 * 3_600_000) },
          },
          select: { id: true },
        });
        if (!recent) {
          await createNotification({
            userId: entry.userId,
            type: "FORGOT_CLOCKOUT",
            title: "Ausstempeln vergessen?",
            body: `Du bist seit ${Math.round(ageHours)}h eingestempelt. Bitte pruefe, ob du vergessen hast auszustempeln.`,
            link: "/dashboard",
          }).catch(() => {});
          notified++;
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    processed: openEntries.length,
    autoClosed,
    notified,
    config: { autoEnabled, autoTime, forgotHours, forgotNotify },
  });
}

// Allow Vercel Cron's GET trigger too
export const GET = POST;
