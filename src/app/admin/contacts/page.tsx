import { assertAdmin } from '@/lib/admin/session';
import ContactsPageClient from '@/components/admin/contacts/ContactsPageClient';

export const dynamic = 'force-dynamic';

export default async function AdminContactsPage() {
  await assertAdmin();
  return <ContactsPageClient />;
}
