import { z } from 'zod';

// enum coerente con il form (select)
export const bookingType = z.enum(['pranzo', 'cena', 'aperitivo', 'evento']);

const lunchOrderItemSchema = z.object({
  dishId: z.number().int().positive(),
  qty: z.number().int().min(0).max(99),
});

const tierSchema = z.object({
  id: z.string().trim().min(1, "Seleziona un'opzione valida"),
  label: z.string().trim().min(1, 'Etichetta non valida'),
  priceCents: z.number().int().min(0, 'Prezzo non valido'),
});

export const bookingSchema = z
  .object({
  // accettiamo "YYYY-MM-DD" e "HH:mm" dal form
  date: z.string().min(1, 'Seleziona una data'),
  time: z.string().min(1, 'Seleziona un orario'),

  people: z.number().int().min(1).max(20),
  type: bookingType,

  lunchOrder: z.array(lunchOrderItemSchema).optional(),

  name: z.string().trim().min(2, 'Inserisci il tuo nome'),
  email: z.string().email('Email non valida'),

  // ✅ OBBLIGATORIO
  phone: z.string().trim().min(5, 'Telefono non valido'),

  // opzionale
  notes: z.string().trim().max(500).optional(),

  // deve essere vero
  agreePrivacy: z.literal(true, {
    errorMap: () => ({ message: 'Devi accettare la privacy' }),
  }),

  // opzionale
  agreeMarketing: z.boolean().optional(),
  tier: tierSchema.optional(),
  tierId: z.string().trim().min(1, 'Seleziona un’opzione valida').optional(),
  tierType: z.enum(['evento', 'aperitivo']).optional(),
  tierLabel: z.string().trim().min(1, 'Etichetta non valida').optional(),
  tierPriceCents: z.number().int().min(0, 'Prezzo non valido').optional(),
  })
  .superRefine((data, ctx) => {
    const isTierType = data.type === 'evento' || data.type === 'aperitivo';
    if (isTierType) {
      if (!data.tierId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Seleziona un'opzione", path: ['tierId'] });
      }
      if (!data.tierLabel) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Etichetta opzione mancante', path: ['tierLabel'] });
      }
      if (data.tierPriceCents == null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Prezzo opzione mancante', path: ['tierPriceCents'] });
      }
      if (!data.tierType || data.tierType !== data.type) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Tipo opzione non valido', path: ['tierType'] });
      }
    }

    const isLunch = data.type === 'pranzo';
    const isDinner = data.type === 'cena';
    if (!isLunch && !isDinner) {
      return;
    }

    const order = data.lunchOrder ?? [];
    if (!order.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Seleziona almeno un piatto',
        path: ['lunchOrder'],
      });
      return;
    }

    const withQty = order.filter((item) => item.qty > 0);
    if (!withQty.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Scegli almeno un piatto con quantità superiore a zero',
        path: ['lunchOrder'],
      });
    }
  });

export type BookingData = z.infer<typeof bookingSchema>;
