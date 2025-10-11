import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const payload = {
  ok: false,
  error: 'deprecated_route',
  message: 'Use /api/payments/email-verify for booking confirmations.',
};

export async function GET() {
  return NextResponse.json(payload, { status: 410 });
}

export async function POST() {
  return NextResponse.json(payload, { status: 410 });
}
