import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CONTACTS_DEFAULT_PAGE_SIZE,
  CONTACTS_MAX_PAGE_SIZE,
  parseContactsFilters,
  resolveContactsWhere,
  resolveContactsPagination,
} from '@/lib/admin/contacts-query';

describe('resolveContactsPagination', () => {
  it('returns defaults when parameters are missing', () => {
    const params = new URLSearchParams();

    const result = resolveContactsPagination(params);

    assert.equal(result.page, 1);
    assert.equal(result.pageSize, CONTACTS_DEFAULT_PAGE_SIZE);
    assert.equal(result.offset, 0);
  });

  it('normalizes invalid values and clamps to max page size', () => {
    const params = new URLSearchParams([
      ['page', '0'],
      ['pageSize', '200'],
    ]);

    const result = resolveContactsPagination(params);

    assert.equal(result.page, 1);
    assert.equal(result.pageSize, CONTACTS_MAX_PAGE_SIZE);
    assert.equal(result.offset, 0);
  });

  it('computes offset correctly for valid inputs', () => {
    const params = new URLSearchParams([
      ['page', '3'],
      ['pageSize', '15'],
    ]);

    const result = resolveContactsPagination(params);

    assert.equal(result.page, 3);
    assert.equal(result.pageSize, 15);
    assert.equal(result.offset, 30);
  });
});

describe('parseContactsFilters', () => {
  it('prefers the q parameter when both q and search are provided', () => {
    const params = new URLSearchParams([
      ['q', 'Example'],
      ['search', 'Legacy'],
    ]);

    const filters = parseContactsFilters(params);
    assert.equal(filters.search, 'Example');

    const where = resolveContactsWhere(filters);
    assert.equal(where.values.length, 3);
    assert.deepEqual(where.values, ['%example%', '%example%', '%example%']);
    assert.match(where.strings.join(' '), /LOWER\(b\.name\) LIKE/);
  });

  it('applies boolean and date filters with normalized values', () => {
    const params = new URLSearchParams([
      ['newsletter', 'true'],
      ['privacy', 'false'],
      ['from', '2024-01-05'],
      ['to', '2024-02-10'],
    ]);

    const filters = parseContactsFilters(params);

    assert.equal(filters.newsletter, 'true');
    assert.equal(filters.privacy, 'false');
    assert(filters.from instanceof Date);
    assert(filters.to instanceof Date);

    const where = resolveContactsWhere(filters);
    assert.equal(where.values.length, 2);

    const [from, to] = where.values as Date[];
    assert.equal(from.toISOString(), '2024-01-05T00:00:00.000Z');
    assert.equal(to.toISOString(), '2024-02-11T00:00:00.000Z');
  });

  it('returns empty filters when no parameters are provided', () => {
    const params = new URLSearchParams();

    const filters = parseContactsFilters(params);
    assert.equal(filters.search, undefined);
    assert.equal(filters.newsletter, 'all');
    assert.equal(filters.privacy, 'all');
    assert.equal(filters.from, undefined);
    assert.equal(filters.to, undefined);

    const where = resolveContactsWhere(filters);
    assert.equal(where.values.length, 0);
    assert.equal(where.strings.join(''), '');
  });
});
