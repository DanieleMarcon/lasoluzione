import { NextResponse } from 'next/server';

import { verifyJwt } from '@/lib/jwt';
import { logger } from '@/lib/logger';

const VERIFY_COOKIE = 'order_verify_token';
const VERIFY_TOKEN_TTL_SECONDS = 15 * 60;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new NextResponse('Token non valido o scaduto', { status: 400 });
    }

    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error('[payments][email-verify] missing NEXTAUTH_SECRET');
      return new NextResponse('Token non valido o scaduto', { status: 400 });
    }

    const verification = verifyJwt<Record<string, unknown>>(token, secret);
    if (!verification.valid) {
      return new NextResponse('Token non valido o scaduto', { status: 400 });
    }

    const payload = verification.payload || {};
    const email = typeof payload.email === 'string' ? payload.email : null;

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ??
      process.env.APP_BASE_URL ??
      process.env.BASE_URL ??
      'http://localhost:3000';
    const normalizedBase = baseUrl.replace(/\/$/, '');
    const redirectUrl = `${normalizedBase}/checkout?verified=1`;

    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set({
      name: VERIFY_COOKIE,
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: VERIFY_TOKEN_TTL_SECONDS,
      path: '/',
    });

    logger.info('order.verify.ok', { action: 'order.verify.ok', email });

    return response;
  } catch (error) {
    console.error('[payments][email-verify] error', error);
    return new NextResponse('Token non valido o scaduto', { status: 400 });
  }
}
