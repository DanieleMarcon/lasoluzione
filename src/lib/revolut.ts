import 'server-only';

export type RevolutCreateOrderInput = {
  amountMinor: number;
  currency: string; // e.g. 'EUR'
  merchantOrderId: string;
  customer?: { email?: string; name?: string | null };
  description?: string;
  captureMode?: 'automatic' | 'manual';
};

export type RevolutOrder = {
  id: string;
  token: string; // public identifier for widget
  state: 'pending' | 'processing' | 'authorised' | 'completed' | 'cancelled' | 'failed' | 'declined' | string;
  amount: number;
  currency: string;
};

const BASE = `${(process.env.REVOLUT_API_BASE || 'https://sandbox-merchant.revolut.com').replace(/\/$/, '')}/api`;
const API_VERSION = process.env.REVOLUT_API_VERSION!;
const SECRET = process.env.REVOLUT_SECRET_KEY!;

function reqHeaders() {
  return {
    Authorization: `Bearer ${SECRET}`,
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
    const text = await res.text().catch(() => '');
    throw new Error(`Revolut API ${res.status} ${init?.method || 'GET'} ${path} :: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function createRevolutOrder(input: RevolutCreateOrderInput): Promise<{ paymentRef: string; token: string }> {
  const body = {
    amount: input.amountMinor,
    currency: input.currency,
    description: input.description,
    merchant_order_data: { reference: input.merchantOrderId },
    customer: input.customer?.email ? { email: input.customer.email } : undefined,
    capture_mode: input.captureMode ?? 'automatic',
  } satisfies Record<string, unknown>;

  const resp = await revolutFetch<RevolutOrder>('/orders', { method: 'POST', body: JSON.stringify(body) });
  if (!resp.id || !('token' in resp)) throw new Error('Missing token/id in Create Order response');
  return { paymentRef: resp.id, token: (resp as { token: string }).token };
}

export async function retrieveRevolutOrder(orderId: string): Promise<RevolutOrder> {
  return revolutFetch<RevolutOrder>(`/orders/${encodeURIComponent(orderId)}`, { method: 'GET' });
}

export function isRevolutPaid(state?: string) {
  return state === 'completed';
}
