import { getSettings } from "@/lib/settings";

interface TemplateVars {
  [key: string]: string;
}

async function getBranding() {
  const s = await getSettings("branding");
  return {
    companyName: s["branding.companyName"] ?? "VfL Bochum 1848",
    primaryColor: s["branding.primaryColor"] ?? "#1d4ed8",
  };
}

function baseLayout(body: string, branding: { companyName: string; primaryColor: string }) {
  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
  <tr><td style="background:${branding.primaryColor};padding:24px 32px;">
    <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">${branding.companyName}</h1>
    <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:12px;">VfL Zeitspiel</p>
  </td></tr>
  <tr><td style="padding:32px;">${body}</td></tr>
  <tr><td style="padding:16px 32px;background:#fafafa;border-top:1px solid #e4e4e7;">
    <p style="margin:0;font-size:11px;color:#a1a1aa;text-align:center;">
      ${branding.companyName} — VfL Zeitspiel &bull; Diese E-Mail wurde automatisch versendet.
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function interpolate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

const TEMPLATES = {
  requestApproved: {
    subject: "Antrag genehmigt: {{type}}",
    body: `<h2 style="margin:0 0 16px;font-size:18px;color:#18181b;">Antrag genehmigt</h2>
<p style="margin:0 0 8px;color:#3f3f46;">Hallo {{name}},</p>
<p style="margin:0 0 16px;color:#3f3f46;">dein Antrag vom Typ <strong>{{type}}</strong> fuer den Zeitraum <strong>{{dateFrom}}</strong> bis <strong>{{dateTo}}</strong> wurde genehmigt.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr style="background:#f4f4f5;"><td style="padding:8px 12px;font-size:13px;color:#71717a;">Typ</td><td style="padding:8px 12px;font-size:13px;">{{type}}</td></tr>
  <tr><td style="padding:8px 12px;font-size:13px;color:#71717a;">Zeitraum</td><td style="padding:8px 12px;font-size:13px;">{{dateFrom}} – {{dateTo}}</td></tr>
  <tr style="background:#f4f4f5;"><td style="padding:8px 12px;font-size:13px;color:#71717a;">Genehmigt von</td><td style="padding:8px 12px;font-size:13px;">{{approver}}</td></tr>
</table>`,
  },

  requestRejected: {
    subject: "Antrag abgelehnt: {{type}}",
    body: `<h2 style="margin:0 0 16px;font-size:18px;color:#18181b;">Antrag abgelehnt</h2>
<p style="margin:0 0 8px;color:#3f3f46;">Hallo {{name}},</p>
<p style="margin:0 0 16px;color:#3f3f46;">dein Antrag vom Typ <strong>{{type}}</strong> fuer den Zeitraum {{dateFrom}} bis {{dateTo}} wurde leider abgelehnt.</p>
<p style="margin:0 0 8px;color:#71717a;font-size:13px;">Kommentar:</p>
<p style="margin:0;padding:12px;background:#fef2f2;border-radius:6px;color:#991b1b;font-size:13px;">{{comment}}</p>`,
  },

  newRequestPending: {
    subject: "Neuer Antrag zur Genehmigung: {{type}} von {{name}}",
    body: `<h2 style="margin:0 0 16px;font-size:18px;color:#18181b;">Neuer Antrag eingegangen</h2>
<p style="margin:0 0 16px;color:#3f3f46;">{{name}} hat einen neuen Antrag gestellt, der auf deine Genehmigung wartet.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr style="background:#f4f4f5;"><td style="padding:8px 12px;font-size:13px;color:#71717a;">Mitarbeiter</td><td style="padding:8px 12px;font-size:13px;">{{name}}</td></tr>
  <tr><td style="padding:8px 12px;font-size:13px;color:#71717a;">Typ</td><td style="padding:8px 12px;font-size:13px;">{{type}}</td></tr>
  <tr style="background:#f4f4f5;"><td style="padding:8px 12px;font-size:13px;color:#71717a;">Zeitraum</td><td style="padding:8px 12px;font-size:13px;">{{dateFrom}} – {{dateTo}}</td></tr>
</table>
<p style="margin:16px 0 0;"><a href="{{link}}" style="display:inline-block;padding:10px 24px;background:{{primaryColor}};color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">Antrag ansehen</a></p>`,
  },

  forgotClockout: {
    subject: "Vergessenes Ausstempeln",
    body: `<h2 style="margin:0 0 16px;font-size:18px;color:#18181b;">Ausstempeln vergessen?</h2>
<p style="margin:0 0 16px;color:#3f3f46;">Hallo {{name}},</p>
<p style="margin:0 0 16px;color:#3f3f46;">du bist seit <strong>{{clockInTime}}</strong> eingestempelt ({{type}}). Falls du vergessen hast auszustempeln, korrigiere dies bitte.</p>
<p style="margin:16px 0 0;"><a href="{{link}}" style="display:inline-block;padding:10px 24px;background:{{primaryColor}};color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">Zur VfL Zeitspiel App</a></p>`,
  },

  monthlyReminder: {
    subject: "Monatsuebersicht {{month}} {{year}}",
    body: `<h2 style="margin:0 0 16px;font-size:18px;color:#18181b;">Deine Monatsuebersicht</h2>
<p style="margin:0 0 16px;color:#3f3f46;">Hallo {{name}}, hier ist deine Uebersicht fuer {{month}} {{year}}:</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr style="background:#f4f4f5;"><td style="padding:8px 12px;font-size:13px;color:#71717a;">Soll</td><td style="padding:8px 12px;font-size:13px;">{{targetHours}}h</td></tr>
  <tr><td style="padding:8px 12px;font-size:13px;color:#71717a;">Ist</td><td style="padding:8px 12px;font-size:13px;">{{actualHours}}h</td></tr>
  <tr style="background:#f4f4f5;"><td style="padding:8px 12px;font-size:13px;color:#71717a;">Saldo</td><td style="padding:8px 12px;font-size:13px;font-weight:600;">{{saldo}}h</td></tr>
  <tr><td style="padding:8px 12px;font-size:13px;color:#71717a;">Resturlaub</td><td style="padding:8px 12px;font-size:13px;">{{vacationLeft}} Tage</td></tr>
</table>`,
  },

  passwordReset: {
    subject: "Passwort zuruecksetzen",
    body: `<h2 style="margin:0 0 16px;font-size:18px;color:#18181b;">Passwort zuruecksetzen</h2>
<p style="margin:0 0 16px;color:#3f3f46;">Hallo {{name}},</p>
<p style="margin:0 0 16px;color:#3f3f46;">es wurde eine Passwortzuruecksetzung fuer dein Konto angefordert. Klicke auf den Button um ein neues Passwort zu setzen:</p>
<p style="margin:16px 0;"><a href="{{link}}" style="display:inline-block;padding:10px 24px;background:{{primaryColor}};color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">Neues Passwort setzen</a></p>
<p style="margin:16px 0 0;font-size:12px;color:#a1a1aa;">Dieser Link ist 24 Stunden gueltig. Falls du keine Zuruecksetzung angefordert hast, ignoriere diese E-Mail.</p>`,
  },

  adminPasswordReset: {
    subject: "Dein Passwort wurde zuruckgesetzt",
    body: `<h2 style="margin:0 0 16px;font-size:18px;color:#18181b;">Neues Passwort vergeben</h2>
<p style="margin:0 0 16px;color:#3f3f46;">Hallo {{name}},</p>
<p style="margin:0 0 16px;color:#3f3f46;">dein Passwort wurde von der Personalabteilung zuruckgesetzt. Melde dich mit folgendem initialen Passwort an und aendere es beim ersten Login.</p>
<div style="margin:16px 0;padding:16px;background:#f4f4f5;border-radius:8px;font-family:monospace;font-size:16px;text-align:center;letter-spacing:2px;color:#18181b;">{{password}}</div>
<p style="margin:16px 0 0;"><a href="{{loginUrl}}" style="display:inline-block;padding:10px 24px;background:{{primaryColor}};color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">Jetzt anmelden</a></p>
<p style="margin:16px 0 0;font-size:12px;color:#a1a1aa;">Falls du diese Zurueksetzung nicht erwartet hast, kontaktiere bitte sofort die Personalabteilung.</p>`,
  },

  accountCreated: {
    subject: "Dein VfL-Zeitspiel-Konto ist bereit",
    body: `<h2 style="margin:0 0 16px;font-size:18px;color:#18181b;">Willkommen!</h2>
<p style="margin:0 0 16px;color:#3f3f46;">Hallo {{name}},</p>
<p style="margin:0 0 16px;color:#3f3f46;">dein Zeiterfassungs-Konto wurde angelegt. Melde dich mit folgenden Zugangsdaten an:</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr style="background:#f4f4f5;"><td style="padding:8px 12px;font-size:13px;color:#71717a;">Mitarbeiternummer</td><td style="padding:8px 12px;font-size:13px;font-family:monospace;">{{employeeNumber}}</td></tr>
  <tr><td style="padding:8px 12px;font-size:13px;color:#71717a;">Initiales Passwort</td><td style="padding:8px 12px;font-size:13px;font-family:monospace;letter-spacing:2px;">{{password}}</td></tr>
</table>
<p style="margin:16px 0 0;"><a href="{{loginUrl}}" style="display:inline-block;padding:10px 24px;background:{{primaryColor}};color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">Jetzt anmelden</a></p>
<p style="margin:16px 0 0;font-size:12px;color:#a1a1aa;">Das Passwort ist nur fuer den ersten Login gueltig — du wirst danach aufgefordert, ein neues zu setzen.</p>`,
  },
} as const;

export type EmailTemplate = keyof typeof TEMPLATES;

export async function renderEmail(
  template: EmailTemplate,
  vars: TemplateVars
): Promise<{ subject: string; html: string }> {
  const branding = await getBranding();
  const t = TEMPLATES[template];
  const allVars = { ...vars, primaryColor: branding.primaryColor };
  const subject = interpolate(t.subject, allVars);
  const body = interpolate(t.body, allVars);
  const html = baseLayout(body, branding);
  return { subject, html };
}
