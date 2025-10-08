import 'server-only';

export type RevolutPaymentMeta = {
  provider: 'revolut';
  orderId: string;
  hostedPaymentUrl?: string;
  emailSentAt?: string;
  emailError?: string;
};

export type PaymentRefMeta = RevolutPaymentMeta;

export type ParsedPaymentRef =
  | { kind: 'empty'; raw: null }
  | { kind: 'free'; raw: 'FREE' }
  | { kind: 'unknown'; raw: string }
  | { kind: 'revolut'; raw: string; meta: RevolutPaymentMeta };

export function encodeRevolutPaymentMeta(meta: RevolutPaymentMeta): string {
  const { provider: _provider, ...rest } = meta;
  return JSON.stringify({ ...rest, provider: 'revolut' });
}

export function parsePaymentRef(value: string | null | undefined): ParsedPaymentRef {
  if (!value) {
    return { kind: 'empty', raw: null };
  }

  if (value === 'FREE') {
    return { kind: 'free', raw: 'FREE' };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { kind: 'unknown', raw: value };
  }

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Partial<RevolutPaymentMeta> & { provider?: string };
      if (parsed && parsed.provider === 'revolut' && typeof parsed.orderId === 'string' && parsed.orderId) {
        return {
          kind: 'revolut',
          raw: value,
          meta: {
            provider: 'revolut',
            orderId: parsed.orderId,
            hostedPaymentUrl: parsed.hostedPaymentUrl,
            emailSentAt: parsed.emailSentAt,
            emailError: parsed.emailError,
          },
        };
      }
    } catch (error) {
      console.warn('[paymentRef] unable to parse JSON paymentRef', error);
      return { kind: 'unknown', raw: value };
    }
  }

  return { kind: 'unknown', raw: value };
}

export function mergeEmailStatus(
  meta: RevolutPaymentMeta,
  result: { ok: boolean; skipped?: boolean; error?: string }
): RevolutPaymentMeta {
  if (result.ok) {
    return { ...meta, emailSentAt: new Date().toISOString(), emailError: undefined };
  }

  const errorMessage = result.skipped
    ? result.error ?? 'Invio email non eseguito (configurazione SMTP assente).'
    : result.error ?? 'Invio email fallito.';

  return { ...meta, emailError: errorMessage, emailSentAt: undefined };
}
