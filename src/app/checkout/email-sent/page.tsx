// src/app/checkout/email-sent/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import ClientPage from './ClientPage';

export default function Page() {
  return <ClientPage />;
}
