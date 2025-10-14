// src/app/admin/catalog/products/page.tsx
import { assertAdmin } from '@/lib/admin/session';
import { CatalogProductsPageClient } from '@/components/admin/catalog/ProductForm';

export const dynamic = 'force-dynamic';

export default async function AdminCatalogProductsPage() {
  await assertAdmin();
  return <CatalogProductsPageClient />;
}
