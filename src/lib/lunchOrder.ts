import { prisma } from '@/lib/prisma';

const MAX_CENTS = 2_147_483_647;

type InputItem = {
  dishId: number;
  qty: number;
};

export type LunchOrderLine = {
  dishId: number;
  name: string;
  priceCents: number;
  qty: number;
};

export type LunchOrderSummary = {
  items: LunchOrderLine[];
  coverCents: number;
  subtotalCents: number;
  totalCents: number;
};

type VisibleAt = 'lunch' | 'dinner' | 'both';

function aggregateOrder(order: InputItem[], prefix: string): InputItem[] {
  const map = new Map<number, number>();
  for (const item of order) {
    if (!Number.isInteger(item.dishId) || item.dishId <= 0) continue;
    if (!Number.isInteger(item.qty)) throw new Error(`${prefix}_INVALID_QTY`);
    if (item.qty < 0) throw new Error(`${prefix}_INVALID_QTY`);
    if (item.qty > 99) throw new Error(`${prefix}_QTY_TOO_HIGH`);

    const current = map.get(item.dishId) ?? 0;
    const nextQty = current + item.qty;
    if (nextQty > 99) throw new Error(`${prefix}_QTY_TOO_HIGH`);
    map.set(item.dishId, nextQty);
  }
  return Array.from(map.entries())
    .map(([dishId, qty]) => ({ dishId, qty }))
    .filter((item) => item.qty > 0);
}

async function buildMealOrderSummary(
  order: InputItem[] | undefined,
  people: number,
  coverCentsInput: number | null | undefined,
  allowedVisibility: VisibleAt[],
  prefix: 'LUNCH' | 'DINNER',
): Promise<LunchOrderSummary> {
  const aggregated = aggregateOrder(order ?? [], prefix);
  if (aggregated.length === 0) {
    throw new Error(`${prefix}_NO_ITEMS`);
  }

  const dishIds = aggregated.map((item) => item.dishId);
  const dishes = await prisma.menuDish.findMany({
    where: { id: { in: dishIds } },
  });
  if (dishes.length !== dishIds.length) {
    throw new Error(`${prefix}_DISH_NOT_FOUND`);
  }

  const dishMap = new Map(dishes.map((dish) => [dish.id, dish] as const));

  const items: LunchOrderLine[] = [];
  let subtotalCents = 0;

  for (const item of aggregated) {
    const dish = dishMap.get(item.dishId);
    if (!dish) {
      throw new Error(`${prefix}_DISH_NOT_FOUND`);
    }
    if (!dish.active) {
      throw new Error(`${prefix}_DISH_INACTIVE`);
    }
    if (!allowedVisibility.includes((dish.visibleAt as VisibleAt) ?? 'both')) {
      throw new Error(`${prefix}_DISH_NOT_AVAILABLE`);
    }
    const lineTotal = dish.priceCents * item.qty;
    subtotalCents += lineTotal;
    if (subtotalCents > MAX_CENTS) {
      throw new Error(`${prefix}_TOTAL_TOO_HIGH`);
    }
    items.push({
      dishId: dish.id,
      name: dish.name,
      priceCents: dish.priceCents,
      qty: item.qty,
    });
  }

  const coverCents = coverCentsInput && coverCentsInput > 0 ? coverCentsInput : 0;
  const totalCents = subtotalCents + coverCents * people;
  if (totalCents > MAX_CENTS) {
    throw new Error(`${prefix}_TOTAL_TOO_HIGH`);
  }

  return {
    items,
    coverCents,
    subtotalCents,
    totalCents,
  };
}

export async function buildLunchOrderSummary(
  order: InputItem[] | undefined,
  people: number,
  coverCentsInput: number | null | undefined,
): Promise<LunchOrderSummary> {
  return buildMealOrderSummary(order, people, coverCentsInput, ['lunch', 'both'], 'LUNCH');
}

export async function buildDinnerOrderSummary(
  order: InputItem[] | undefined,
  people: number,
  coverCentsInput: number | null | undefined,
): Promise<LunchOrderSummary> {
  return buildMealOrderSummary(order, people, coverCentsInput, ['dinner', 'both'], 'DINNER');
}

export function normalizeStoredLunchItems(value: unknown): LunchOrderLine[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item: any) => ({
      dishId: Number(item?.dishId ?? 0),
      name: String(item?.name ?? ''),
      priceCents: Number(item?.priceCents ?? 0),
      qty: Number(item?.qty ?? 0),
    }))
    .filter((item) => item.dishId > 0 && item.qty > 0);
}

export const normalizeStoredDinnerItems = normalizeStoredLunchItems;
