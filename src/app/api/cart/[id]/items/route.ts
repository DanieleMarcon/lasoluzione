// src/app/api/cart/[id]/items/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Body per ADD/UPDATE riga carrello
const upsertSchema = z
  .object({
    productId: z.coerce.number().int().positive().optional(),
    eventItemId: z.string().cuid().optional(),
    qty: z.coerce.number().int().min(0).optional(), // 0 => rimozione
    nameSnapshot: z.string().trim().min(1).optional(),
    priceCentsSnapshot: z.coerce.number().int().min(0).optional(),
    imageUrlSnapshot: z.string().url().optional(),
    // meta opzionale (se null, per compat ora lo ignoriamo)
    meta: z.union([z.record(z.any()), z.null()]).optional(),
  })
  .superRefine((data, ctx) => {
    const hasProduct = typeof data.productId === 'number';
    const hasEvent = typeof data.eventItemId === 'string' && data.eventItemId.length > 0;
    if (hasProduct === hasEvent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'product_or_event_required',
      });
    }
  });

type RouteContext = { params: { id: string } };
type SumItem = { priceCentsSnapshot: number; qty: number };

type EventItemSummary = {
  id: string;
  slug: string;
  title: string;
  priceCents: number;
};

async function ensureEventProduct(eventItem: EventItemSummary) {
  const existing = await prisma.product.findFirst({
    where: { sourceType: 'event_item', sourceId: eventItem.id },
    select: { id: true },
  });

  if (existing) {
    await prisma.product.update({
      where: { id: existing.id },
      data: {
        name: eventItem.title,
        priceCents: eventItem.priceCents,
        active: true,
        sourceType: 'event_item',
        sourceId: eventItem.id,
      },
    });
    return existing.id;
  }

  const slug = `event-item-${eventItem.id}`;
  const created = await prisma.product.create({
    data: {
      slug,
      name: eventItem.title,
      priceCents: eventItem.priceCents,
      active: true,
      sourceType: 'event_item',
      sourceId: eventItem.id,
    },
  });

  return created.id;
}

async function recalcTotal(cartId: string) {
  const items: SumItem[] = await prisma.cartItem.findMany({
    where: { cartId },
    select: { priceCentsSnapshot: true, qty: true },
  });
  const total = items.reduce((acc: number, it: SumItem) => acc + it.priceCentsSnapshot * it.qty, 0);
  await prisma.cart.update({ where: { id: cartId }, data: { totalCents: total } });
  return total;
}

/**
 * POST = add/update riga nel carrello
 * Se qty = 0 rimuove la riga.
 */
