import { NextResponse } from 'next/server';
import {
  DEFAULT_BOOKING_CONFIG_DTO,
  getBookingSettings,
  toBookingConfigDTO,
} from '@/lib/bookingSettings';
import { prisma } from '@/lib/prisma';
import type { BookingTierDTO, BookingTiersDTO } from '@/types/bookingConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  console.log('[GET /api/booking-config] start');
  try {
    const settings = await getBookingSettings();

    const dishes = await prisma.menuDish.findMany({
      where: { active: true },
      orderBy: [{ order: 'asc' }, { category: 'asc' }, { name: 'asc' }],
    });

    const tierRows = await prisma.eventTier.findMany({
      where: { active: true },
      orderBy: [{ type: 'asc' }, { order: 'asc' }, { label: 'asc' }],
    });

    const tiers = tierRows.reduce<BookingTiersDTO>((acc, tier) => {
      if (tier.type === 'evento' || tier.type === 'aperitivo') {
        const dto: BookingTierDTO = {
          id: tier.id,
          type: tier.type,
          label: tier.label,
          priceCents: tier.priceCents,
          active: tier.active,
          order: tier.order,
        };
        acc[tier.type].push(dto);
      }
      return acc;
    }, { evento: [], aperitivo: [] });

    const menu = {
      dishes: dishes.map((dish) => ({
        id: dish.id,
        name: dish.name,
        slug: dish.slug,
        description: dish.description ?? undefined,
        priceCents: dish.priceCents,
        active: dish.active,
        category: dish.category ?? undefined,
        order: dish.order,
        // visibilità pranzo/cena/both richiesta dal DTO
        visibleAt: (dish as any).visibleAt as 'lunch' | 'dinner' | 'both',
      })),
      coverCents: settings.coverCents,
      dinnerCoverCents: settings.dinnerCoverCents ?? 0, // <- aggiunto
      lunchRequirePrepay: settings.lunchRequirePrepay,
      dinnerRequirePrepay: settings.dinnerRequirePrepay ?? false,
    };

    const dto = { ...toBookingConfigDTO(settings, menu), tiers };
    console.log('[GET /api/booking-config] ok');
    return NextResponse.json(dto);
  } catch (error) {
    console.error('[GET /api/booking-config] error', error);
    // fallback sicuro
    return NextResponse.json(DEFAULT_BOOKING_CONFIG_DTO, { status: 200 });
  }
}
