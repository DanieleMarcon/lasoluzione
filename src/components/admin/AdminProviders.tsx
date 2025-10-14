// src/components/admin/AdminProviders.tsx
'use client';

import type { ReactNode } from 'react';
import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';

type NavLink = { href: string; label: string };

type Props = {
  children: ReactNode;
  // accetta anche null per evitare errori di typing quando il layout la calcola
  session: Session | null;
  // rendiamo opzionali per non bloccare il build
  links?: NavLink[];
  userEmail?: string;
};

export default function AdminProviders({
  children,
  session,
  links = [],
  userEmail,
}: Props) {
  // Se ti servono `links` e `userEmail` per un contesto o un header,
  // puoi esporli via context qui. Per ora li lasciamo solo tipizzati.
  return <SessionProvider session={session}>{children}</SessionProvider>;
}
