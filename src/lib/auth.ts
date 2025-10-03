// src/lib/auth.ts
import 'server-only';

import NextAuth, { type NextAuthConfig } from 'next-auth';
import EmailProvider from 'next-auth/providers/email';
import { PrismaAdapter } from '@auth/prisma-adapter';
import type { Adapter } from 'next-auth/adapters';
import type { UserRole } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { isAdminEmail } from '@/lib/admin/emails';

if (!process.env.NEXTAUTH_SECRET) {
  throw new Error('[Auth config] Missing NEXTAUTH_SECRET. Set NEXTAUTH_SECRET in .env.local');
}

function readAuthEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var ${name} for Auth.js email provider`);
  }
  return value;
}

export const authConfig = {
  adapter: PrismaAdapter(prisma) as Adapter,
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/admin/signin',
    error: '/admin/not-authorized',
  },
  providers: [
    EmailProvider({
      from: readAuthEnv('MAIL_FROM'),
      server: {
        host: readAuthEnv('SMTP_HOST'),
        port: Number(process.env.SMTP_PORT || 465),
        secure: Number(process.env.SMTP_PORT || 465) === 465,
        auth: {
          user: readAuthEnv('SMTP_USER'),
          pass: readAuthEnv('SMTP_PASS'),
        },
      },
      maxAge: 10 * 60,
    }),
  ],
  callbacks: {
    async signIn({ user, email }) {
      const emailParam = (email as { email?: string } | undefined)?.email;
      const candidate = (user?.email ?? emailParam ?? '').toLowerCase();
      if (isAdminEmail(candidate)) {
        return true;
      }

      if (user?.id) {
        try {
          await prisma.user.delete({ where: { id: user.id } });
        } catch (err) {
          console.warn('[auth] Failed to cleanup unauthorized user', err);
        }
      }
      return false;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const role = (token.role as UserRole | undefined) ?? session.user.role ?? 'admin';
        session.user.id = token.sub ?? session.user.id;
        session.user.role = role;
      }
      return session;
    },
  },
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET,
} satisfies NextAuthConfig;

const authHandler = NextAuth(authConfig);

export const { auth, handlers, signIn, signOut } = authHandler;
