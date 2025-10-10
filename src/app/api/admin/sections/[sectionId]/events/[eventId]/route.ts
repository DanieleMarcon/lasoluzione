import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { assertAdmin } from '@/lib/admin/session';
import { prisma } from '@/lib/prisma';
import { eventItemIdSchema } from '@/lib/validators/eventItem';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({
  sectionId: z.string().trim().min(1, 'Sezione obbligatoria'),
  eventId: eventItemIdSchema,
});

export async function DELETE(request: Request, context: { params: { sectionId: string; eventId: string } }) {
  await assertAdmin();

  const parsedParams = paramsSchema.safeParse(context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ ok: false, error: 'invalid_params' }, { status: 400 });
  }

  const { sectionId, eventId } = parsedParams.data;

  try {
    await prisma.sectionEvent.delete({
      where: {
        sectionId_eventId: {
          sectionId,
          eventId,
        },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    }

    console.error('[admin][sections][events][delete]', error);
    return NextResponse.json({ ok: false, error: 'delete_failed' }, { status: 500 });
  }
}
