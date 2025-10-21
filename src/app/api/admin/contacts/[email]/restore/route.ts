import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { ensureAdminContactsHiddenTable } from '@/lib/admin/contacts-service';
import { assertAdmin } from '@/lib/admin/session';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function decodeEmailParam(raw: string | string[] | undefined) {
  if (typeof raw !== 'string') return null;
  try {
    const decoded = decodeURIComponent(raw);
    return decoded.trim().length > 0 ? decoded.trim() : null;
  } catch {
    return null;
  }
}

function logAction(payload: { targetEmail: string; by?: string | null; ok: boolean; error?: unknown }) {
  if (process.env.NODE_ENV === 'production') return;
  const { targetEmail, by, ok, error } = payload;
  const logEntry: Record<string, unknown> = { action: 'restore', targetEmail, by: by ?? null, ok };
  if (!ok && error) {
    logEntry.error =
      error && typeof error === 'object'
        ? {
            name: (error as any)?.name,
            message: (error as any)?.message,
            code: (error as any)?.code,
          }
        : String(error);
  }
  console.log(logEntry);
}

export async function POST(_request: Request, context: { params: { email: string } }) {
  const session = await assertAdmin();
  const adminEmail = session.user?.email ?? null;

  const targetEmail = decodeEmailParam(context.params?.email);
  if (!targetEmail) {
    logAction({ targetEmail: context.params?.email ?? '', by: adminEmail, ok: false, error: 'invalid_email' });
    return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 });
  }

  try {
    await ensureAdminContactsHiddenTable();
    await prisma.$executeRaw(
      Prisma.sql`
        insert into public.admin_contacts_hidden(email, hidden, hidden_at, hidden_by)
        values (lower(${targetEmail}::text), ${false}::boolean, now(), ${adminEmail ?? null}::text)
        on conflict (email) do update
          set hidden = ${false}::boolean,
              hidden_at = now(),
              hidden_by = ${adminEmail ?? null}::text
      `,
    );
    logAction({ targetEmail, by: adminEmail, ok: true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logAction({ targetEmail, by: adminEmail, ok: false, error });
    console.error('[POST /api/admin/contacts/[email]/restore] error', { targetEmail, error });
    return NextResponse.json({ ok: false, error: 'restore_failed' }, { status: 500 });
  }
}