export async function POST(request: Request, ctx: RouteContext) {
  const cartId = ctx.params.id;

  let payload: z.infer<typeof upsertSchema>;
  try {
    payload = upsertSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: 'validation_error', details: error.flatten() },
        { status: 400 },
      );
    }
    throw error;
  }

  // Esistenza carrello
  const cart = await prisma.cart.findUnique({ where: { id: cartId } });
  if (!cart) {
    return NextResponse.json({ ok: false, error: 'cart_not_found' }, { status: 404 });
  }

  const hasEventItem = typeof payload.eventItemId === 'string' && payload.eventItemId.length > 0;
  const requestedQty = payload.qty ?? 1;

  let productId: number;
  let snapshotName: string;
  let snapshotPrice: number;
  let snapshotImage: string | null = payload.imageUrlSnapshot ?? null;
  let eventMeta: { type: 'event'; eventId: string; emailOnly: boolean } | null = null;

  if (hasEventItem) {
    // === ramo EVENTO ========================================================
    const eventId = payload.eventItemId!;
    const existingEventProduct = await prisma.product.findFirst({
      where: { sourceType: 'event_item', sourceId: eventId },
      select: { id: true },
    });

    if (requestedQty <= 0) {
      if (existingEventProduct) {
        await prisma.cartItem.deleteMany({ where: { cartId, productId: existingEventProduct.id } });
        await recalcTotal(cartId);
      }
      return NextResponse.json({ ok: true, data: null });
    }

    const eventItem = await prisma.eventItem.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        slug: true,
        title: true,
        priceCents: true,
        emailOnly: true,
        active: true,
        startAt: true,
      },
    });

    if (!eventItem) {
      return NextResponse.json({ ok: false, error: 'event_not_found' }, { status: 404 });
    }

    const now = new Date();
    if (!eventItem.active) {
      return NextResponse.json({ ok: false, error: 'event_not_active' }, { status: 400 });
    }

    const isEmailOnly = !!eventItem.emailOnly;

    // Se è email-only non blocchiamo il carrello; se NON lo è e il prezzo non è valido → errore
    if (!isEmailOnly && eventItem.priceCents <= 0) {
      return NextResponse.json({ ok: false, error: 'event_not_purchasable' }, { status: 400 });
    }

    if (eventItem.startAt.getTime() < now.getTime()) {
      return NextResponse.json({ ok: false, error: 'event_in_past' }, { status: 400 });
    }

    productId = existingEventProduct?.id ?? (await ensureEventProduct(eventItem));

    const rawName =
      typeof payload.nameSnapshot === 'string' && payload.nameSnapshot.trim().length > 0
        ? payload.nameSnapshot.trim()
        : eventItem.title;

    snapshotName = rawName.length > 0 ? rawName : 'Evento';
    // Email-only = prezzo 0, altrimenti snapshot del prezzo attuale
    snapshotPrice = isEmailOnly ? 0 : payload.priceCentsSnapshot ?? eventItem.priceCents;
    eventMeta = { type: 'event', eventId: eventItem.id, emailOnly: isEmailOnly };
  } else {
    // === ramo PRODOTTO ======================================================
    const baseProductId = payload.productId!;

    if (requestedQty <= 0) {
      await prisma.cartItem.deleteMany({ where: { cartId, productId: baseProductId } });
      await recalcTotal(cartId);
      return NextResponse.json({ ok: true, data: null });
    }

    const product = await prisma.product.findUnique({
      where: { id: baseProductId },
      select: {
        priceCents: true,
        name: true,
        imageUrl: true,
        slug: true,
        sourceType: true,
      },
    });

    if (!product) {
      return NextResponse.json({ ok: false, error: 'product_not_found' }, { status: 404 });
    }

    productId = baseProductId;

    let rawName = payload.nameSnapshot ?? product.name ?? 'Prodotto';
    snapshotPrice = payload.priceCentsSnapshot ?? product.priceCents;

    // Se il prodotto è collegato a un evento, usiamo i dati dell'evento
    const eventInstance = await prisma.eventInstance.findFirst({
      where: { productId: baseProductId },
      select: { slug: true },
    });

    let eventSlug: string | null = null;
    if (eventInstance?.slug) {
      eventSlug = eventInstance.slug;
    } else if (typeof product.sourceType === 'string' && product.sourceType.includes('event')) {
      eventSlug = product.slug;
    }

    if (eventSlug) {
      const eventItem = await prisma.eventItem.findUnique({
        where: { slug: eventSlug },
        select: { id: true, title: true, priceCents: true, emailOnly: true },
      });

      if (eventItem) {
        const isEmailOnly = !!eventItem.emailOnly;
        snapshotPrice = isEmailOnly ? 0 : eventItem.priceCents;
        rawName = eventItem.title ?? rawName;
        eventMeta = {
          type: 'event',
          eventId: eventItem.id,
          emailOnly: isEmailOnly,
        };
      }
    }

    snapshotName = typeof rawName === 'string' && rawName.trim().length > 0 ? rawName.trim() : 'Prodotto';
    snapshotImage = snapshotImage ?? product.imageUrl ?? null;
  }

  const snapshotImageValue = snapshotImage;

  // Trova item esistente
  const existing = await prisma.cartItem.findFirst({
    where: { cartId, productId },
  });

  if (existing) {
    // costruiamo data con any per evitare mismatch del tipo 'meta'
    const data: any = {
      qty: payload.qty ?? existing.qty,
      nameSnapshot: snapshotName,
      priceCentsSnapshot: snapshotPrice,
      imageUrlSnapshot: snapshotImageValue,
    };
    if (eventMeta) {
      data.meta = eventMeta;
    } else if (payload.meta !== undefined && payload.meta !== null) {
      data.meta = payload.meta as any;
    }

    const updated = await prisma.cartItem.update({
      where: { id: existing.id },
      data,
    });

    await recalcTotal(cartId);
    return NextResponse.json({ ok: true, data: updated });
  }

  // CREATE item
  const dataCreate: any = {
    cartId,
    productId,
    qty: requestedQty,
    nameSnapshot: snapshotName,
    priceCentsSnapshot: snapshotPrice,
    imageUrlSnapshot: snapshotImageValue,
  };
  if (eventMeta) {
    dataCreate.meta = eventMeta;
  } else if (payload.meta !== undefined && payload.meta !== null) {
    dataCreate.meta = payload.meta as any;
  }

  const created = await prisma.cartItem.create({ data: dataCreate });

  await recalcTotal(cartId);
  return NextResponse.json({ ok: true, data: created }, { status: 201 });
}

/**
 * DELETE = rimuove item dal carrello (via query productId)
 */
export async function DELETE(request: Request, ctx: RouteContext) {
  const cartId = ctx.params.id;
  const productId = Number(new URL(request.url).searchParams.get('productId') ?? '');

  if (!Number.isFinite(productId) || productId <= 0) {
    return NextResponse.json({ ok: false, error: 'invalid_product' }, { status: 400 });
  }

  await prisma.cartItem.deleteMany({ where: { cartId, productId } });
  await recalcTotal(cartId);

  return NextResponse.json({ ok: true, data: null });
}
