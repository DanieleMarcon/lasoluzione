// src/app/fake-payment/layout.tsx
import { Suspense } from 'react';

export default function FakePaymentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Basta qualsiasi fallback (anche null) per soddisfare Next
  return <Suspense fallback={null}>{children}</Suspense>;
}
