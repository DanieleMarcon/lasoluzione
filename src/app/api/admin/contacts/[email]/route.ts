import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { ensureAdminContactsHiddenTable } from '@/lib/admin/contacts-service';
import { assertAdmin } from '@/lib/admin/session';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const updateSchema = z
  .object({
    name: z
      .string()
      .transform((value) => value.trim())
      .max(255)
      .nullish(),
    phone: z
      .string()
      .transform((value) => value.trim())
      .max(255)
      .nullish(),
  })
  .superRefine((value, ctx) => {
    if (value.name === undefined && value.phone === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Nessun campo da aggiornare' });
    }
  });

function decodeEmailParam(raw: string | string[] | undefined) {
  if (typeof raw !== 'string') return null;
  try {
    const decoded = decodeURIComponent(raw);
    return decoded.trim().length > 0 ? decoded.trim() : null;
  } catch {
    return null;
  }
}

function logAction(
  action: 'edit' | 'hide',
  payload: { targetEmail: string; by?: string | null; ok: boolean; error?: unknown },
) {
  if (process.env.NODE_ENV === 'production') return;
  const { targetEmail, by, ok, error } = payload;
  const logEntry: Record<string, unknown> = { action, targetEmail, by: by ?? null, ok };
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

export async function PATCH(request: Request, context: { params: { email: string } }) {
  const session = await assertAdmin();
  const adminEmail = session.user?.email ?? null;

  const targetEmail = decodeEmailParam(context.params?.email);
  if (!targetEmail) {
    logAction('edit', { targetEmail: context.params?.email ?? '', by: adminEmail, ok: false, error: 'invalid_email' });
    return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    logAction('edit', { targetEmail, by: adminEmail, ok: false, error: parsed.error });
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, phone } = parsed.data;

  try {
    await prisma.$executeRaw(
      Prisma.sql`
        update public."Booking"
           set "name"  = coalesce(${name ?? null}::text, "name"),
               "phone" = coalesce(${phone ?? null}::text, "phone")
         where lower("email") = lower(${targetEmail}::text)
      `,
    );
    logAction('edit', { targetEmail, by: adminEmail, ok: true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logAction('edit', { targetEmail, by: adminEmail, ok: false, error });
    console.error('[PATCH /api/admin/contacts/[email]] error', { targetEmail, error });
    return NextResponse.json({ ok: false, error: 'update_failed' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: { email: string } }) {
  const session = await assertAdmin();
  const adminEmail = session.user?.email ?? null;

  const targetEmail = decodeEmailParam(context.params?.email);
  if (!targetEmail) {
    logAction('hide', { targetEmail: context.params?.email ?? '', by: adminEmail, ok: false, error: 'invalid_email' });
    return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 });
  }

  try {
    await ensureAdminContactsHiddenTable();
    await prisma.$executeRaw(
      Prisma.sql`
        insert into public.admin_contacts_hidden(email, hidden, hidden_at, hidden_by)
        values (lower(${targetEmail}::text), ${true}::boolean, now(), ${adminEmail ?? null}::text)
        on conflict (email) do update
          set hidden = ${true}::boolean,
              hidden_at = now(),
              hidden_by = ${adminEmail ?? null}::text
      `,
    );
    logAction('hide', { targetEmail, by: adminEmail, ok: true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logAction('hide', { targetEmail, by: adminEmail, ok: false, error });
    console.error('[DELETE /api/admin/contacts/[email]] error', { targetEmail, error });
    return NextResponse.json({ ok: false, error: 'hide_failed' }, { status: 500 });
  }
}
