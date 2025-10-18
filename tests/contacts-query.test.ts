import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CONTACTS_DEFAULT_PAGE_SIZE,
  CONTACTS_MAX_PAGE_SIZE,
  buildContactsFilters,
  resolveContactsPagination,
} from '@/lib/admin/contacts-query';

describe('resolveContactsPagination', () => {
  it('returns defaults when parameters are missing', () => {
    const params = new URLSearchParams();

    const result = resolveContactsPagination(params);

    assert.equal(result.page, 1);
    assert.equal(result.pageSize, CONTACTS_DEFAULT_PAGE_SIZE);
    assert.equal(result.skip, 0);
  });

  it('normalizes invalid values and clamps to max page size', () => {
    const params = new URLSearchParams([
      ['page', '0'],
      ['pageSize', '200'],
    ]);

    const result = resolveContactsPagination(params);

    assert.equal(result.page, 1);
    assert.equal(result.pageSize, CONTACTS_MAX_PAGE_SIZE);
    assert.equal(result.skip, 0);
  });

  it('computes skip correctly for valid inputs', () => {
    const params = new URLSearchParams([
      ['page', '3'],
      ['pageSize', '15'],
    ]);

    const result = resolveContactsPagination(params);

    assert.equal(result.page, 3);
    assert.equal(result.pageSize, 15);
    assert.equal(result.skip, 30);
  });
});

describe('buildContactsFilters', () => {
  it('prefers the q parameter when both q and search are provided', () => {
    const params = new URLSearchParams([
      ['q', 'Example'],
      ['search', 'Legacy'],
    ]);

    const filters = buildContactsFilters(params);

    assert.match(filters.whereClause, /LOWER\(name\) LIKE \?/);
    assert.equal(filters.params.length, 3);
    assert.deepEqual(filters.params, ['%example%', '%example%', '%example%']);
  });

  it('applies boolean and date filters with normalized values', () => {
    const params = new URLSearchParams([
      ['newsletter', 'true'],
      ['privacy', 'false'],
      ['from', '2024-01-05'],
      ['to', '2024-02-10'],
    ]);

    const filters = buildContactsFilters(params);

    assert.equal(filters.whereClause.includes('agreeMarketing = ?'), true);
    assert.equal(filters.whereClause.includes('agreePrivacy = ?'), true);
    assert.equal(filters.whereClause.includes('createdAt >= ?'), true);
    assert.equal(filters.whereClause.includes('createdAt <= ?'), true);
    assert.equal(filters.params.length, 4);
    assert.deepEqual(filters.params, [1, 0, '2024-01-05T00:00:00.000Z', '2024-02-10T23:59:59.999Z']);
  });

  it('supports the legacy search parameter when q is missing', () => {
    const params = new URLSearchParams([
      ['search', 'Legacy'],
    ]);

    const filters = buildContactsFilters(params);

    assert.match(filters.whereClause, /LOWER\(name\) LIKE \?/);
    assert.equal(filters.params.length, 3);
    assert.deepEqual(filters.params, ['%legacy%', '%legacy%', '%legacy%']);
  });

  it('falls back to 1=1 when no filters are provided', () => {
    const params = new URLSearchParams();

    const filters = buildContactsFilters(params);

    assert.equal(filters.whereClause, '1=1');
    assert.deepEqual(filters.params, []);
  });
});
