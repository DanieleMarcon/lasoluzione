// next.config.mjs
import createMDX from '@next/mdx';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const isProd = process.env.NODE_ENV === 'production';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Abilita il compilatore MDX di Next
  experimental: { mdxRs: true },

  // Estensioni di pagina supportate
  pageExtensions: ['tsx', 'ts', 'mdx'],

  images: { remotePatterns: [] },

  webpack(config) {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@mdx-js/react': path.join(__dirname, 'src/lib/mdx-react-stub.tsx'),
      '@revolut/checkout': path.join(__dirname, 'src/lib/revolut-checkout.ts'),
    };
    return config;
  },

  async headers() {
    // In dev lasciamo 'unsafe-eval' per Fast Refresh; in prod lo togliamo.
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      // Consente l'embed di Google Maps
      "frame-src 'self' https://www.google.com https://*.google.com https://www.google.it https://*.google.it",
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
          // Non blocca il tuo iframe in uscita verso Google; impedisce solo che *il tuo sito* venga iframato da terzi.
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
};

// MDX plugin base
const withMDX = createMDX({
  extension: /\.mdx?$/,
});

export default withMDX(nextConfig);
