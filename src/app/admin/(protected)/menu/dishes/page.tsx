// src/app/admin/menu/dishes/page.tsx
import { assertAdmin } from '@/lib/admin/session';
import { prisma } from '@/lib/prisma';
import MenuDishesManager from '@/components/admin/menu/MenuDishesManager';

const PAGE_SIZE = 20;

export default async function AdminMenuDishesPage() {
  await assertAdmin();

  const [total, dishes] = await Promise.all([
    prisma.menuDish.count(),
    prisma.menuDish.findMany({
      orderBy: [
        { order: 'asc' },
        { category: 'asc' },
        { name: 'asc' },
      ],
      take: PAGE_SIZE,
    }),
  ]);

  const initialDishes = dishes.map((dish) => ({
    id: dish.id,
    name: dish.name,
    slug: dish.slug,
    description: dish.description,
    priceCents: dish.priceCents,
    active: dish.active,
    category: dish.category,
    order: dish.order,
    visibleAt: dish.visibleAt as 'lunch' | 'dinner' | 'both',
    createdAt: dish.createdAt.toISOString(),
    updatedAt: dish.updatedAt.toISOString(),
  }));

  const initialMeta = {
    page: 1,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };

  return <MenuDishesManager initialDishes={initialDishes} initialMeta={initialMeta} />;
}
