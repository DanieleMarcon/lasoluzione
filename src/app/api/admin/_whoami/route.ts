import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ ok: false, error: 'Disabled in production' }, { status: 404 });
  }

  const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET! });
  const email = (token?.email || '').toLowerCase();
  const allowed = (process.env.ADMIN_EMAILS || '')
    .split(/[,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  return NextResponse.json({
    ok: true,
    env: {
      NEXTAUTH_SET: Boolean(process.env.NEXTAUTH_SECRET),
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || null,
      MAIL_FROM: process.env.MAIL_FROM || null,
      SMTP_HOST: process.env.SMTP_HOST || null,
      SMTP_PORT: process.env.SMTP_PORT || null,
    },
    token: {
      email,
      raw: token || null,
    },
    whitelist: allowed,
  });
}
