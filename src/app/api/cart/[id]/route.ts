import { NextResponse } from 'next/server';
import { getCartByToken, toCartDTO } from '@/lib/cart';

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  const cart = await getCartByToken(params.id);
  if (!cart) return NextResponse.json({ ok: false, error: 'Cart not found' }, { status: 404 });
  return NextResponse.json({ ok: true, data: toCartDTO(cart) });
}
