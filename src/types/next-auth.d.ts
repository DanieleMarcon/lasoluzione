// src/types/next-auth.d.ts
import type { UserRole } from '@prisma/client';
import type { DefaultSession, DefaultUser } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id: string;
      role: UserRole;
    };
  }

  interface User extends DefaultUser {
    role: UserRole;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: UserRole;
    sub?: string;
  }
}
