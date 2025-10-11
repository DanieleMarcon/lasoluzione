import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function buildResponse() {
  const res = new NextResponse('Deprecated', { status: 410 });
  res.headers.set('x-handler', 'LEGACY-DEPRECATED:app/api/payments/email-verify/route.ts');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export async function GET() {
  return buildResponse();
}

export const POST = GET;
