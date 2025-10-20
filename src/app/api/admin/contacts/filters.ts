import {
  buildContactsFilters,
  type ContactsFilters,
  type NormalizedContactsFilters,
} from '@/lib/admin/contacts-query';

type BuildOptions = Parameters<typeof buildContactsFilters>[1];

function normalizeBooleanFlag(value: string | null): ContactsFilters['newsletter'] {
  if (value === 'true' || value === 'false') return value;
  if (value === 'yes') return 'true';
  if (value === 'no') return 'false';
  return 'all';
}

function parseInteger(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

export function resolveContactsFilters(
  searchParams: URLSearchParams,
  options?: BuildOptions,
): { filters: NormalizedContactsFilters; queryLog: Record<string, string> } {
  const query: ContactsFilters = {
    search: searchParams.get('q') ?? searchParams.get('search'),
    newsletter: normalizeBooleanFlag(searchParams.get('newsletter')),
    privacy: normalizeBooleanFlag(searchParams.get('privacy')),
    from: searchParams.get('from'),
    to: searchParams.get('to'),
    page: parseInteger(searchParams.get('page')),
    pageSize: parseInteger(searchParams.get('pageSize')),
  };

  const filters = buildContactsFilters(query, options);
  const queryLog: Record<string, string> = {
    search: filters.search ?? '',
    newsletter: filters.newsletter,
    privacy: filters.privacy,
    from: filters.from ?? '',
    to: filters.to ?? '',
    page: String(filters.page),
    pageSize: String(filters.pageSize),
  };

  return { filters, queryLog };
}

export function resolveContactsFiltersWithPage(
  searchParams: URLSearchParams,
  options?: BuildOptions,
): {
  filters: NormalizedContactsFilters;
  pagination: { page: number; pageSize: number };
  queryLog: Record<string, string>;
} {
  const { filters, queryLog } = resolveContactsFilters(searchParams, options);
  return {
    filters,
    pagination: { page: filters.page, pageSize: filters.pageSize },
    queryLog,
  };
}
