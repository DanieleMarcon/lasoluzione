import type { ReactNode } from 'react';

export const metadata = {
  title: 'Informativa privacy – La Soluzione',
  description: 'Consulta l’informativa sul trattamento dei dati personali del Bar La Soluzione.',
};

export default function PrivacyLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
