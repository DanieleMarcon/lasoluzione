import { z } from 'zod';
export const bookingSchema = z.object({
  date: z.string().min(1, 'Seleziona una data'),
  time: z.string().min(1, 'Seleziona un orario'),
  people: z.number().int().min(1, 'Minimo 1').max(50, 'Max 50'),
  type: z.enum(['pranzo','aperitivo','evento']).default('pranzo'),
  name: z.string().min(2, 'Inserisci il nome'),
  email: z.string().email('Email non valida'),
  phone: z.string().min(7, 'Telefono non valido'),
  notes: z.string().optional(),
  agreePrivacy: z.boolean().refine(v=>v===true,'Necessario per procedere'),
  agreeMarketing: z.boolean().optional()
});
export type BookingData = z.infer<typeof bookingSchema>;