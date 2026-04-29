import nodemailer from "nodemailer";
import { getSettings } from "@/lib/settings";
import { renderEmail, type EmailTemplate } from "@/lib/email-templates";

async function getSmtpConfig() {
  const s = await getSettings("smtp");
  return {
    host: s["smtp.Host"] ?? "",
    port: parseInt(s["smtp.Port"] ?? "587"),
    user: s["smtp.User"] ?? "",
    from: s["smtp.From"] ?? "zeiterfassung@firma.de",
  };
}

/**
 * Send a plain-text email (legacy).
 */
export async function sendEmail({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}) {
  const cfg = await getSmtpConfig();
  if (!cfg.host) return;

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: cfg.user ? { user: cfg.user, pass: process.env.SMTP_PASSWORD ?? "" } : undefined,
  });

  await transporter.sendMail({ from: cfg.from, to, subject, text });
}

/**
 * Send a branded HTML email using a template.
 */
export async function sendTemplateEmail(
  to: string,
  template: EmailTemplate,
  vars: Record<string, string>
): Promise<boolean> {
  const cfg = await getSmtpConfig();
  if (!cfg.host) {
    console.warn("[email] SMTP not configured, skipping email");
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: cfg.user ? { user: cfg.user, pass: process.env.SMTP_PASSWORD ?? "" } : undefined,
  });

  const { subject, html } = await renderEmail(template, vars);

  try {
    await transporter.sendMail({ from: cfg.from, to, subject, html });
    return true;
  } catch (err) {
    console.error("[email] Failed to send:", err);
    return false;
  }
}
