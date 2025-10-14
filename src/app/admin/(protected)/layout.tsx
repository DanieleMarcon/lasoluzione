import type { ReactNode } from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  // Se NON loggato -> vai alla signin
  if (!session?.user) {
    redirect('/admin/signin?from=/admin');
  }

  // Se loggato -> rendi l'area privata
  return <>{children}</>;
}
