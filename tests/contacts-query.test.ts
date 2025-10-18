import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Prisma } from '@prisma/client';

import {
  CONTACTS_DEFAULT_PAGE_SIZE,
  CONTACTS_MAX_PAGE_SIZE,
  buildContactsWhere,
  parseContactsFilters,
  resolveContactsPagination,
  type ContactsFilters,
} from '@/lib/admin/contacts-query';

function toSql(sql: Prisma.Sql) {
  let statement = '';
  for (let i = 0; i < sql.strings.length; i += 1) {
    statement += sql.strings[i];
    if (i < sql.values.length) statement += '?';
  }
  return statement.replace(/\[object Object\]/g, ' AND ').trim();
}

describe('parseContactsFilters', () => {
  it('prefers the q parameter when both q and search are provided', () => {
    const params = new URLSearchParams([
      ['q', 'Example'],
      ['search', 'Legacy'],
    ]);

    const filters = parseContactsFilters(params);

    assert.equal(filters.search, 'Example');
  });

  it('normalizes boolean and date filters with sanitized values', () => {
    const params = new URLSearchParams([
      ['newsletter', 'true'],
      ['privacy', 'false'],
      ['from', '2024-01-05'],
      ['to', '2024-02-10'],
    ]);

    const filters = parseContactsFilters(params);

    assert.equal(filters.newsletter, 'true');
    assert.equal(filters.privacy, 'false');
    assert.equal(typeof filters.from, 'string');
    assert.equal(typeof filters.to, 'string');
  });

  it('falls back to defaults when values are invalid or missing', () => {
    const params = new URLSearchParams([
      ['newsletter', 'invalid'],
      ['privacy', 'maybe'],
      ['from', 'not-a-date'],
      ['to', ''],
    ]);

    const filters = parseContactsFilters(params);

    assert.equal(filters.newsletter, 'all');
    assert.equal(filters.privacy, 'all');
    assert.equal(filters.from, undefined);
    assert.equal(filters.to, undefined);
  });
});

describe('buildContactsWhere', () => {
  it('returns empty fragment when no filters are applied', () => {
    const filters: ContactsFilters = { privacy: 'all', newsletter: 'all' };
    const sql = buildContactsWhere(filters);

    assert.equal(toSql(sql), '');
    assert.equal(sql.values.length, 0);
  });

  it('joins search and boolean filters with AND', () => {
    const filters: ContactsFilters = {
      search: 'Test',
      privacy: 'true',
      newsletter: 'false',
    };

    const sql = buildContactsWhere(filters);

    assert.equal(
      toSql(sql),
      'WHERE (c.full_name ILIKE ? OR c.email ILIKE ? OR c.phone ILIKE ?) AND c.privacy_consent = true AND c.newsletter_optin = false',
    );
    assert.deepEqual(sql.values, ['%Test%', '%Test%', '%Test%']);
  });

  it('applies date range filters with inclusive/exclusive bounds', () => {
    const filters: ContactsFilters = {
      from: new Date('2024-01-05T00:00:00.000Z').toISOString(),
      to: new Date('2024-02-10T00:00:00.000Z').toISOString(),
    };

    const sql = buildContactsWhere(filters);
    const rendered = toSql(sql);

    assert.equal(
      rendered,
      "WHERE c.last_contact_at >= ? AND c.last_contact_at < ? + interval '1 day'",
    );
    assert.equal(sql.values.length, 2);
    assert.ok(sql.values[0] instanceof Date);
    assert.ok(sql.values[1] instanceof Date);
    assert.equal((sql.values[0] as Date).toISOString(), '2024-01-05T00:00:00.000Z');
    assert.equal((sql.values[1] as Date).toISOString(), '2024-02-10T00:00:00.000Z');
  });
});

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
