import type { NextConfig } from "next";

const SECURITY_HEADERS = [
  // Clickjacking — app is never meant to be framed.
  { key: "X-Frame-Options", value: "DENY" },
  // Strip Referer on cross-origin navigation to avoid leaking deep links.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Legacy MIME-sniffing attacks.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Disable the sensors/APIs we never use so a compromised dep can't ask.
  {
    key: "Permissions-Policy",
    value: [
      "camera=(self)", // QR device pairing uses the camera on mobile web
      "microphone=()",
      "geolocation=(self)", // optional geofence stamping
      "interest-cohort=()",
      "payment=()",
      "usb=()",
      "bluetooth=()",
    ].join(", "),
  },
  // Force HTTPS for 2 years incl. subdomains. Only production.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Content-Security-Policy — tuned for Next 16 + our use of inline
  // styles/scripts generated at build time. `unsafe-inline` on styles is
  // required by Tailwind's runtime vars; scripts use nonce-less inline
  // chunks emitted by Next, hence `unsafe-inline` there too for now.
  // Tighten later via middleware-injected nonces if needed.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
