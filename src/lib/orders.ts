import 'server-only'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { recalcCartTotal } from '@/lib/cart'
import { createRevolutOrder, isRevolutPaid, retrieveRevolutOrder } from '@/lib/revolut'
import { encodeRevolutPaymentMeta, parsePaymentRef } from '@/lib/paymentRef'
import {
  sendOrderConfirmation,
  sendOrderFailure,
  sendOrderNotificationToAdmin,
} from '@/lib/mailer'

// --- Tipi runtime-derivati (niente tipi Prisma da importare)
const includeOrderRich = {
  cart: { include: { items: true } },
  bookings: true,
} as const

type NonNull<T> = T extends null | undefined ? never : T

async function getOrderWithCart(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: includeOrderRich,
  })
}

export type OrderWithCart = NonNull<Awaited<ReturnType<typeof getOrderWithCart>>>
export type CartWithItems = OrderWithCart['cart']
type CartItemRow = CartWithItems['items'][number]

type MappedItem = {
  productId: number
  name: string
  qty: number
  priceCents: number
  totalCents: number
}

const DEFAULT_BOOKING_SETTINGS_ID = 1

export const OrderInput = z.object({
  cartId: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  phone: z.string().min(6),
  notes: z.string().max(2000).optional().nullable(),
})

export type CreateOrderSuccess =
  | { ok: true; data: { orderId: string; status: 'paid' } }
  | {
      ok: true
      data: {
        orderId: string
        status: 'pending_payment'
        totalCents: number
        revolutToken: string
        hostedPaymentUrl?: string
      }
    }

export type CreateOrderResult = CreateOrderSuccess | { ok: false; error: string }

export class OrderWorkflowError extends Error {
  status: number
  constructor(code: string, status = 400) {
    super(code)
    this.name = 'OrderWorkflowError'
    this.status = status
  }
}

// ---- Helpers dominio

function mapItems(cart: CartWithItems): MappedItem[] {
  return cart.items.map((item: CartItemRow) => ({
    productId: item.productId,
    name: item.nameSnapshot,
    qty: item.qty,
    priceCents: item.priceCentsSnapshot,
    totalCents: item.priceCentsSnapshot * item.qty,
  }))
}
const mapItemsForMail = mapItems

function hasEvent(order: OrderWithCart) {
  return order.cart.items.some((item: CartItemRow) =>
    (item.nameSnapshot ?? '').toLowerCase().includes('evento'),
  )
}

type BookingTypeLocal = 'evento' | 'pranzo'
function detectBookingType(order: OrderWithCart): BookingTypeLocal {
  return hasEvent(order) ? 'evento' : 'pranzo'
}

// ---- Booking

export async function ensureBookingFromOrder(orderId: string) {
  const order = await getOrderWithCart(orderId)
  if (!order) throw new OrderWorkflowError('order_not_found', 404)
  return ensureBookingInternal(order)
}

export async function findOrderByReference(ref: string) {
  if (!ref) return null
  return prisma.order.findFirst({
    where: { OR: [{ id: ref }, { paymentRef: ref }, { paymentRef: { contains: ref } }] },
  })
}

async function ensureBookingInternal(order: OrderWithCart) {
  const settings = await prisma.bookingSettings.findUnique({
    where: { id: DEFAULT_BOOKING_SETTINGS_ID },
  })

  const bookingDate = settings?.fixedDate ?? new Date()
  const bookingType = detectBookingType(order)
  const items = mapItems(order.cart)
  const people = items.reduce((sum: number, item: MappedItem) => sum + item.qty, 0) || 1
  const totalCents = order.totalCents ?? order.cart.totalCents ?? 0

  // niente tipi Prisma -> payload compatibile
  const data = {
    date: bookingDate,
    people,
    name: order.name,
    email: order.email,
    phone: order.phone ?? '',
    type: bookingType as any, // enum BookingType
    status: 'confirmed' as any, // enum BookingStatus
    order: { connect: { id: order.id } },
    lunchItemsJson: items as any,
    subtotalCents: totalCents,
    totalCents,
    ...(order.notes != null ? { notes: order.notes } : {}),
  }

  const current = order.bookings[0]
    ? await prisma.booking.findUnique({ where: { id: order.bookings[0].id } })
    : null

  const booking = current
    ? await prisma.booking.update({ where: { id: current.id }, data })
    : await prisma.booking.create({ data })

  return { booking, order }
}

// ---- Ordine (idempotente su cartId)

