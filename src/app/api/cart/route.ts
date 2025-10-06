import { NextResponse } from 'next/server';
import { ensureCart, getCartByToken, toCartDTO } from '@/lib/cart';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? undefined;
  const existing = token ? await getCartByToken(token) : undefined;
  const cart = existing ?? (await ensureCart(token));
  return NextResponse.json({ ok: true, data: toCartDTO(cart) });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const token: string | undefined = body?.token ?? undefined;
  const cart = await ensureCart(token);
  return NextResponse.json({ ok: true, data: toCartDTO(cart) });
}
