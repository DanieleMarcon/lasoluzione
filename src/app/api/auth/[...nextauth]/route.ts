// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';

import { authConfig } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const { handlers } = NextAuth(authConfig);
export const GET = handlers.GET;
export const POST = handlers.POST;
