import { z } from 'zod';

// enum coerente con il form (select)
export const bookingType = z.enum(['pranzo', 'aperitivo', 'evento']);

export const bookingSchema = z.object({
  // accettiamo "YYYY-MM-DD" e "HH:mm" dal form
  date: z.string().min(1, 'Seleziona una data'),
  time: z.string().min(1, 'Seleziona un orario'),

  people: z.number().int().min(1).max(20),
  type: bookingType,

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
});

export type BookingData = z.infer<typeof bookingSchema>;
