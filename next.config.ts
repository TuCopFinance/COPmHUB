import type { NextConfig } from "next";
import { BRIDGE_FRAME_ORIGINS, BRIDGE_KYC_ORIGIN } from "./src/lib/offramp/embed";

const CANONICAL_HOST = "digitalcop.shop";

function originOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value.trim()).origin;
  } catch {
    return null;
  }
}

// The off-ramp form calls TuCOPRamp from the browser, so its origin has to be
// allowed in connect-src. Read at build time, like the feature flag itself.
const offrampApi = originOf(process.env.OFFRAMP_API_URL);
const isDev = process.env.NODE_ENV !== "production";

// The off-ramp form shows Bridge's terms and identity pages in frames, and the
// identity check needs the camera. Both stay closed while the form is off.
const offrampOn = process.env.OFFRAMP_ENABLED === "true" && offrampApi !== null;
const frameSrc = offrampOn ? BRIDGE_FRAME_ORIGINS.join(" ") : "'none'";
// `self` is needed too: a browser only hands the camera to a frame from a
// document that is itself allowed to use it.
const camera = offrampOn ? `(self "${BRIDGE_KYC_ORIGIN}")` : "()";

const csp = [
  "default-src 'self'",
  // Next.js inlines its bootstrap scripts; a nonce would force every page to
  // render per request, and the marketing pages are static on purpose.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://www.googletagmanager.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://www.googletagmanager.com https://*.google-analytics.com",
  "font-src 'self'",
  [
    "connect-src 'self'",
    offrampApi,
    "https://*.google-analytics.com",
    "https://*.analytics.google.com",
    "https://www.googletagmanager.com",
    isDev ? "ws:" : null,
  ]
    .filter(Boolean)
    .join(" "),
  `frame-src ${frameSrc}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: `camera=${camera}, microphone=(), geolocation=(), payment=(), usb=()`,
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      {
        // TuCOPRamp only allows the apex origin, so the form breaks on www.
        source: "/:path*",
        has: [{ type: "host", value: `www.${CANONICAL_HOST}` }],
        destination: `https://${CANONICAL_HOST}/:path*`,
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
