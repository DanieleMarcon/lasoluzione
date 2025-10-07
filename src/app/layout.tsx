import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'La Soluzione',
  description: 'Prenota e costruisci il tuo menù',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
