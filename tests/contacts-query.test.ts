import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CONTACTS_DEFAULT_PAGE_SIZE,
  CONTACTS_MAX_PAGE_SIZE,
  buildContactsFilters,
  buildContactsWhere,
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

    assert.equal(filters.search, 'Example');
    assert.equal(filters.newsletter, 'all');
    assert.equal(filters.privacy, 'all');
    assert.equal(filters.from, undefined);
    assert.equal(filters.to, undefined);
  });

  it('applies boolean and date filters with normalized values', () => {
    const params = new URLSearchParams([
      ['newsletter', 'true'],
      ['privacy', 'false'],
      ['from', '2024-01-05'],
      ['to', '2024-02-10'],
    ]);

    const filters = buildContactsFilters(params);

    assert.equal(filters.newsletter, 'true');
    assert.equal(filters.privacy, 'false');
    assert.equal(filters.from, '2024-01-05T00:00:00.000Z');
    assert.equal(filters.to, '2024-02-11T00:00:00.000Z');
  });

  it('supports the legacy search parameter when q is missing', () => {
    const params = new URLSearchParams([
      ['search', 'Legacy'],
    ]);

    const filters = buildContactsFilters(params);

    assert.equal(filters.search, 'Legacy');
  });

  it('falls back to 1=1 when no filters are provided', () => {
    const params = new URLSearchParams();

    const filters = buildContactsFilters(params);

    assert.equal(filters.search, undefined);
    assert.equal(filters.newsletter, 'all');
    assert.equal(filters.privacy, 'all');
    assert.equal(filters.from, undefined);
    assert.equal(filters.to, undefined);
  });
});

describe('buildContactsWhere', () => {
  it('produces SQL with parameters for search and dates', () => {
    const { whereClause } = buildContactsWhere({
      search: 'Example',
      newsletter: 'true',
      privacy: 'false',
      from: '2024-01-05T00:00:00.000Z',
      to: '2024-02-11T00:00:00.000Z',
    });

    assert.equal(typeof whereClause.sql, 'string');
    assert.match(
      whereClause.sql,
      /WHERE \(name ILIKE \? OR email ILIKE \? OR phone ILIKE \?\) AND agreeMarketing = true AND agreePrivacy = false AND createdAt >= \? AND createdAt < \?/,
    );
    assert.deepEqual(whereClause.values, [
      '%Example%',
      '%Example%',
      '%Example%',
      '2024-01-05T00:00:00.000Z',
      '2024-02-11T00:00:00.000Z',
    ]);
  });

  it('returns an empty clause when no filters are applied', () => {
    const { whereClause } = buildContactsWhere({});

    assert.equal(whereClause.sql, '');
    assert.deepEqual(whereClause.values, []);
  });
});
