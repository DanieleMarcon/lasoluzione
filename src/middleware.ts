import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware di pass-through (aggiungi controlli/redirect qui in futuro).
 */
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

/** Escludi asset Next.js e favicon */
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
