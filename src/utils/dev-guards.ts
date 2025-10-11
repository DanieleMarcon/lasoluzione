// src/utils/dev-guards.ts
import { prisma } from '@/lib/prisma';

export function prismaHasEventItem(): boolean {
  return Boolean((prisma as any)?.eventItem?.findMany);
}

