'use client';

const SANDBOX_SDK_URL = 'https://sandbox-merchant.revolut.com/sdk.js';
const PROD_SDK_URL = 'https://merchant.revolut.com/sdk.js';

export type RevolutCheckoutInstance = {
  pay: () => Promise<void>;
  [key: string]: unknown;
};

export type RevolutCheckoutLoader = (
  checkoutPublicId: string,
  options: {
    mode?: 'sandbox' | 'prod';
    locale?: string;
    publicToken: string;
  }
) => Promise<RevolutCheckoutInstance>;

declare global {
  interface Window {
    RevolutCheckout?: RevolutCheckoutLoader;
  }
}

let revolutPromise: Promise<RevolutCheckoutLoader> | null = null;

function getScriptUrl() {
  const env = (process.env.NEXT_PUBLIC_REVOLUT_ENV || 'sandbox').toLowerCase();
  return env === 'sandbox' ? SANDBOX_SDK_URL : PROD_SDK_URL;
}

async function injectRevolutScript(): Promise<RevolutCheckoutLoader> {
  if (typeof window === 'undefined') {
    throw new Error('Revolut Checkout SDK non disponibile in ambiente server.');
  }

  if (typeof window.RevolutCheckout === 'function') {
    return window.RevolutCheckout;
  }

  const src = getScriptUrl();

  await new Promise<void>((resolve, reject) => {
    const selector = `script[data-revolut-sdk="${src}"]`;
    const existing = document.querySelector<HTMLScriptElement>(selector);
    if (existing) {
      if (existing.hasAttribute('data-revolut-loaded')) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('Impossibile caricare Revolut Checkout SDK')),
        { once: true }
      );
      return;
    }

    const stale = document.querySelector<HTMLScriptElement>('script[data-revolut-sdk]');
    if (stale) {
      stale.remove();
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.setAttribute('data-revolut-sdk', src);
    script.addEventListener('load', () => {
      script.setAttribute('data-revolut-loaded', 'true');
      resolve();
    });
    script.addEventListener('error', () => {
      script.remove();
      reject(new Error('Impossibile caricare Revolut Checkout SDK'));
    });
    document.head.appendChild(script);
  });

  if (typeof window.RevolutCheckout !== 'function') {
    throw new Error('Revolut Checkout SDK non disponibile.');
  }

  return window.RevolutCheckout;
}

export async function loadRevolutSDK(): Promise<RevolutCheckoutLoader> {
  if (typeof window === 'undefined') {
    throw new Error('Revolut Checkout SDK non disponibile in ambiente server.');
  }

  if (typeof window.RevolutCheckout === 'function') {
    return window.RevolutCheckout;
  }

  if (!revolutPromise) {
    revolutPromise = injectRevolutScript().catch((error) => {
      revolutPromise = null;
      throw error;
    });
  }

  return revolutPromise;
}
