import { z } from 'zod';

export const ProductUpsertSchema = z.object({
  name: z.string().trim().min(2, 'Nome troppo corto'),
  slug: z
    .string()
    .trim()
    .min(1)
    .optional(),
  description: z.string().trim().max(2000).optional(),
  ingredients: z.string().trim().max(2000).optional(),
  allergens: z.string().trim().max(2000).optional(),
  priceCents: z.coerce.number().int().min(0),
  unitCostCents: z.coerce.number().int().min(0).optional(),
  supplierName: z.string().trim().max(255).optional(),
  stockQty: z.coerce.number().int().min(0).optional(),
  imageUrl: z
    .string()
    .trim()
    .url('URL immagine non valida')
    .optional(),
  category: z.string().trim().max(120).optional(),
  order: z.coerce.number().int().min(0).optional(),
  active: z.boolean().optional(),
  isVegan: z.boolean().optional(),
  isVegetarian: z.boolean().optional(),
  isGlutenFree: z.boolean().optional(),
  isLactoseFree: z.boolean().optional(),
  isOrganic: z.boolean().optional(),
});

export const SectionUpsertSchema = z.object({
  key: z.enum(['eventi', 'aperitivo', 'pranzo', 'cena', 'colazione']),
  title: z.string().trim().min(2, 'Titolo troppo corto'),
  description: z.string().trim().max(1000).optional(),
  enableDateTime: z.boolean().optional(),
  active: z.boolean().optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
});

export const AssignSchema = z.object({
  productId: z.coerce.number().int().min(1),
  order: z.coerce.number().int().min(0).optional(),
  featured: z.boolean().optional(),
  showInHome: z.boolean().optional(),
});

export type ProductUpsertInput = z.infer<typeof ProductUpsertSchema>;
export type SectionUpsertInput = z.infer<typeof SectionUpsertSchema>;
export type AssignInput = z.infer<typeof AssignSchema>;
