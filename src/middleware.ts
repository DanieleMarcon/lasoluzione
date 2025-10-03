// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

function parseWhitelist(input?: string) {
  return (input || '')
    .split(/[,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // BYPASS: route che non vanno mai protette
  const bypass =
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.startsWith('/public/') ||
    pathname === '/admin/signin' ||
    pathname === '/admin/not-authorized';

  if (bypass) return NextResponse.next();

  // Proteggi solo /admin e /api/admin
  const needsAdmin = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');

  if (!needsAdmin) return NextResponse.next();

  // Verifica sessione
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET! });
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = '/admin/signin';
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  // White-list email
  const allowed = parseWhitelist(process.env.ADMIN_EMAILS);
  const email = (token.email || '').toLowerCase();

  if (allowed.length && (!email || !allowed.includes(email))) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[ADMIN GUARD] Email not allowed', { email, allowed });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/admin/not-authorized';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/api/auth/:path*'],
};
