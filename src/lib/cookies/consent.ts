// Cookie consent: parse + serialize (versionato)
export type Categories = {
  essential: true;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
};

export type ConsentSnapshot = {
  policyVersion: string;
  categories: Categories;
  timestamp: number;
};

type SerializeOptions = {
  maxAge?: number;
  path?: string;
  sameSite?: 'Lax' | 'Strict' | 'None';
  secure?: boolean;
};

const COOKIE_PREFIX = 'consent_v';
const DEFAULT_MAX_AGE = 60 * 60 * 24 * 180; // 180 giorni
const DEFAULT_PATH = '/';

const normalize = (input?: Partial<Categories>): Categories => ({
  essential: true,
  functional: Boolean(input?.functional),
  analytics: Boolean(input?.analytics),
  marketing: Boolean(input?.marketing),
});

export function parseConsent(
  cookieHeader?: string,
  expectedVersion?: string
): ConsentSnapshot | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .filter(Boolean);

  const targetName = expectedVersion
    ? `${COOKIE_PREFIX}${expectedVersion}`
    : undefined;

  const entry =
    (targetName && cookies.find((c) => c.startsWith(`${targetName}=`))) ??
    cookies.find((c) => c.startsWith(COOKIE_PREFIX));

  if (!entry) return null;

  const [, rawValue = ''] = entry.split('=');
  if (!rawValue) return null;

  try {
    const decoded = decodeURIComponent(rawValue);
    const parsed = JSON.parse(decoded) as Partial<ConsentSnapshot>;
    if (!parsed || typeof parsed !== 'object') return null;

    if (typeof parsed.policyVersion !== 'string') return null;
    if (typeof parsed.timestamp !== 'number') return null;

    return {
      policyVersion: parsed.policyVersion,
      timestamp: parsed.timestamp,
      categories: normalize(parsed.categories as Partial<Categories>),
    };
  } catch {
    return null;
  }
}

export function serializeConsent(
  consent: ConsentSnapshot,
  options: SerializeOptions = {}
): string {
  const name = `${COOKIE_PREFIX}${consent.policyVersion}`;
  const value = encodeURIComponent(JSON.stringify(consent));
  const maxAge = options.maxAge ?? DEFAULT_MAX_AGE;
  const path = options.path ?? DEFAULT_PATH;
  const sameSite = options.sameSite ?? 'Lax';
  const secure = options.secure ?? process.env.NODE_ENV === 'production';

  let serialized = `${name}=${value}; Max-Age=${maxAge}; Path=${path}; SameSite=${sameSite}`;
  if (secure) serialized += '; Secure';
  return serialized;
}
