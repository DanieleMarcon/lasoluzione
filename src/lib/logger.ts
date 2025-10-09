export type LogLevel = 'info' | 'warn' | 'error';

export type LogMeta = {
  bookingId?: number | null;
  orderId?: string | null;
  eventInstanceId?: number | null;
  email?: string | null;
  tokenId?: number | string | null;
  action?: string;
  outcome?: string;
  [key: string]: unknown;
};

function maskEmail(value: string): string {
  const trimmed = value.trim();
  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 0) {
    return trimmed;
  }

  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);

  if (local.length <= 2) {
    return `${local.charAt(0)}****@${domain}`;
  }

  const first = local.charAt(0);
  const last = local.charAt(local.length - 1);
  const stars = '*'.repeat(Math.max(local.length - 2, 1));

  return `${first}${stars}${last}@${domain}`;
}

function normalizeMeta(meta?: LogMeta): Record<string, unknown> {
  if (!meta) return {};

  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined) continue;
    if (key === 'email' && typeof value === 'string') {
      normalized[key] = maskEmail(value);
      continue;
    }
    normalized[key] = value;
  }

  return normalized;
}

function emit(level: LogLevel, message: string, meta?: LogMeta): void {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...normalizeMeta(meta),
  };

  const serialized = JSON.stringify(payload);

  if (level === 'error') {
    console.error(serialized);
  } else if (level === 'warn') {
    console.warn(serialized);
  } else {
    console.log(serialized);
  }
}

export const logger = {
  info(message: string, meta?: LogMeta) {
    emit('info', message, meta);
  },
  warn(message: string, meta?: LogMeta) {
    emit('warn', message, meta);
  },
  error(message: string, meta?: LogMeta) {
    emit('error', message, meta);
  },
};

export default logger;
