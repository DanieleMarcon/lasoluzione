// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { getAdminEmails } from '@/lib/admin/emails';

const prisma = new PrismaClient();

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

async function seedCatalogSections() {
  const sections = [
    { key: 'eventi', title: 'Eventi', enableDateTime: false, active: true, displayOrder: 10 },
    { key: 'aperitivo', title: 'Aperitivo', enableDateTime: false, active: true, displayOrder: 20 },
    { key: 'pranzo', title: 'Pranzo', enableDateTime: true, active: true, displayOrder: 30 },
    { key: 'cena', title: 'Cena', enableDateTime: true, active: true, displayOrder: 40 },
    { key: 'colazione', title: 'Colazione', enableDateTime: false, active: false, displayOrder: 50 },
  ] as const;

  for (const section of sections) {
    await prisma.catalogSection.upsert({
      where: { key: section.key },
      update: {
        title: section.title,
        description: section.key === 'colazione' ? 'Attivala quando pronta al lancio' : undefined,
        enableDateTime: section.enableDateTime,
        active: section.active,
        displayOrder: section.displayOrder,
      },
      create: {
        key: section.key,
        title: section.title,
        description: section.key === 'colazione' ? 'Attivala quando pronta al lancio' : null,
        enableDateTime: section.enableDateTime,
        active: section.active,
        displayOrder: section.displayOrder,
      },
    });
  }

  console.log('[seed] Sections ok');
}

async function bridgeMenuDishesToProducts() {
  const sections = await prisma.catalogSection.findMany({
    where: { key: { in: ['pranzo', 'cena'] } },
  });
  const sectionByKey = new Map(sections.map((section) => [section.key, section] as const));

  const dishes = await prisma.menuDish.findMany({ where: { active: true } });
  let bridged = 0;

  for (const dish of dishes) {
    const product = await prisma.product.upsert({
      where: { slug: dish.slug },
      update: {
        name: dish.name,
        description: dish.description ?? null,
        ingredients: null,
        allergens: null,
        priceCents: dish.priceCents,
        unitCostCents: 0,
        supplierName: null,
        stockQty: 0,
        imageUrl: null,
        category: dish.category ?? null,
        order: dish.order,
        active: dish.active,
        sourceType: 'menu_dish',
        sourceId: String(dish.id),
        isVegan: false,
        isVegetarian: false,
        isGlutenFree: false,
        isLactoseFree: false,
        isOrganic: false,
      },
      create: {
        slug: dish.slug,
        name: dish.name,
        description: dish.description ?? null,
        ingredients: null,
        allergens: null,
        priceCents: dish.priceCents,
        unitCostCents: 0,
        supplierName: null,
        stockQty: 0,
        imageUrl: null,
        category: dish.category ?? null,
        order: dish.order,
        active: dish.active,
        sourceType: 'menu_dish',
        sourceId: String(dish.id),
        isVegan: false,
        isVegetarian: false,
        isGlutenFree: false,
        isLactoseFree: false,
        isOrganic: false,
      },
    });

    const visibleAt = (dish as any).visibleAt as 'lunch' | 'dinner' | 'both' | undefined;
    const targetKeys = new Set<string>();
    if (visibleAt === 'lunch') targetKeys.add('pranzo');
    if (visibleAt === 'dinner') targetKeys.add('cena');
    if (visibleAt === 'both' || !visibleAt) {
      targetKeys.add('pranzo');
      targetKeys.add('cena');
    }

    for (const key of targetKeys) {
      const section = sectionByKey.get(key);
      if (!section) continue;
      await prisma.sectionProduct.upsert({
        where: {
          sectionId_productId: {
            sectionId: section.id,
            productId: product.id,
          },
        },
        update: {
          order: dish.order,
          featured: false,
          showInHome: false,
        },
        create: {
          sectionId: section.id,
          productId: product.id,
          order: dish.order,
          featured: false,
          showInHome: false,
        },
      });
    }

    bridged += 1;
  }

  return bridged;
}

async function bridgeEventTiersToProducts() {
  const sections = await prisma.catalogSection.findMany({
    where: { key: { in: ['eventi', 'aperitivo'] } },
  });
  const sectionByKey = new Map(sections.map((section) => [section.key, section] as const));

  const tiers = await prisma.eventTier.findMany({ where: { active: true } });
  let bridged = 0;

  for (const tier of tiers) {
    const slug = `tier-${tier.type}-${slugify(tier.label)}`;
    const product = await prisma.product.upsert({
      where: { slug },
      update: {
        name: tier.label,
        description: null,
        ingredients: null,
        allergens: null,
        priceCents: tier.priceCents,
        unitCostCents: 0,
        supplierName: null,
        stockQty: 0,
        imageUrl: null,
        category: tier.type,
        order: tier.order,
        active: tier.active,
        sourceType: 'event_tier',
        sourceId: tier.id,
        isVegan: false,
        isVegetarian: false,
        isGlutenFree: false,
        isLactoseFree: false,
        isOrganic: false,
      },
      create: {
        slug,
        name: tier.label,
        description: null,
        ingredients: null,
        allergens: null,
        priceCents: tier.priceCents,
        unitCostCents: 0,
        supplierName: null,
        stockQty: 0,
        imageUrl: null,
        category: tier.type,
        order: tier.order,
        active: tier.active,
        sourceType: 'event_tier',
        sourceId: tier.id,
        isVegan: false,
        isVegetarian: false,
        isGlutenFree: false,
        isLactoseFree: false,
        isOrganic: false,
      },
    });

    const key = tier.type === 'evento' ? 'eventi' : 'aperitivo';
    const section = sectionByKey.get(key);
    if (section) {
      await prisma.sectionProduct.upsert({
        where: {
          sectionId_productId: {
            sectionId: section.id,
            productId: product.id,
          },
        },
        update: {
          order: tier.order,
          featured: false,
          showInHome: false,
        },
        create: {
          sectionId: section.id,
          productId: product.id,
          order: tier.order,
          featured: false,
          showInHome: false,
        },
      });
    }

    bridged += 1;
  }

  return bridged;
}

