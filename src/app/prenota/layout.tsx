import type { ReactNode } from 'react';

export const metadata = {
  title: 'Prenota – La Soluzione',
  description: 'Prenota un tavolo o un evento al Bar La Soluzione.',
};

export default function BookingLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
