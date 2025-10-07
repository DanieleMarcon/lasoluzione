// next.config.mjs
import createMDX from '@next/mdx';

/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  reactStrictMode: true,

  // 🔧 Disattivo MDX RS per evitare l'import virtuale `next-mdx-import-source-file`
  experimental: { mdxRs: false },

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

  pageExtensions: ['tsx', 'ts', 'mdx'],
};

const withMDX = createMDX({});
export default withMDX(nextConfig);
