// src/app/admin/tiers/page.tsx
import { headers } from 'next/headers';

import { assertAdmin } from '@/lib/admin/session';
import type { AdminTierRow, TiersMeta } from '@/components/admin/tiers/TiersManager';
import TiersManager from '@/components/admin/tiers/TiersManager';

const PAGE_SIZE = 20;

function resolveBaseUrl() {
  const headerList = headers();
  const forwardedProto = headerList.get('x-forwarded-proto');
  const forwardedHost = headerList.get('x-forwarded-host');
  const host = forwardedHost ?? headerList.get('host') ?? 'localhost:3000';
  const protocol = forwardedProto ?? (host.includes('localhost') ? 'http' : 'https');
  return process.env.NEXT_PUBLIC_APP_URL ?? `${protocol}://${host}`;
}

export default async function AdminTiersPage() {
  await assertAdmin();

  const baseUrl = resolveBaseUrl();
  const requestUrl = `${baseUrl}/api/admin/tiers?type=all&page=1&pageSize=${PAGE_SIZE}`;

  let initialTiers: AdminTierRow[] = [];
  let initialMeta: TiersMeta = {
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  };

  try {
    const response = await fetch(requestUrl, { cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (response.ok && body?.ok) {
      initialTiers = (body.data ?? []) as AdminTierRow[];
      const meta = body.meta ?? {};
      initialMeta = {
        page: meta.page ?? 1,
        pageSize: meta.pageSize ?? PAGE_SIZE,
        total: meta.total ?? initialTiers.length,
        totalPages: meta.totalPages ?? Math.max(1, Math.ceil((meta.total ?? initialTiers.length) / (meta.pageSize ?? PAGE_SIZE))),
      };
    } else {
      console.error('[admin][tiers][initial-load] API error', body?.error);
    }
  } catch (error) {
    console.error('[admin][tiers][initial-load] fetch error', error);
  }

  return <TiersManager initialTiers={initialTiers} initialMeta={initialMeta} />;
}
