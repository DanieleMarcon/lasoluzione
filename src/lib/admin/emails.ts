// src/lib/admin/emails.ts
/**
 * Helpers to read and normalize the ADMIN_EMAILS env var.
 */
let cachedEmails: string[] | null = null;

function parseAdminEmails(): string[] {
  const source = process.env.ADMIN_EMAILS ?? '';
  return source
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function getAdminEmails(): string[] {
  if (cachedEmails && process.env.NODE_ENV !== 'development') {
    return cachedEmails;
  }

  const emails = parseAdminEmails();
  if (!emails.length) {
    console.warn('[admin] ADMIN_EMAILS env var is empty. Admin access will be disabled.');
  }

  cachedEmails = emails;
  return emails;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.trim().toLowerCase());
}
