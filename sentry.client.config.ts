import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    // Keep sampling conservative on the client — 10 % traces is enough to
    // spot regressions without flooding the event quota.
    tracesSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,
    // Don't capture any PII by default (names, emails, session tokens).
    sendDefaultPii: false,
  });
}
