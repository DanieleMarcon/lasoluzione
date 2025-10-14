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

const optionalAssetUrl = z
  .string()
  .trim()
  .url()
  .or(z.literal(''))
  .or(z.literal(null))
  .optional();

const siteConfigSchema = z
  .object({
    brandLogoUrl: optionalAssetUrl,
    heroImageUrl: optionalAssetUrl,
    footerRibbonUrl: optionalAssetUrl,
  })
  .partial()
  .optional();

const settingsSchema = z
  .object({
    enableDateTimeStep: z.boolean(),
    fixedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    fixedTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    enabledTypes: z.array(z.string()).min(1),
    typeLabels: z.record(z.string()).default({}),
    prepayTypes: z.array(z.string()).default([]),
    prepayAmountCents: z.coerce.number().int().min(0).max(1_000_000).nullable().optional(),
    coverCents: z.coerce.number().int().min(0).max(1_000_000).default(0),
    lunchRequirePrepay: z.boolean().default(false),
    dinnerCoverCents: z.coerce.number().int().min(0).max(1_000_000).default(0),
    dinnerRequirePrepay: z.boolean().default(false),
    siteBrandLogoUrl: optionalAssetUrl,
    siteHeroImageUrl: optionalAssetUrl,
    siteFooterRibbonUrl: optionalAssetUrl,
    site: siteConfigSchema,
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

function sanitizeAssetUrl(value: string | null | undefined) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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
  const allowedTypes = new Set<BookingType>(['pranzo', 'cena', 'aperitivo', 'evento']);
  if (!enabledTypes.every((type) => allowedTypes.has(type))) {
    return NextResponse.json({ error: 'Tipologia non valida' }, { status: 400 });
  }
  const typeLabels: Record<string, string> = {};
  for (const type of enabledTypes) {
    const label = payload.typeLabels[type] ?? type;
    typeLabels[type] = label;
  }

  const sanitizedPrepayTypes = payload.prepayTypes
    .map((type) => type as BookingType)
    .filter((type) => enabledTypes.includes(type));

  const siteBrandLogoUrl = sanitizeAssetUrl(payload.site?.brandLogoUrl ?? payload.siteBrandLogoUrl);
  const siteHeroImageUrl = sanitizeAssetUrl(payload.site?.heroImageUrl ?? payload.siteHeroImageUrl);
  const siteFooterRibbonUrl = sanitizeAssetUrl(
    payload.site?.footerRibbonUrl ?? payload.siteFooterRibbonUrl,
  );

  const siteConfig = {
    brandLogoUrl: siteBrandLogoUrl,
    heroImageUrl: siteHeroImageUrl,
    footerRibbonUrl: siteFooterRibbonUrl,
  } as Prisma.InputJsonValue;

  const createData: Prisma.BookingSettingsCreateInput = {
    id: 1,
    enableDateTimeStep: payload.enableDateTimeStep,
    fixedDate: payload.enableDateTimeStep ? null : toDateOnly(payload.fixedDate),
    fixedTime: payload.enableDateTimeStep ? null : payload.fixedTime ?? null,
    enabledTypes: enabledTypes as unknown as Prisma.InputJsonValue,
    typeLabels: typeLabels as unknown as Prisma.InputJsonValue,
    prepayTypes: sanitizedPrepayTypes as unknown as Prisma.InputJsonValue,
    prepayAmountCents: payload.prepayAmountCents ?? null,
    coverCents: payload.coverCents,
    lunchRequirePrepay: payload.lunchRequirePrepay,
    dinnerCoverCents: payload.dinnerCoverCents,
    dinnerRequirePrepay: payload.dinnerRequirePrepay,
    siteBrandLogoUrl,
    siteHeroImageUrl,
    siteFooterRibbonUrl,
    site: siteConfig,
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
        coverCents: createData.coverCents,
        lunchRequirePrepay: createData.lunchRequirePrepay,
        dinnerCoverCents: createData.dinnerCoverCents,
        dinnerRequirePrepay: createData.dinnerRequirePrepay,
        siteBrandLogoUrl: createData.siteBrandLogoUrl,
        siteHeroImageUrl: createData.siteHeroImageUrl,
        siteFooterRibbonUrl: createData.siteFooterRibbonUrl,
        site: createData.site,
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

const patchSchema = z.object({
  coverCents: z.coerce.number().int().min(0),
  lunchRequirePrepay: z.boolean(),
  dinnerCoverCents: z.coerce.number().int().min(0),
  dinnerRequirePrepay: z.boolean(),
});

export async function PATCH(req: Request) {
  await assertAdmin();

  let payload;
  try {
    payload = patchSchema.parse(await req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dati non validi', details: error.flatten() }, { status: 400 });
    }
    throw error;
  }

  try {
    await prisma.bookingSettings.upsert({
      where: { id: 1 },
      update: {
        coverCents: payload.coverCents,
        lunchRequirePrepay: payload.lunchRequirePrepay,
        dinnerCoverCents: payload.dinnerCoverCents,
        dinnerRequirePrepay: payload.dinnerRequirePrepay,
      },
      create: {
        id: 1,
        enableDateTimeStep: true,
        fixedDate: null,
        fixedTime: null,
        enabledTypes: ['pranzo', 'cena', 'evento'],
        typeLabels: { pranzo: 'Pranzo', cena: 'Cena', evento: 'Evento' },
        prepayTypes: [],
        prepayAmountCents: null,
        coverCents: payload.coverCents,
        lunchRequirePrepay: payload.lunchRequirePrepay,
        dinnerCoverCents: payload.dinnerCoverCents,
        dinnerRequirePrepay: payload.dinnerRequirePrepay,
      },
    });

    const normalized = await getBookingSettings();
    return NextResponse.json({ ok: true, data: toAdminSettingsDTO(normalized) });
  } catch (error) {
    console.error('[admin][PATCH settings]', error);
    return NextResponse.json({ error: 'Impossibile aggiornare le impostazioni' }, { status: 500 });
  }
}
