import { z } from 'zod';

export const EVENT_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const isoDateString = z
  .string({ required_error: 'Data obbligatoria' })
  .trim()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: 'Formato data non valido',
  });

export const eventItemCreateSchema = z.object({
  slug: z
    .string({ required_error: 'Slug obbligatorio' })
    .trim()
    .min(3)
    .max(100)
    .regex(EVENT_SLUG_REGEX, { message: 'Usa lettere minuscole, numeri e trattini' }),
  title: z.string({ required_error: 'Titolo obbligatorio' }).trim().min(3),
  description: z.string().trim().max(2000).optional().nullable(),
  startAt: isoDateString,
  endAt: isoDateString.optional().nullable(),
  active: z.boolean({ required_error: 'Stato obbligatorio' }),
  showOnHome: z.boolean({ required_error: 'Visibilità obbligatoria' }),
  emailOnly: z.boolean({ required_error: 'Flag email-only obbligatorio' }),
  capacity: z.number().int().min(1).optional().nullable(),
  priceCents: z.number({ required_error: 'Prezzo obbligatorio' }).int().min(0),
});

export const eventItemUpdateSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(3)
      .max(100)
      .regex(EVENT_SLUG_REGEX, { message: 'Usa lettere minuscole, numeri e trattini' })
      .optional(),
    title: z.string().trim().min(3).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    startAt: isoDateString.optional(),
    endAt: isoDateString.optional().nullable(),
    active: z.boolean().optional(),
    showOnHome: z.boolean().optional(),
    emailOnly: z.boolean().optional(),
    capacity: z.number().int().min(1).optional().nullable(),
    priceCents: z.number().int().min(0).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Nessun campo da aggiornare',
  });

export const eventItemIdSchema = z.string().cuid({ message: 'Identificativo evento non valido' });

