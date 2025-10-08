// next.config.mjs
/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  reactStrictMode: true,

  images: { remotePatterns: [] },

  async headers() {
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"} https://*.revolut.com`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.revolut.com",
      "frame-src 'self' https://www.google.com https://*.google.com https://www.google.it https://*.google.it https://*.revolut.com",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },

};
export default nextConfig;
