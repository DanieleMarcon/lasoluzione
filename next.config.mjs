/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    mdxRs: true
  },
  // Esempio: consenti domini immagini quando necessario
  images: { remotePatterns: [] },
  async headers() {
    // TODO: regola le policy (SiteGround/CDN) prima del deploy
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "font-src 'self' data:",
      "frame-src 'self'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ');
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" }
        ]
      }
    ];
  },
  pageExtensions: ["tsx", "ts", "mdx"]
};

import createMDX from "@next/mdx";
const withMDX = createMDX({});
export default withMDX(nextConfig);
