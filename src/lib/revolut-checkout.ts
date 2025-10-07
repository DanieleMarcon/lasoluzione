const REVOLUT_SDK_URL = 'https://checkout.revolut.com/checkout.js';

type RevolutCheckoutInstance = {
  payWithPopup(options: {
    onSuccess?: () => void;
    onError?: () => void;
    onCancel?: () => void;
  }): void;
};

declare global {
  interface Window {
    RevolutCheckout?: (token: string, environment: string) => RevolutCheckoutInstance;
  }
}

async function loadRevolutSdk(): Promise<void> {
  if (typeof window === 'undefined') return;

  if (typeof window.RevolutCheckout === 'function') {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${REVOLUT_SDK_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Impossibile caricare Revolut Checkout SDK')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = REVOLUT_SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Impossibile caricare Revolut Checkout SDK'));
    document.head.appendChild(script);
  });
}

export default async function loadRevolutCheckout(token: string, environment: string): Promise<RevolutCheckoutInstance> {
  if (typeof window === 'undefined') {
    throw new Error('Revolut Checkout SDK non disponibile in ambiente server.');
  }

  await loadRevolutSdk();

  const factory = window.RevolutCheckout;
  if (typeof factory !== 'function') {
    throw new Error('Revolut Checkout SDK non disponibile.');
  }

  return factory(token, environment);
}
