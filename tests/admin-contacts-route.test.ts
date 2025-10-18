import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

process.env.NEXTAUTH_SECRET ||= 'test-secret';
process.env.MAIL_FROM ||= 'noreply@example.com';
process.env.SMTP_HOST ||= 'smtp.example.com';
process.env.SMTP_USER ||= 'user';
process.env.SMTP_PASS ||= 'pass';

async function loadRoute(assertOverride?: () => Promise<unknown>) {
  const sessionNamespace = await import('@/lib/admin/session');
  const sessionModule = (sessionNamespace as any).default ?? sessionNamespace;
  if (assertOverride) {
    sessionModule.setAssertAdminImpl(assertOverride);
  }

  const [routeModule, prismaModule] = await Promise.all([
    import('@/app/api/admin/contacts/route'),
    import('@/lib/prisma'),
  ]);

  return { GET: routeModule.GET, sessionModule, prisma: prismaModule.prisma };
}

describe('GET /api/admin/contacts', () => {
  it('returns an empty payload when no contacts are found', { concurrency: false }, async () => {
    const { GET, sessionModule, prisma } = await loadRoute(async () => undefined);
    const responses: Array<unknown> = [
      [],
      [{ total: 0n }],
    ];
    const calls: Array<unknown[]> = [];
    const originalQueryRaw = prisma.$queryRaw.bind(prisma);
    (prisma as any).$queryRaw = async (...args: unknown[]) => {
      calls.push(args);
      return responses.shift() ?? [];
    };

    try {
      const response = await GET(new Request('https://example.com/api/admin/contacts'));
      assert.equal(response.status, 200);

      const payload = (await response.json()) as any;
      assert.deepEqual(payload.items, []);
      assert.equal(payload.page, 1);
      assert.equal(payload.pageSize, 20);
      assert.equal(payload.total, 0);
      assert.equal(payload.totalPages, 0);
      assert.equal(calls.length, 2);
    } finally {
      sessionModule.resetAssertAdminImpl();
      (prisma as any).$queryRaw = originalQueryRaw;
      mock.restoreAll();
    }
  });

  it('applies filters and returns normalized contacts', { concurrency: false }, async () => {
    const { GET, sessionModule, prisma } = await loadRoute(async () => undefined);

    const createdAt = new Date('2024-03-10T12:30:00.000Z');
    const responses: Array<unknown> = [
      [
        {
          id: 1,
          name: '  Anna Verdi  ',
          email: ' ANNA@example.com ',
          phone: ' 1234567890 ',
          agreePrivacy: 1,
          agreeMarketing: true,
          createdAt,
          totalBookings: 3,
        },
      ],
      [{ total: 1n }],
    ];
    const calls: Array<unknown[]> = [];
    const originalQueryRaw = prisma.$queryRaw.bind(prisma);
    (prisma as any).$queryRaw = async (...args: unknown[]) => {
      calls.push(args);
      return responses.shift() ?? [];
    };

    try {
      const response = await GET(
        new Request('https://example.com/api/admin/contacts?q=anna&newsletter=true'),
      );

      assert.equal(response.status, 200);

      const payload = (await response.json()) as any;
      assert.equal(payload.items.length, 1);
      assert.deepEqual(payload.items[0], {
        name: 'Anna Verdi',
        email: 'ANNA@example.com',
        phone: '1234567890',
        createdAt: createdAt.toISOString(),
        agreePrivacy: true,
        agreeMarketing: true,
        totalBookings: 3,
      });
      assert.equal(payload.page, 1);
      assert.equal(payload.pageSize, 20);
      assert.equal(payload.total, 1);
      assert.equal(payload.totalPages, 1);
      assert.equal(calls.length, 2);

      const firstCall = calls[0];
      const sqlArg = firstCall?.[0] as { values?: unknown[] } | undefined;
      assert(sqlArg && Array.isArray(sqlArg.values));
      assert(sqlArg.values?.includes('%anna%'));
    } finally {
      sessionModule.resetAssertAdminImpl();
      (prisma as any).$queryRaw = originalQueryRaw;
      mock.restoreAll();
    }
  });
});
