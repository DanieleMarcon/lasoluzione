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

async function getOrCreate(tokenCandidate?: string | null) {
  let cart = tokenCandidate ? await getCartByToken(tokenCandidate) : null;
  if (!cart) cart = await ensureCart(null);
  return cart;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tokenFromQuery = url.searchParams.get('token');
  const jar = cookies();
  const tokenFromCookie = jar.get(COOKIE_NAME)?.value || null;

  // priorità: query ?token=... (per compatibilità con il client) → cookie → crea
  const cart = await getOrCreate(tokenFromQuery || tokenFromCookie || null);

  if (jar.get(COOKIE_NAME)?.value !== cart.id) {
    jar.set(COOKIE_NAME, cart.id, COOKIE_OPTS);
  }

  return NextResponse.json({ ok: true, data: toCartDTO(cart) });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { token?: string };
  const jar = cookies();
  const incoming = body?.token || jar.get(COOKIE_NAME)?.value || null;

  const cart = await getOrCreate(incoming);

  if (jar.get(COOKIE_NAME)?.value !== cart.id) {
    jar.set(COOKIE_NAME, cart.id, COOKIE_OPTS);
  }

  return NextResponse.json({ ok: true, data: toCartDTO(cart) });
}
