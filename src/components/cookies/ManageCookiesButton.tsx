// src/components/cookies/ManageCookiesButton.tsx
'use client';

import { useConsentStore } from '@/state/useConsentStore';

type Props = {
  className?: string;
  children?: React.ReactNode;
};

export default function ManageCookiesButton({ className, children }: Props) {
  const openPreferences = useConsentStore((s) => s.openPreferences);

  return (
    <button
      type="button"
      onClick={openPreferences}
      aria-haspopup="dialog"
      aria-controls="cookie-preferences"
      className={className}
    >
      {children ?? 'Gestisci cookie'}
    </button>
  );
}
