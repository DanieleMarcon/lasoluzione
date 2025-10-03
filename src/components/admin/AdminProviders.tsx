'use client';

import type { ReactNode } from 'react';
import type { Session } from 'next-auth';
import { SessionProvider } from 'next-auth/react';

type Props = {
  session: Session;
  children: ReactNode;
};

export default function AdminProviders({ session, children }: Props) {
  return <SessionProvider session={session}>{children}</SessionProvider>;
}
