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

function normalizeEmailParam(raw: string | undefined) {
  const decoded = raw ? decodeURIComponent(raw) : '';
  return emailParamSchema.safeParse({ email: decoded });
}

function buildUnauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function logAction(entry: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  console.log({
    event: 'admin.contacts.restore',
    ...entry,
  });
}

export async function POST(_request: Request, context: { params: { email?: string } }) {
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
        values (${targetEmail}::text, false, now(), ${session.user?.email ?? null}::text)
        on conflict (email) do update
          set hidden = excluded.hidden,
              hidden_at = excluded.hidden_at,
              hidden_by = excluded.hidden_by
      `,
    );
  } catch (error) {
    console.error('contacts.restore error', { targetEmail, error });
    return NextResponse.json({ ok: false, error: 'restore_failed' }, { status: 500 });
  }

  logAction({ by: session.user?.email ?? null, targetEmail, rows: Number(result ?? 0) });

  return NextResponse.json({ ok: true });
}