export async function createOrderFromCart(rawInput: unknown): Promise<CreateOrderResult> {
  const parsed = OrderInput.safeParse(rawInput)
  if (!parsed.success) return { ok: false, error: 'invalid_payload' }

  const { cartId, email, name, phone, notes } = parsed.data
  const normalizedNotes = typeof notes === 'string' ? notes.trim() : undefined

  // Carrello e validazioni
  const cart = await prisma.cart.findUnique({ where: { id: cartId }, include: { items: true } })
  if (!cart) throw new OrderWorkflowError('cart_not_found', 404)
  if (!Array.isArray(cart.items) || cart.items.length === 0)
    throw new OrderWorkflowError('cart_empty', 400)
  if (cart.status !== 'open' && cart.status !== 'locked')
    throw new OrderWorkflowError('cart_not_ready', 400)

  const totalCents = await recalcCartTotal(cartId)
  const nextStatus: 'pending_payment' | 'paid' = totalCents > 0 ? 'pending_payment' : 'paid'

  // Se esiste già un ordine per questo carrello, riusalo. Altrimenti creane uno.
  let order = await prisma.order.findUnique({ where: { cartId } })

  if (!order) {
    try {
      order = await prisma.order.create({
        data: {
          cartId,
          email,
          name,
          phone,
          status: nextStatus,
          totalCents,
          ...(normalizedNotes ? { notes: normalizedNotes } : {}),
        },
      })
    } catch (e: any) {
      if (e?.code === 'P2002') {
        order = await prisma.order.findUnique({ where: { cartId } })
        if (!order) throw e
      } else {
        throw e
      }
    }
  } else {
    if (order.status === 'paid') {
      return { ok: true, data: { orderId: order.id, status: 'paid' } }
    }
    order = await prisma.order.update({
      where: { id: order.id },
      data: {
        email,
        name,
        phone,
        totalCents,
        status: nextStatus,
        ...(normalizedNotes !== undefined ? { notes: normalizedNotes } : {}),
      },
    })
  }

  // Ordine a costo zero -> finalizza subito
  if (totalCents <= 0) {
    await finalizePaidOrder(order.id)
    return { ok: true, data: { orderId: order.id, status: 'paid' } }
  }

  // Se abbiamo già un paymentRef Revolut valido, riusa token + hosted url
  const existingRef = parsePaymentRef(order.paymentRef)
  if (existingRef.kind === 'revolut') {
    const reuseToken =
      existingRef.meta.checkoutPublicId ?? existingRef.meta.orderId ?? null
    const hostedPaymentUrl = existingRef.meta.hostedPaymentUrl ?? undefined
    if (reuseToken) {
      return {
        ok: true,
        data: {
          orderId: order.id,
          status: 'pending_payment',
          totalCents,
          revolutToken: reuseToken,
          hostedPaymentUrl,
        },
      }
    }
  }

  // Crea/rigenera ordine Revolut e salva paymentRef
  try {
    const description = `Prenotazione #${order.id} – La Soluzione`
    const revolutOrder = await createRevolutOrder({
      amountMinor: totalCents,
      currency: 'EUR',
      merchantOrderId: order.id,
      customer: { email, name },
      description,
      captureMode: 'automatic',
    })

    const meta = encodeRevolutPaymentMeta({
      provider: 'revolut',
      orderId: revolutOrder.paymentRef,
      checkoutPublicId: revolutOrder.checkoutPublicId,
      hostedPaymentUrl: revolutOrder.hostedPaymentUrl,
    })

    await prisma.order.update({
      where: { id: order.id },
      data: { paymentRef: meta, status: 'pending_payment' },
    })

    const revolutToken =
      revolutOrder.checkoutPublicId ?? revolutOrder.paymentRef ?? order.id

    return {
      ok: true,
      data: {
        orderId: order.id,
        status: 'pending_payment',
        totalCents,
        revolutToken,
        hostedPaymentUrl: revolutOrder.hostedPaymentUrl ?? undefined,
      },
    }
  } catch (err: any) {
    if (err?.code === 'P2002') {
      const again = await prisma.order.findUnique({ where: { cartId } })
      if (again) {
        const ref = parsePaymentRef(again.paymentRef)
        const token =
          ref.kind === 'revolut'
            ? ref.meta.checkoutPublicId ?? ref.meta.orderId ?? again.id
            : again.id
        return {
          ok: true,
          data: {
            orderId: again.id,
            status: 'pending_payment',
            totalCents,
            revolutToken: token,
            hostedPaymentUrl:
              ref.kind === 'revolut' ? ref.meta.hostedPaymentUrl ?? undefined : undefined,
          },
        }
      }
    }
    await prisma.order.update({ where: { id: order.id }, data: { status: 'failed' } })
    const message = err instanceof Error ? err.message : 'payment_gateway_error'
    throw new OrderWorkflowError(message, 502)
  }
}

export async function finalizePaidOrder(orderId: string) {
  const order = await getOrderWithCart(orderId)
  if (!order) throw new OrderWorkflowError('order_not_found', 404)

  await prisma.order.update({ where: { id: order.id }, data: { status: 'paid' } })

  const itemsForMail = mapItemsForMail(order.cart)
  const { booking } = await ensureBookingInternal(order)

  await prisma.cart.update({
    where: { id: order.cartId },
    data: { status: 'completed', totalCents: 0 },
  })
  await prisma.cartItem.deleteMany({ where: { cartId: order.cartId } })

  await sendOrderConfirmation({ to: order.email, order, items: itemsForMail })
  await sendOrderNotificationToAdmin({ order, items: itemsForMail, booking })

  return prisma.order.findUniqueOrThrow({ where: { id: order.id } })
}

export async function markOrderFailed(orderId: string, reason?: string) {
  const order = await prisma.order.update({
    where: { id: orderId },
    data: { status: 'failed' },
  })
  await sendOrderFailure({ order, reason })
  return order
}

// ---- Polling stato

export async function pollOrderStatus(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) return { status: 'not_found' as const }

  if (order.status === 'paid') return { status: 'paid' as const }
  if (order.status === 'failed') return { status: 'failed' as const }

  const parsedRef = parsePaymentRef(order.paymentRef)
  if (parsedRef.kind !== 'revolut') return { status: 'pending' as const }

  const revolutOrderId = parsedRef.meta.orderId
  if (!revolutOrderId) return { status: 'pending' as const }

  const remote = await retrieveRevolutOrder(revolutOrderId)

  if (isRevolutPaid(remote.state)) {
    await finalizePaidOrder(order.id)
    return { status: 'paid' as const }
  }

  if (remote.state === 'failed' || remote.state === 'cancelled' || remote.state === 'declined') {
    await markOrderFailed(order.id, remote.state)
    return { status: 'failed' as const }
  }

  return { status: 'pending' as const }
}