async function seedAdminUsers() {
  const adminEmails = getAdminEmails();

  if (!adminEmails.length) {
    console.warn('[seed] ADMIN_EMAILS è vuoto: nessun utente admin creato');
    return;
  }

  for (const email of adminEmails) {
    await prisma.user.upsert({
      where: { email },
      update: { role: 'admin' },
      create: {
        email,
        role: 'admin',
        name: email.split('@')[0]
      }
    });
  }

  console.log(`[seed] Creati/aggiornati ${adminEmails.length} utenti admin`);
}

async function seedMenuDishes() {
  const dishes = [
    {
      slug: 'bruschette-miste',
      name: 'Bruschette miste',
      description: 'Pane tostato con pomodoro, olive e crema di ceci',
      priceCents: 600,
      category: 'Antipasti',
      order: 10,
      visibleAt: 'both' as const,
    },
    {
      slug: 'insalata-di-stagione',
      name: 'Insalata di stagione',
      description: 'Verdure croccanti con dressing leggero',
      priceCents: 500,
      category: 'Antipasti',
      order: 20,
      visibleAt: 'lunch' as const,
    },
    {
      slug: 'lasagna-vegetariana',
      name: 'Lasagna vegetariana',
      description: 'Con ragù di verdure e besciamella fatta in casa',
      priceCents: 1200,
      category: 'Primi',
      order: 30,
      visibleAt: 'both' as const,
    },
    {
      slug: 'carbonara-cremosa',
      name: 'Carbonara cremosa',
      description: 'Guanciale croccante e pecorino romano DOP',
      priceCents: 1100,
      category: 'Primi',
      order: 40,
      visibleAt: 'dinner' as const,
    },
    {
      slug: 'tiramisu-della-casa',
      name: 'Tiramisù della casa',
      description: 'Classico con mascarpone fresco',
      priceCents: 0,
      category: 'Dolci',
      order: 50,
      visibleAt: 'both' as const,
    },
    {
      slug: 'acqua-naturalmente',
      name: 'Acqua naturale 75cl',
      description: 'Inclusa nel menu pranzo',
      priceCents: 0,
      category: 'Bevande',
      order: 60,
      visibleAt: 'both' as const,
    },
  ];

  for (const dish of dishes) {
    await prisma.menuDish.upsert({
      where: { slug: dish.slug },
      update: {
        name: dish.name,
        description: dish.description,
        priceCents: dish.priceCents,
        category: dish.category,
        order: dish.order,
        visibleAt: dish.visibleAt,
        active: true,
      },
      create: {
        ...dish,
        active: true,
      },
    });
  }

  console.log('[seed] Catalogo piatti pranzo aggiornato');
}

async function seedBookingSettings() {
  await prisma.bookingSettings.upsert({
    where: { id: 1 },
    update: {
      coverCents: 200,
      lunchRequirePrepay: false,
      dinnerRequirePrepay: false,
      dinnerCoverCents: 200,
      enabledTypes: ['pranzo', 'cena', 'evento'],
      typeLabels: { pranzo: 'Pranzo', cena: 'Cena', evento: 'Evento' },
    },
    create: {
      id: 1,
      enableDateTimeStep: true,
      fixedDate: null,
      fixedTime: null,
      enabledTypes: ['pranzo', 'cena', 'evento'],
      typeLabels: { pranzo: 'Pranzo', cena: 'Cena', evento: 'Evento' },
      prepayTypes: [],
      prepayAmountCents: null,
      coverCents: 200,
      lunchRequirePrepay: false,
      dinnerRequirePrepay: false,
      dinnerCoverCents: 200,
    },
  });

  console.log('[seed] BookingSettings aggiornate con coverCents e lunchRequirePrepay');
}

async function seedEventTiers() {
  const tiers = [
    { type: 'evento', label: 'Ingresso standard', priceCents: 1500, order: 10 },
    { type: 'evento', label: 'Ingresso VIP', priceCents: 3000, order: 20 },
    { type: 'aperitivo', label: 'Calice singolo', priceCents: 800, order: 10 },
    { type: 'aperitivo', label: 'Formula tapas', priceCents: 1800, order: 20 },
  ];

  for (const tier of tiers) {
    await prisma.eventTier.upsert({
      where: {
        id: `${tier.type}-${tier.label}`,
      },
      update: {
        label: tier.label,
        priceCents: tier.priceCents,
        order: tier.order,
        active: true,
      },
      create: {
        id: `${tier.type}-${tier.label}`,
        type: tier.type,
        label: tier.label,
        priceCents: tier.priceCents,
        order: tier.order,
        active: true,
      },
    });
  }

  console.log('[seed] Event tiers aggiornati');
}

async function main() {
  await seedAdminUsers();
  await seedMenuDishes();
  await seedBookingSettings();
  await seedEventTiers();
  await seedCatalogSections();
  const menuDishCount = await bridgeMenuDishesToProducts();
  const tierCount = await bridgeEventTiersToProducts();
  console.log(`[seed] Products bridged from MenuDish: ${menuDishCount}`);
  console.log(`[seed] Products bridged from EventTier: ${tierCount}`);
}

main()
  .catch((error) => {
    console.error('[seed] errore', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
