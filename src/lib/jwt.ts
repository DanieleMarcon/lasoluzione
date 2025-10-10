import { createHmac, timingSafeEqual } from 'crypto';

type SignOptions = {
  expiresInSeconds?: number;
};

type BasePayload = Record<string, unknown> & {
  iat?: number;
  exp?: number;
};

function base64UrlEncode(value: Buffer | string): string {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(value: string): Buffer {
  const paddingNeeded = (4 - (value.length % 4)) % 4;
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(paddingNeeded);
  return Buffer.from(padded, 'base64');
}

export function signJwt(payload: BasePayload, secret: string, options?: SignOptions): string {
  if (!secret) {
    throw new Error('Missing JWT secret');
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresIn = options?.expiresInSeconds ?? 15 * 60;
  const header = { alg: 'HS256', typ: 'JWT' };
  const completePayload: BasePayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn,
  };

  const headerEncoded = base64UrlEncode(JSON.stringify(header));
  const payloadEncoded = base64UrlEncode(JSON.stringify(completePayload));
  const data = `${headerEncoded}.${payloadEncoded}`;

  const signature = createHmac('sha256', secret).update(data).digest();
  const signatureEncoded = base64UrlEncode(signature);

  return `${data}.${signatureEncoded}`;
}

export type VerifyResult<TPayload extends BasePayload = BasePayload> =
  | { valid: true; payload: TPayload }
  | { valid: false; reason: 'malformed' | 'signature' | 'expired' | 'error' };

export function verifyJwt<TPayload extends BasePayload = BasePayload>(
  token: string,
  secret: string
): VerifyResult<TPayload> {
  try {
    if (!secret) {
      throw new Error('Missing JWT secret');
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, reason: 'malformed' };
    }

    const [headerEncoded, payloadEncoded, signatureEncoded] = parts;
    const data = `${headerEncoded}.${payloadEncoded}`;

    const expectedSignature = createHmac('sha256', secret).update(data).digest();
    const providedSignature = base64UrlDecode(signatureEncoded);

    if (expectedSignature.length !== providedSignature.length) {
      return { valid: false, reason: 'signature' };
    }

    if (!timingSafeEqual(expectedSignature, providedSignature)) {
      return { valid: false, reason: 'signature' };
    }

    const payloadBuffer = base64UrlDecode(payloadEncoded);
    const raw = payloadBuffer.toString('utf8');
    const payload = JSON.parse(raw) as TPayload;

    if (typeof payload.exp === 'number') {
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp <= now) {
        return { valid: false, reason: 'expired' };
      }
    }

    return { valid: true, payload };
  } catch (error) {
    console.error('[jwt] verify error', error);
    return { valid: false, reason: 'error' };
  }
}
