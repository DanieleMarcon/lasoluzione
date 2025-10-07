// src/app/api/cart/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ensureCart, getCartByToken, toCartDTO } from '@/lib/cart';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COOKIE_NAME = 'cart_token';
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 30, // 30 giorni
};

async function getOrCreateCartFromCookie() {
  const jar = cookies();
  const cookieToken = jar.get(COOKIE_NAME)?.value || null;

  let cart = cookieToken ? await getCartByToken(cookieToken) : null;
  if (!cart) cart = await ensureCart(null);

  if (jar.get(COOKIE_NAME)?.value !== cart.id) {
    jar.set(COOKIE_NAME, cart.id, COOKIE_OPTS);
  }

  return cart;
}

export async function GET() {
  const cart = await getOrCreateCartFromCookie();
  return NextResponse.json({ ok: true, data: toCartDTO(cart) });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = typeof body?.token === 'string' && body.token ? body.token : null;

  let cart = token ? await getCartByToken(token) : null;
  if (!cart) cart = await ensureCart(token);

  const jar = cookies();
  if (jar.get(COOKIE_NAME)?.value !== cart.id) {
    jar.set(COOKIE_NAME, cart.id, COOKIE_OPTS);
  }

  return NextResponse.json({ ok: true, data: toCartDTO(cart) });
}
