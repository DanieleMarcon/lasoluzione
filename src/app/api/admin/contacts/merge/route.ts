import { NextResponse } from 'next/server';
import { z } from 'zod';

import { AdminUnauthorizedError, assertAdmin } from '@/lib/admin/session';
import { withAdminContactsHiddenGuard } from '@/lib/admin/contacts-service';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const mergeSchema = z
  .object({
    sourceEmails: z
      .array(z.string().email().transform((value) => value.trim().toLowerCase()))
      .min(1, 'source_required')
      .transform((values) => Array.from(new Set(values))),
    targetEmail: z.string().email().transform((value) => value.trim().toLowerCase()),
    targetName: z.string().trim().max(255).nullish(),
    targetPhone: z.string().trim().max(32).nullish(),
  })
  .superRefine((value, ctx) => {
    if (value.sourceEmails.includes(value.targetEmail)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'target_in_sources',
        path: ['targetEmail'],
      });
    }
  });

function buildUnauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function logAction(entry: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  console.log({ event: 'admin.contacts.merge', ...entry });
}

export async function POST(request: Request) {
  let session;
  try {
    session = await assertAdmin();
  } catch (error) {
    if (error instanceof AdminUnauthorizedError) {
      return buildUnauthorizedResponse();
    }
    throw error;
  }

  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const parsed = mergeSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const sourceEmails = parsed.data.sourceEmails.filter((email) => email !== parsed.data.targetEmail);
  const targetEmail = parsed.data.targetEmail;
  const targetName = parsed.data.targetName ? (parsed.data.targetName.length > 0 ? parsed.data.targetName : null) : null;
  const targetPhone = parsed.data.targetPhone ? (parsed.data.targetPhone.length > 0 ? parsed.data.targetPhone : null) : null;

  if (sourceEmails.length === 0) {
    return NextResponse.json({ ok: false, error: 'no_sources' }, { status: 400 });
  }

  let mergedCount = 0;
  try {
    mergedCount = await withAdminContactsHiddenGuard(() =>
      prisma.$transaction(async (tx) => {
        let total = 0;

        for (const source of sourceEmails) {
          const updated = await tx.$executeRaw`
            update public."Booking"
               set "email" = ${targetEmail}::text
             where lower("email") = ${source}::text
          `;
          total += Number(updated ?? 0);
        }

        if (targetName !== null || targetPhone !== null) {
          await tx.$executeRaw`
            update public."Booking"
               set "name"  = coalesce(${targetName}::text, "name"),
                   "phone" = coalesce(${targetPhone}::text, "phone")
             where lower("email") = ${targetEmail}::text
          `;
        }

        if (sourceEmails.length > 0) {
          await tx.$executeRaw`
            delete from public.admin_contacts_hidden
            where email = any(${sourceEmails}::text[])
          `;
        }

        await tx.$executeRaw`
          insert into public.admin_contacts_hidden (email, hidden, hidden_at, hidden_by)
          values (${targetEmail}::text, false, now(), ${session.user?.email ?? null}::text)
          on conflict (email) do update
            set hidden = excluded.hidden,
                hidden_at = excluded.hidden_at,
                hidden_by = excluded.hidden_by
        `;

        return total;
      }),
    );
  } catch (error) {
    console.error('contacts.merge error', { targetEmail, sourceEmails, error });
    return NextResponse.json({ ok: false, error: 'merge_failed' }, { status: 500 });
  }

  logAction({ by: session.user?.email ?? null, targetEmail, sources: sourceEmails, rows: mergedCount });

  return NextResponse.json({ ok: true, merged: mergedCount });
}
