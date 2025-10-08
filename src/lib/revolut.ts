// src/lib/revolut.ts
import 'server-only';

export type RevolutCreateOrderInput = {
  amountMinor: number;
  currency: string; // es. 'EUR'
  merchantOrderId: string;
  customer?: { email?: string; name?: string | null };
  description?: string;
  captureMode?: 'automatic' | 'manual';
  /**
   * Facoltativi: utili per il chiamante (UI/flow),
   * NON vengono inviati all'API Orders.
   */
  returnUrl?: string;
  cancelUrl?: string;
};

export type RevolutOrder = {
  id: string;
  public_id?: string;
  public_token?: string;
  public_url?: string;
  token?: string;
  checkout_url?: string;
  state:
    | 'pending'
    | 'processing'
    | 'authorised'
    | 'completed'
    | 'cancelled'
    | 'failed'
    | 'declined'
    | string;
  amount: number;
  currency: string;
  _links?: Array<{ rel?: string; href?: string }>;
};

function getApiBase() {
  // Priorità: override esplicito -> env 'production'/'live' -> sandbox
  const overr = process.env.REVOLUT_API_BASE?.replace(/\/$/, '');
  if (overr) return `${overr}/api`;
  const env = (process.env.REVOLUT_ENV || 'sandbox').toLowerCase();
  const host =
    env === 'production' || env === 'live'
      ? 'https://merchant.revolut.com'
      : 'https://sandbox-merchant.revolut.com';
  return `${host.replace(/\/$/, '')}/api`;
}

const BASE = getApiBase();
const API_VERSION = process.env.REVOLUT_API_VERSION || '2024-10-01'; // metti la tua versione API
const SECRET = process.env.REVOLUT_SECRET_KEY;

function assertEnv() {
  if (!SECRET) throw new Error('Missing REVOLUT_SECRET_KEY');
  if (!API_VERSION) throw new Error('Missing REVOLUT_API_VERSION');
}

function reqHeaders() {
  assertEnv();
  return {
    Authorization: `Bearer ${SECRET!}`,
    'Revolut-Api-Version': API_VERSION,
    'Content-Type': 'application/json',
  } as const;
}

export async function revolutFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: { ...reqHeaders(), ...(init?.headers || {}) },
    cache: 'no-store',
  });

  if (!res.ok) {
    let payload = '';
    try {
      payload = await res.text();
    } catch {
      // ignore
    }
    const method = (init?.method || 'GET').toUpperCase();
    throw new Error(`Revolut API ${res.status} ${method} ${path} :: ${payload}`);
  }

  return res.json() as Promise<T>;
}

export type CreateRevolutOrderResult = {
  paymentRef: string;
  checkoutPublicId?: string;
  hostedPaymentUrl?: string;
};

export async function createRevolutOrder(
  input: RevolutCreateOrderInput
): Promise<CreateRevolutOrderResult> {
  // NOTA: returnUrl/cancelUrl NON vengono inviati all'API Orders (le tieni per la UI/redirect).
  const { amountMinor, currency, description, merchantOrderId, customer, captureMode } = input;

  const body = {
    amount: amountMinor,
    currency,
    description,
    merchant_order_data: { reference: merchantOrderId },
    customer: customer?.email ? { email: customer.email } : undefined,
    capture_mode: captureMode ?? 'automatic',
  } satisfies Record<string, unknown>;

  const resp = await revolutFetch<RevolutOrder>('/orders', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!resp?.id) {
    throw new Error('Missing id in Create Order response');
  }

  const checkoutPublicId =
    resp.public_id ||
    resp.token ||
    (resp as { publicId?: string }).publicId ||
    undefined;

  const hostedPaymentUrl = (() => {
    if (typeof resp.checkout_url === 'string' && resp.checkout_url) return resp.checkout_url;
    if (typeof resp.public_url === 'string' && resp.public_url) return resp.public_url;
    const link = Array.isArray(resp._links)
      ? resp._links.find((item) => item?.rel === 'public_url' || item?.rel === 'checkout')
      : null;
    if (link?.href) return link.href;
    if (resp._links && !Array.isArray(resp._links)) {
      const maybeLink = (resp._links as Record<string, { href?: string }>);
      if (typeof maybeLink?.public_url?.href === 'string') return maybeLink.public_url.href;
      if (typeof maybeLink?.checkout?.href === 'string') return maybeLink.checkout.href;
    }
    if (checkoutPublicId) {
      const env = (process.env.NEXT_PUBLIC_REVOLUT_ENV || process.env.REVOLUT_ENV || 'sandbox').toLowerCase();
      const base = env === 'sandbox' ? 'https://sandbox-merchant.revolut.com' : 'https://merchant.revolut.com';
      return `${base.replace(/\/$/, '')}/pay/${checkoutPublicId}`;
    }
    return undefined;
  })();

  return {
    paymentRef: resp.id,
    checkoutPublicId,
    hostedPaymentUrl,
  };
}

export async function retrieveRevolutOrder(orderId: string): Promise<RevolutOrder> {
  return revolutFetch<RevolutOrder>(`/orders/${encodeURIComponent(orderId)}`, { method: 'GET' });
}

export function isRevolutPaid(state?: string) {
  // Pagato solo quando 'completed'
  return state === 'completed';
}
