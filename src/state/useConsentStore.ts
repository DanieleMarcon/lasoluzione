'use client';
import { create } from 'zustand';

type Categories = { essential: true; functional: boolean; analytics: boolean; marketing: boolean };
type ConsentState = {
  policyVersion: string;
  categories: Categories;
  timestamp?: number;
  set: (patch: Partial<Omit<ConsentState, 'set'>>) => void;
  reset: () => void;
};
const DEFAULT: ConsentState = {
  policyVersion: process.env.NEXT_PUBLIC_POLICY_VERSION || '1.0.0',
  categories: { essential: true, functional: false, analytics: false, marketing: false },
  timestamp: undefined,
  set: () => {},
  reset: () => {}
};

export const useConsentStore = create<ConsentState>((set) => ({
  ...DEFAULT,
  set: (patch) => set((s) => ({ ...s, ...patch })),
  reset: () => set(DEFAULT)
}));
