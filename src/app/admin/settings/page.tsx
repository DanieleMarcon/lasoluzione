// src/app/admin/settings/page.tsx
import { BookingType } from '@prisma/client';

import SettingsForm from '@/components/admin/settings/SettingsForm';
import { fetchAdminSettingsDTO } from '@/lib/admin/settings-dto';

export default async function AdminSettingsPage() {
  const settings = await fetchAdminSettingsDTO();
  const allTypes = Object.values(BookingType);
  return <SettingsForm settings={settings} allTypes={allTypes} />;
}
