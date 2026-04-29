import { db } from "@/lib/db";

export async function createNotification({
  userId,
  senderId,
  type,
  title,
  body,
  link,
}: {
  userId: string;
  senderId?: string;
  type: string;
  title: string;
  body: string;
  link?: string;
}) {
  const notification = await db.notification.create({
    data: { userId, senderId: senderId ?? null, type, title, body, link: link ?? null },
  });

  // Browser Push (Server-seitig, Node.js only)
  try {
    const pref = await db.notificationPreference.findUnique({ where: { userId } });
    if (pref?.browserPushEnabled && pref.pushSubscription) {
      const webpush = await import("web-push");
      if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
        webpush.default.setVapidDetails(
          process.env.VAPID_SUBJECT ?? "mailto:admin@firma.de",
          process.env.VAPID_PUBLIC_KEY,
          process.env.VAPID_PRIVATE_KEY
        );
        await webpush.default.sendNotification(
          pref.pushSubscription as unknown as import("web-push").PushSubscription,
          JSON.stringify({ title, body, link })
        );
      }
    }
  } catch {
    // Push fehlgeschlagen — kein Crash
  }

  // E-Mail
  try {
    const pref = await db.notificationPreference.findUnique({ where: { userId } });
    if (pref?.emailEnabled !== false) {
      const { sendEmail } = await import("@/lib/email");
      const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
      if (user?.email) {
        await sendEmail({ to: user.email, subject: title, text: body });
      }
    }
  } catch {
    // E-Mail fehlgeschlagen — kein Crash
  }

  // Expo Mobile Push
  try {
    const devices = await db.device.findMany({
      where: { userId, pushToken: { not: null } },
      select: { pushToken: true },
    });
    const tokens = devices
      .map((d) => d.pushToken!)
      .filter((t) => t.startsWith("ExponentPushToken["));

    if (tokens.length > 0) {
      const messages = tokens.map((to) => ({
        to,
        title,
        body,
        data: link ? { link } : undefined,
        sound: "default" as const,
      }));

      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      });
    }
  } catch {
    // Expo Push fehlgeschlagen — kein Crash
  }

  return notification;
}
