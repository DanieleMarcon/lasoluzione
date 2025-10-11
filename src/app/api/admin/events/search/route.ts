import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { assertAdmin } from '@/lib/admin/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    await assertAdmin()

    const { searchParams } = new URL(req.url)
    const qRaw = (searchParams.get('q') || '').trim()
    const take = Math.min(Math.max(parseInt(searchParams.get('take') || '20', 10) || 20, 1), 50)

    // normalizza query: usiamo lo slug (lowercase) per avere matching "pratico" su SQLite
    if (!qRaw) {
      return NextResponse.json({ items: [] }, { status: 200 })
    }
    const q = qRaw.toLowerCase()
    const filters: Prisma.EventItemWhereInput[] = []

    if (q) {
      filters.push({ slug: { contains: q } })
    }

    if (qRaw) {
      filters.push({ title: { contains: qRaw } })
    }

    const items = await prisma.eventItem.findMany({
      where: {
        active: true,
        ...(filters.length ? { OR: filters } : {}),
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
