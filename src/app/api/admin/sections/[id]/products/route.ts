import { NextResponse } from 'next/server';
import { z } from 'zod';

import { assertAdmin } from '@/lib/admin/session';
import { prisma } from '@/lib/prisma';
import { AssignSchema } from '@/types/admin-catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({
  id: z
    .string()
    .transform((value) => Number.parseInt(value, 10))
    .pipe(z.number().int().min(1, 'ID sezione non valido')),
});

export async function POST(request: Request, context: { params: { id: string } }) {
  await assertAdmin();

  const parsedParams = paramsSchema.safeParse(context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ ok: false, error: parsedParams.error.flatten() }, { status: 400 });
  }

  const sectionId = parsedParams.data.id;
  const payload = await request.json().catch(() => null);
  const parsedBody = AssignSchema.safeParse(payload);
  if (!parsedBody.success) {
    return NextResponse.json({ ok: false, error: parsedBody.error.flatten() }, { status: 400 });
  }

  const { productId, order, featured, showInHome } = parsedBody.data;

  const [section, product] = await Promise.all([
    prisma.catalogSection.findUnique({ where: { id: sectionId } }),
    prisma.product.findUnique({ where: { id: productId } }),
  ]);

  if (!section) {
    return NextResponse.json({ ok: false, error: 'section_not_found' }, { status: 404 });
  }
  if (!product) {
    return NextResponse.json({ ok: false, error: 'product_not_found' }, { status: 404 });
  }

  const updateData: Parameters<typeof prisma.sectionProduct.upsert>[0]['update'] = {};
  if (order !== undefined) updateData.order = order;
  if (featured !== undefined) updateData.featured = featured;
  if (showInHome !== undefined) updateData.showInHome = showInHome;

  try {
    const assigned = await prisma.sectionProduct.upsert({
      where: {
        sectionId_productId: {
          sectionId,
          productId,
        },
      },
      update: updateData,
      create: {
        sectionId,
        productId,
        order: order ?? 0,
        featured: featured ?? false,
        showInHome: showInHome ?? false,
      },
    });

    return NextResponse.json({ ok: true, data: assigned });
  } catch (error) {
    console.error('[POST /api/admin/sections/[id]/products] error', error);
    return NextResponse.json({ ok: false, error: 'assignment_failed' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: { id: string } }) {
  await assertAdmin();

  const parsedParams = paramsSchema.safeParse(context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ ok: false, error: parsedParams.error.flatten() }, { status: 400 });
  }

  const sectionId = parsedParams.data.id;
  const { searchParams } = new URL(request.url);
  let productId: number | null = null;

  const paramValue = searchParams.get('productId');
  if (paramValue) {
    const parsed = Number.parseInt(paramValue, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      productId = parsed;
    }
  }

  if (productId == null) {
    const body = await request.json().catch(() => null);
    if (body && typeof body === 'object') {
      const parsedBody = AssignSchema.pick({ productId: true }).safeParse(body);
      if (parsedBody.success) {
        productId = parsedBody.data.productId;
      }
    }
  }

  if (productId == null) {
    return NextResponse.json({ ok: false, error: 'productId_required' }, { status: 400 });
  }

  try {
    await prisma.sectionProduct.delete({
      where: {
        sectionId_productId: {
          sectionId,
          productId,
        },
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ ok: false, error: 'assignment_not_found' }, { status: 404 });
    }
    console.error('[DELETE /api/admin/sections/[id]/products] error', error);
    return NextResponse.json({ ok: false, error: 'delete_failed' }, { status: 500 });
  }
}
