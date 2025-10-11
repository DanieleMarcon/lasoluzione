import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const qRaw = (searchParams.get('q') || '').trim()
    const take = Math.min(Math.max(parseInt(searchParams.get('take') || '20', 10) || 20, 1), 50)

    // normalizza query: usiamo lo slug (lowercase) per avere matching "pratico" su SQLite
    const q = qRaw.toLowerCase()

    const items = await prisma.eventItem.findMany({
      where: {
        active: true,
        OR: [
          // slug in genere è lowercase: questo dà di fatto case-insensitive
          q ? { slug: { contains: q } } : undefined,
          // fallback sul titolo senza `mode` (SQLite non lo supporta)
          qRaw ? { title: { contains: qRaw } } : undefined,
        ].filter(Boolean) as any,
      },
      orderBy: { startAt: 'asc' },
      take,
      select: {
        id: true,
        title: true,
        slug: true,
        priceCents: true,
        startAt: true,
      },
    })

    return NextResponse.json({ items }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Search failed' }, { status: 500 })
  }
}
