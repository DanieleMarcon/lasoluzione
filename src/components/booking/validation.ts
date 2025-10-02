import { z } from 'zod';

// enum coerente con il form
export const bookingType = z.enum(['pranzo', 'aperitivo', 'evento']);

export const bookingSchema = z.object({
  // accettiamo "YYYY-MM-DD" dal form e/o ISO string
  date: z
    .string()
    .min(1, 'Data obbligatoria'),

  // "HH:mm" dal form
  time: z
    .string()
    .min(1, 'Orario obbligatorio'),

  people: z
    .number({ invalid_type_error: 'Numero di persone non valido' })
    .int()
    .min(1)
    .max(20),

  type: bookingType,

  name: z.string().min(2).max(80),
  email: z.string().email(),

  // ✅ Telefono obbligatorio
  phone: z
    .string({ required_error: 'Telefono obbligatorio' })
    .min(7, 'Telefono non valido')
    .regex(/^[0-9 +().-]+$/, 'Telefono non valido'),

  // Note opzionali: stringa vuota -> undefined
  notes: z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined)),

  // Deve essere true
  agreePrivacy: z.literal(true, {
    errorMap: () => ({ message: 'Devi accettare la privacy' })
  }),

  // Flag opzionale
  agreeMarketing: z.boolean().optional().default(false)
});

export type BookingData = z.infer<typeof bookingSchema>;
