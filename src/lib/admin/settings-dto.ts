// src/lib/admin/settings-dto.ts
import { getBookingSettings } from '@/lib/bookingSettings';
import type { AdminSettingsDTO } from '@/types/admin';

export async function fetchAdminSettingsDTO(): Promise<AdminSettingsDTO> {
  const settings = await getBookingSettings();
  return toAdminSettingsDTO(settings);
}

export function toAdminSettingsDTO(settings: Awaited<ReturnType<typeof getBookingSettings>>): AdminSettingsDTO {
  return {
    enableDateTimeStep: settings.enableDateTimeStep,
    fixedDate: settings.fixedDate ? settings.fixedDate.toISOString().slice(0, 10) : null,
    fixedTime: settings.fixedTime ?? null,
    enabledTypes: settings.enabledTypes,
    typeLabels: settings.typeLabels,
    prepayTypes: settings.prepayTypes,
    prepayAmountCents: settings.prepayAmountCents ?? null,
  };
}
