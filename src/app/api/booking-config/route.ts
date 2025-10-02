import { NextResponse } from 'next/server';
import { DEFAULT_BOOKING_CONFIG_DTO, getBookingSettings, toBookingConfigDTO } from '@/lib/bookingSettings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  console.log('[GET /api/booking-config] start');
  try {
    const settings = await getBookingSettings();
    const dto = toBookingConfigDTO(settings);
    console.log('[GET /api/booking-config] ok');
    return NextResponse.json(dto);
  } catch (error) {
    console.error('[GET /api/booking-config] error', error);
    return NextResponse.json(DEFAULT_BOOKING_CONFIG_DTO, { status: 200 });
  }
}
