// src/app/api/admin/settings/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { BookingType, Prisma } from '@prisma/client';

import { assertAdmin } from '@/lib/admin/session';
import { prisma } from '@/lib/prisma';
import { getBookingSettings } from '@/lib/bookingSettings';
import { toAdminSettingsDTO } from '@/lib/admin/settings-dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const settingsSchema = z
  .object({
    enableDateTimeStep: z.boolean(),
    fixedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    fixedTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    enabledTypes: z.array(z.string()).min(1),
    typeLabels: z.record(z.string()).default({}),
    prepayTypes: z.array(z.string()).default([]),
    prepayAmountCents: z.coerce.number().int().min(0).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.enableDateTimeStep) {
      if (!value.fixedDate) {
        ctx.addIssue({
          path: ['fixedDate'],
          code: z.ZodIssueCode.custom,
          message: 'Quando lo step data/ora è disabilitato serve una data fissa',
        });
      }
      if (!value.fixedTime) {
        ctx.addIssue({
          path: ['fixedTime'],
          code: z.ZodIssueCode.custom,
          message: 'Quando lo step data/ora è disabilitato serve un orario fisso',
        });
      }
    }
  });

function toDateOnly(value: string | null | undefined) {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

export async function GET() {
  await assertAdmin();
  const settings = await getBookingSettings();
  return NextResponse.json({ data: toAdminSettingsDTO(settings) });
}

export async function PUT(req: Request) {
  await assertAdmin();

  let payload;
  try {
    payload = settingsSchema.parse(await req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dati non validi', details: error.flatten() }, { status: 400 });
    }
    throw error;
  }

  const enabledTypes = payload.enabledTypes.map((type) => type as BookingType);
  const typeLabels: Record<string, string> = {};
  for (const type of enabledTypes) {
    const label = payload.typeLabels[type] ?? type;
    typeLabels[type] = label;
  }

  const sanitizedPrepayTypes = payload.prepayTypes
    .map((type) => type as BookingType)
    .filter((type) => enabledTypes.includes(type));

  const createData: Prisma.BookingSettingsCreateInput = {
    id: 1,
    enableDateTimeStep: payload.enableDateTimeStep,
    fixedDate: payload.enableDateTimeStep ? null : toDateOnly(payload.fixedDate),
    fixedTime: payload.enableDateTimeStep ? null : payload.fixedTime ?? null,
    enabledTypes: enabledTypes as unknown as Prisma.InputJsonValue,
    typeLabels: typeLabels as unknown as Prisma.InputJsonValue,
    prepayTypes: sanitizedPrepayTypes as unknown as Prisma.InputJsonValue,
    prepayAmountCents: payload.prepayAmountCents ?? null,
  };

  try {
    await prisma.bookingSettings.upsert({
      where: { id: 1 },
      update: {
        enableDateTimeStep: createData.enableDateTimeStep,
        fixedDate: createData.fixedDate,
        fixedTime: createData.fixedTime,
        enabledTypes: createData.enabledTypes,
        typeLabels: createData.typeLabels,
        prepayTypes: createData.prepayTypes,
        prepayAmountCents: createData.prepayAmountCents,
      },
      create: createData,
    });

    const normalized = await getBookingSettings();
    return NextResponse.json({ ok: true, data: toAdminSettingsDTO(normalized) });
  } catch (error) {
    console.error('[admin][PUT settings]', error);
    return NextResponse.json({ error: 'Impossibile salvare le impostazioni' }, { status: 500 });
  }
}
