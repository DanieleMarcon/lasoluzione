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
    const clause = filters.whereClause;

    assert.equal(clause.sql.includes('name ILIKE'), true);
    assert.equal(clause.sql.includes('email ILIKE'), true);
    assert.equal(clause.sql.includes('phone ILIKE'), true);
    assert.deepEqual(clause.values, ['%Example%', '%Example%', '%Example%']);
  });

  it('applies boolean and date filters with normalized values', () => {
    const params = new URLSearchParams([
      ['newsletter', 'true'],
      ['privacy', 'false'],
      ['from', '2024-01-05'],
      ['to', '2024-02-10'],
    ]);

    const filters = buildContactsFilters(params);
    const clause = filters.whereClause;

    assert.equal(clause.sql.includes('newsletter_opt_in ='), true);
    assert.equal(clause.sql.includes('privacy_opt_in ='), true);
    assert.equal(clause.sql.includes('last_contact_at >='), true);
    assert.equal(clause.sql.includes('last_contact_at <'), true);
    assert.deepEqual(clause.values, [true, false, new Date('2024-01-05T00:00:00.000Z'), new Date('2024-02-11T00:00:00.000Z')]);
  });

  it('supports the legacy search parameter when q is missing', () => {
    const params = new URLSearchParams([
      ['search', 'Legacy'],
    ]);

    const filters = buildContactsFilters(params);
    const clause = filters.whereClause;

    assert.equal(clause.sql.includes('name ILIKE'), true);
    assert.deepEqual(clause.values, ['%Legacy%', '%Legacy%', '%Legacy%']);
  });

  it('falls back to 1=1 when no filters are provided', () => {
    const params = new URLSearchParams();

    const filters = buildContactsFilters(params);
    const clause = filters.whereClause;

    assert.equal(clause.sql, '');
    assert.deepEqual(clause.values, []);
  });
});
