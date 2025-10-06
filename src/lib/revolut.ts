import 'server-only';

type RevolutCreateOrderInput = {
  amountMinor: number;            // cents
  currency: 'EUR';
  merchantOrderId: string;        // local Order.id
  customer?: { email?: string; name?: string | null };
  description?: string;
  successUrl: string;
  cancelUrl: string;
};

type RevolutOrderResponse = {
  id: string;                     // Revolut order/payment id
  public_id?: string;             // token for client widget (exact field per doc)
  state?: string;                 // status field (approved, pending, failed...)
  amount?: number;
  currency?: string;
};

const BASE = process.env.REVOLUT_API_BASE!;
const API_VERSION = process.env.REVOLUT_API_VERSION!;
const SECRET = process.env.REVOLUT_SECRET_KEY!;

function reqHeaders() {
  return {
    'Authorization': `Bearer ${SECRET}`,
    'Revolut-Api-Version': API_VERSION,
    'Content-Type': 'application/json',
  };
}

export async function revolutFetch<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...reqHeaders(), ...(init?.headers || {}) },
    cache: 'no-store',
    // timeouts handled by platform; keep it simple
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Revolut API ${res.status} on ${path}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// NOTE: endpoint path/body shape can differ slightly by API version; keep adapter layer here.
export async function createRevolutOrder(input: RevolutCreateOrderInput): Promise<{ paymentRef: string; publicId: string }> {
  // Example body — adapt keys if your API version requires different names.
  const body = {
    amount: input.amountMinor,
    currency: input.currency,
    merchant_order_id: input.merchantOrderId,
    description: input.description,
    customer: {
      email: input.customer?.email,
      name: input.customer?.name || undefined,
    },
    // success/cancel URLs may live under "checkout" or "payment" options depending on API version
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    capture_mode: 'automatic',
  };

  const resp = await revolutFetch<RevolutOrderResponse>('/orders', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  const paymentRef = resp.id;
  const publicId = resp.public_id || '';
  if (!paymentRef || !publicId) {
    throw new Error('Missing paymentRef/publicId from Revolut create order response');
  }
  return { paymentRef, publicId };
}

export async function retrieveRevolutOrder(paymentRef: string): Promise<RevolutOrderResponse> {
  return revolutFetch<RevolutOrderResponse>(`/orders/${encodeURIComponent(paymentRef)}`, {
    method: 'GET',
  });
}

export function isRevolutPaid(state?: string) {
  // Map Revolut states to "paid"
  return state === 'approved' || state === 'completed' || state === 'paid' || state === 'settled';
}
