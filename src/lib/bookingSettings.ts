import type { BookingType, Prisma } from '@prisma/client';

import { prisma } from './prisma';

import type { BookingConfigDTO } from '@/types/bookingConfig';

export type NormalizedBookingSettings = {
  enableDateTimeStep: boolean;
  fixedDate?: Date;
  fixedTime?: string;
  enabledTypes: BookingType[];
  typeLabels: Record<string, string>;
  prepayTypes: BookingType[];
  prepayAmountCents?: number;
  coverCents: number;
  lunchRequirePrepay: boolean;
  // 👇 campi cena
  dinnerCoverCents: number;
  dinnerRequirePrepay: boolean;
};

// ✅ aggiungi i default mancanti per cena
const DEFAULT_BOOKING_SETTINGS: NormalizedBookingSettings = {
  enableDateTimeStep: false,
  fixedDate: new Date('2025-12-20T00:00:00.000Z'),
  fixedTime: '19:00',
  enabledTypes: ['pranzo', 'cena', 'evento'],
  typeLabels: { pranzo: 'Pranzo', cena: 'Cena', evento: 'Serata Speciale' },
  prepayTypes: ['evento'],
  prepayAmountCents: 1500,
  coverCents: 0,
  lunchRequirePrepay: false,
  dinnerCoverCents: 0,
  dinnerRequirePrepay: false,
};

function asStringArray(value: Prisma.JsonValue | null | undefined, fallback: BookingType[]): BookingType[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is BookingType => typeof item === 'string') as BookingType[];
  }
  return fallback;
}

function asRecord(value: Prisma.JsonValue | null | undefined, fallback: Record<string, string>) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const entries = Object.entries(value).filter(([, v]) => typeof v === 'string');
    return Object.fromEntries(entries) as Record<string, string>;
  }
  return fallback;
}

export async function getBookingSettings(): Promise<NormalizedBookingSettings> {
  const row = await prisma.bookingSettings.findUnique({ where: { id: 1 } });

  if (!row) {
    return { ...DEFAULT_BOOKING_SETTINGS };
  }

  const enabledTypes = asStringArray(row.enabledTypes as Prisma.JsonValue, DEFAULT_BOOKING_SETTINGS.enabledTypes);
  const typeLabels = asRecord(row.typeLabels as Prisma.JsonValue, DEFAULT_BOOKING_SETTINGS.typeLabels);
  const prepayTypes = asStringArray(row.prepayTypes as Prisma.JsonValue, DEFAULT_BOOKING_SETTINGS.prepayTypes);

  return {
    enableDateTimeStep: row.enableDateTimeStep,
    fixedDate: row.fixedDate ?? DEFAULT_BOOKING_SETTINGS.fixedDate,
    fixedTime: row.fixedTime ?? DEFAULT_BOOKING_SETTINGS.fixedTime,
    enabledTypes: [...enabledTypes],
    typeLabels: { ...typeLabels },
    prepayTypes: [...prepayTypes],
    prepayAmountCents: row.prepayAmountCents ?? DEFAULT_BOOKING_SETTINGS.prepayAmountCents,
    coverCents: row.coverCents ?? DEFAULT_BOOKING_SETTINGS.coverCents,
    lunchRequirePrepay: row.lunchRequirePrepay ?? DEFAULT_BOOKING_SETTINGS.lunchRequirePrepay,
    dinnerCoverCents: (row as any).dinnerCoverCents ?? DEFAULT_BOOKING_SETTINGS.dinnerCoverCents,
    dinnerRequirePrepay: (row as any).dinnerRequirePrepay ?? DEFAULT_BOOKING_SETTINGS.dinnerRequirePrepay,
  };
}

// 🔧 includi anche 'tiers' nella factory del DTO
export function toBookingConfigDTO(
  settings: NormalizedBookingSettings,
  menu: BookingConfigDTO['menu'],
  tiers: BookingConfigDTO['tiers'] = { evento: [], aperitivo: [] },
): BookingConfigDTO {
  const fixedDate = settings.fixedDate?.toISOString().slice(0, 10);
  return {
    enableDateTimeStep: settings.enableDateTimeStep,
    ...(fixedDate ? { fixedDate } : {}),
    ...(settings.fixedTime ? { fixedTime: settings.fixedTime } : {}),
    enabledTypes: settings.enabledTypes,
    typeLabels: settings.typeLabels,
    prepayTypes: settings.prepayTypes,
    ...(settings.prepayAmountCents != null ? { prepayAmountCents: settings.prepayAmountCents } : {}),
    menu,
    tiers, // 👈 nuova proprietà richiesta dal tipo
  };
}

export function resolveBookingDate(
  settings: NormalizedBookingSettings,
  requestedDate: string,
  requestedTime: string,
): Date {
  const targetDate = settings.enableDateTimeStep
    ? requestedDate
    : settings.fixedDate?.toISOString().slice(0, 10) ?? requestedDate;
  const targetTime = settings.enableDateTimeStep ? requestedTime : settings.fixedTime ?? requestedTime;

  const iso = `${targetDate}T${targetTime}:00`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date/time configuration');
  }
  return date;
}

export function typeRequiresPrepay(settings: NormalizedBookingSettings, type: string): boolean {
  if (type === 'pranzo' && settings.lunchRequirePrepay) return true;
  if (type === 'cena' && settings.dinnerRequirePrepay) return true;
  return settings.prepayTypes.includes(type as BookingType);
}

// ✅ aggiungi dinnerCoverCents e tiers anche nel default
export const DEFAULT_BOOKING_CONFIG_DTO: BookingConfigDTO = toBookingConfigDTO(
  DEFAULT_BOOKING_SETTINGS,
  {
    dishes: [],
    coverCents: DEFAULT_BOOKING_SETTINGS.coverCents,
    dinnerCoverCents: DEFAULT_BOOKING_SETTINGS.dinnerCoverCents,
    lunchRequirePrepay: DEFAULT_BOOKING_SETTINGS.lunchRequirePrepay,
    dinnerRequirePrepay: DEFAULT_BOOKING_SETTINGS.dinnerRequirePrepay,
  },
  { evento: [], aperitivo: [] },
);
