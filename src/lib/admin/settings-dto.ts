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
    coverCents: settings.coverCents,
    lunchRequirePrepay: settings.lunchRequirePrepay,
    dinnerCoverCents: settings.dinnerCoverCents,
    dinnerRequirePrepay: settings.dinnerRequirePrepay,
    siteBrandLogoUrl: settings.site.brandLogoUrl ?? null,
    siteHeroImageUrl: settings.site.heroImageUrl ?? null,
    siteFooterRibbonUrl: settings.site.footerRibbonUrl ?? null,
    site: {
      brandLogoUrl: settings.site.brandLogoUrl ?? null,
      heroImageUrl: settings.site.heroImageUrl ?? null,
      footerRibbonUrl: settings.site.footerRibbonUrl ?? null,
    },
  };
}
