// src/app/api/newsletter/route.ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get('email') || '');
  if (!email) {
    return NextResponse.json({ ok: false, error: 'Email mancante' }, { status: 400 });
  }
  // TODO: invio email di conferma (double opt-in)
  return NextResponse.json({ ok: true, message: 'Controlla la tua email per confermare.' });
}
