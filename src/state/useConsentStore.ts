'use client';

import { create } from 'zustand';
import {
  parseConsent,
  serializeConsent,
  type Categories,
  type ConsentSnapshot,
} from '@/lib/cookies/consent';

type MutableCategory = Exclude<keyof Categories, 'essential'>;

type ConsentStore = {
  policyVersion: string;
  categories: Categories; // stato applicato
  draft: Categories;      // stato in modale
  timestamp?: number;
  isPreferencesOpen: boolean;

  // azioni
  acceptAll: () => void;
  rejectAll: () => void;
  openPreferences: () => void;
  closePreferences: () => void;
  setCategory: (category: MutableCategory, value: boolean) => void;
  loadFromCookie: (cookieHeader?: string) => void;
  saveToCookie: () => void;
};

const POLICY_VERSION = process.env.NEXT_PUBLIC_POLICY_VERSION || '1.0.0';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

const DEFAULTS: Categories = {
  essential: true,
  functional: false,
  analytics: false,
  marketing: false,
};

const normalize = (input?: Partial<Categories>): Categories => ({
  ...DEFAULTS,
  ...input,
  essential: true,
});

const persist = (consent: ConsentSnapshot) => {
  if (typeof document === 'undefined') return;
  document.cookie = serializeConsent(consent, {
    maxAge: COOKIE_MAX_AGE,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  });
};

const initialState = (): Omit<
  ConsentStore,
  | 'acceptAll'
  | 'rejectAll'
  | 'openPreferences'
  | 'closePreferences'
  | 'setCategory'
  | 'loadFromCookie'
  | 'saveToCookie'
> => {
  const parsed =
    typeof document !== 'undefined'
      ? parseConsent(document.cookie, POLICY_VERSION)
      : null;

  if (parsed && parsed.policyVersion === POLICY_VERSION) {
    const categories = normalize(parsed.categories);
    return {
      policyVersion: parsed.policyVersion,
      categories,
      draft: categories,
      timestamp: parsed.timestamp,
      isPreferencesOpen: false,
    };
  }

  const categories = normalize();
  return {
    policyVersion: POLICY_VERSION,
    categories,
    draft: categories,
    timestamp: undefined,
    isPreferencesOpen: false,
  };
};

export const useConsentStore = create<ConsentStore>((set, get) => ({
  ...initialState(),

  acceptAll: () => {
    const categories = normalize({
      functional: true,
      analytics: true,
      marketing: true,
    });
    const timestamp = Date.now();
    set({
      categories,
      draft: categories,
      timestamp,
      policyVersion: POLICY_VERSION,
      isPreferencesOpen: false,
    });
    persist({ policyVersion: POLICY_VERSION, categories, timestamp });
  },

  rejectAll: () => {
    const categories = normalize();
    const timestamp = Date.now();
    set({
      categories,
      draft: categories,
      timestamp,
      policyVersion: POLICY_VERSION,
      isPreferencesOpen: false,
    });
    persist({ policyVersion: POLICY_VERSION, categories, timestamp });
  },

  openPreferences: () => {
    set((s) => ({
      isPreferencesOpen: true,
      draft: normalize(s.categories),
    }));
  },

  closePreferences: () => {
    set((s) => ({
      isPreferencesOpen: false,
      draft: normalize(s.categories),
    }));
  },

  setCategory: (category, value) => {
    set((s) => ({
      draft: { ...s.draft, [category]: value },
    }));
  },

  loadFromCookie: (cookieHeader) => {
    const parsed = parseConsent(
      cookieHeader ??
        (typeof document !== 'undefined' ? document.cookie : undefined),
      POLICY_VERSION
    );
    if (!parsed || parsed.policyVersion !== POLICY_VERSION) return;

    const categories = normalize(parsed.categories);
    set({
      policyVersion: parsed.policyVersion,
      categories,
      draft: categories,
      timestamp: parsed.timestamp,
    });
  },

  saveToCookie: () => {
    const categories = normalize(get().draft);
    const timestamp = Date.now();
    set({
      categories,
      draft: categories,
      timestamp,
      policyVersion: POLICY_VERSION,
    });
    persist({ policyVersion: POLICY_VERSION, categories, timestamp });
  },
}));
