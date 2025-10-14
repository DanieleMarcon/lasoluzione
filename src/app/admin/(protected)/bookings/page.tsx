// src/app/admin/bookings/page.tsx
import BookingsView from '@/components/admin/bookings/BookingsView';
import { fetchAdminSettingsDTO } from '@/lib/admin/settings-dto';

export default async function AdminBookingsPage() {
  const settings = await fetchAdminSettingsDTO();
  return <BookingsView settings={settings} />;
}
