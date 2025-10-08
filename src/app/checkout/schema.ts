import { z } from 'zod';

export const customerSchema = z.object({
  name: z.string().min(1, 'Nome obbligatorio'),
  email: z.string().email('Email non valida'),
  phone: z.string().min(6, 'Telefono obbligatorio'),
  notes: z.string().max(2000, 'Massimo 2000 caratteri').optional(),
});

export type CustomerInput = z.infer<typeof customerSchema>;
