import { NextResponse } from 'next/server';
import { z } from 'zod';

import { AdminUnauthorizedError, assertAdmin } from '@/lib/admin/session';
import { withAdminContactsHiddenGuard } from '@/lib/admin/contacts-service';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const emailParamSchema = z.object({
  email: z
    .string()
    .min(1, 'email_required')
    .transform((value) => value.trim())
    .pipe(z.string().email('email_invalid')),
});

const updateSchema = z.object({
  name: z.string().trim().max(255).nullish(),
  phone: z.string().trim().max(32).nullish(),
});

function normalizeEmailParam(raw: string | undefined) {
  const decoded = raw ? decodeURIComponent(raw) : '';
  return emailParamSchema.safeParse({ email: decoded });
}

function buildUnauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function logAction(action: 'edit' | 'hide' | 'restore', entry: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  console.log({
    event: `admin.contacts.${action}`,
    ...entry,
  });
}

export async function PATCH(request: Request, context: { params: { email?: string } }) {
  let session;
  try {
    session = await assertAdmin();
  } catch (error) {
    if (error instanceof AdminUnauthorizedError) {
      return buildUnauthorizedResponse();
    }
    throw error;
  }

  const parsedEmail = normalizeEmailParam(context.params?.email);
  if (!parsedEmail.success) {
    return NextResponse.json({ ok: false, error: parsedEmail.error.flatten() }, { status: 400 });
  }

  const targetEmail = parsedEmail.data.email.toLowerCase();

  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const parsedBody = updateSchema.safeParse(payload);
  if (!parsedBody.success) {
    return NextResponse.json({ ok: false, error: parsedBody.error.flatten() }, { status: 400 });
  }

  const name = parsedBody.data.name ?? null;
  const phone = parsedBody.data.phone ?? null;

  if (name === null && phone === null) {
    return NextResponse.json({ ok: true, noop: true });
  }

  let updated: number | bigint;
  try {
    updated = await prisma.$executeRaw`
      update public."Booking"
         set "name"  = coalesce(${name}::text, "name"),
             "phone" = coalesce(${phone}::text, "phone")
       where lower("email") = lower(${targetEmail}::text)
    `;
  } catch (error) {
    console.error('contacts.edit error', { targetEmail, error });
    return NextResponse.json({ ok: false, error: 'update_failed' }, { status: 500 });
  }

  logAction('edit', {
    by: session.user?.email ?? null,
    targetEmail,
    rows: Number(updated ?? 0),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: { params: { email?: string } }) {
  let session;
  try {
    session = await assertAdmin();
  } catch (error) {
    if (error instanceof AdminUnauthorizedError) {
      return buildUnauthorizedResponse();
    }
    throw error;
  }

  const parsedEmail = normalizeEmailParam(context.params?.email);
  if (!parsedEmail.success) {
    return NextResponse.json({ ok: false, error: parsedEmail.error.flatten() }, { status: 400 });
  }

  const targetEmail = parsedEmail.data.email.toLowerCase();

  let result: number | bigint;
  try {
    result = await withAdminContactsHiddenGuard(() =>
      prisma.$executeRaw`
        insert into public.admin_contacts_hidden (email, hidden, hidden_at, hidden_by)
        values (${targetEmail}::text, true, now(), ${session.user?.email ?? null}::text)
        on conflict (email) do update
          set hidden = excluded.hidden,
              hidden_at = excluded.hidden_at,
              hidden_by = excluded.hidden_by
      `,
    );
  } catch (error) {
    console.error('contacts.hide error', { targetEmail, error });
    return NextResponse.json({ ok: false, error: 'hide_failed' }, { status: 500 });
  }

  logAction('hide', {
    by: session.user?.email ?? null,
    targetEmail,
    rows: Number(result ?? 0),
  });

  return NextResponse.json({ ok: true });
}
