// src/app/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'La Soluzione',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
