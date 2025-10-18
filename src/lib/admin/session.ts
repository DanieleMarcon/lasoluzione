// src/lib/admin/session.ts
import 'server-only';

import { isAdminEmail } from './emails';

import { auth } from '@/lib/auth';

export class AdminUnauthorizedError extends Error {
  constructor(message = 'User is not authorized to access admin resources') {
    super(message);
    this.name = 'AdminUnauthorizedError';
  }
}

async function realAssertAdmin() {
  const session = await auth();

  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    throw new AdminUnauthorizedError();
  }

  return session;
}

let assertAdminImpl = realAssertAdmin;

export async function assertAdmin() {
  return assertAdminImpl();
}

export function setAssertAdminImpl(impl: typeof realAssertAdmin) {
  assertAdminImpl = impl;
}

export function resetAssertAdminImpl() {
  assertAdminImpl = realAssertAdmin;
}

export function enforceAdminEmail(email: string | null | undefined) {
  if (!isAdminEmail(email ?? '')) {
    throw new AdminUnauthorizedError();
  }
}
