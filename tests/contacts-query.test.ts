import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CONTACTS_DEFAULT_PAGE_SIZE,
  CONTACTS_MAX_PAGE_SIZE,
  buildContactsFilters,
  type ContactsFilters,
} from '@/lib/admin/contacts-query';

function build(filters: ContactsFilters = {}, options?: Parameters<typeof buildContactsFilters>[1]) {
  return buildContactsFilters(filters, options);
}

describe('buildContactsFilters', () => {
  it('normalizes values, applies defaults and clamps pagination', () => {
    const result = build({
      search: '  Rossi  ',
      newsletter: 'true',
      privacy: 'maybe' as any,
      from: '2024-01-05',
      to: 'invalid-date',
      page: 0 as any,
      pageSize: 5000 as any,
    });

    assert.equal(result.search, 'Rossi');
    assert.equal(result.newsletter, 'true');
    assert.equal(result.privacy, 'all');
    assert.equal(result.from, '2024-01-05');
    assert.equal(result.to, null);
    assert.equal(result.page, 1);
    assert.equal(result.pageSize, CONTACTS_MAX_PAGE_SIZE);
    assert.equal(result.limit, CONTACTS_MAX_PAGE_SIZE);
    assert.equal(result.offset, 0);
  });

  it('defaults newsletter/privacy to all and pageSize to default when missing', () => {
    const result = build();

    assert.equal(result.newsletter, 'all');
    assert.equal(result.privacy, 'all');
    assert.equal(result.page, 1);
    assert.equal(result.pageSize, CONTACTS_DEFAULT_PAGE_SIZE);
    assert.equal(result.limit, CONTACTS_DEFAULT_PAGE_SIZE);
    assert.equal(result.offset, 0);
  });

  it('supports custom pagination bounds', () => {
    const result = build(
      { page: 2 as any, pageSize: 1500 as any },
      { defaultPageSize: 500, maxPageSize: 1500 },
    );

    assert.equal(result.page, 2);
    assert.equal(result.pageSize, 1500);
    assert.equal(result.limit, 1500);
    assert.equal(result.offset, 1500);
  });
});

