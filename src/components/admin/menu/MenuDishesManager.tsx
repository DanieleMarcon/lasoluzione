'use client';

import { useCallback, useMemo, useState } from 'react';
import { ToastProvider, useToast } from '@/components/admin/ui/toast';

export type AdminMenuDish = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  priceCents: number;
  active: boolean;
  category: string | null;
  order: number;
  visibleAt: 'lunch' | 'dinner' | 'both';
  createdAt: string;
  updatedAt: string;
};

type MenuMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type Props = {
  initialDishes: AdminMenuDish[];
  initialMeta: MenuMeta;
};

type DishFormValues = {
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  active: boolean;
  category: string;
  order: number;
  visibleAt: 'lunch' | 'dinner' | 'both';
};

const emptyForm: DishFormValues = {
  name: '',
  slug: '',
  description: '',
  priceCents: 0,
  active: true,
  category: '',
  order: 0,
  visibleAt: 'both',
};

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

function formatVisibleAt(value: 'lunch' | 'dinner' | 'both') {
  switch (value) {
    case 'lunch':
      return 'Pranzo';
    case 'dinner':
      return 'Cena';
    default:
      return 'Pranzo e cena';
  }
}

function toFormValues(dish: AdminMenuDish): DishFormValues {
  return {
    name: dish.name,
    slug: dish.slug,
    description: dish.description ?? '',
    priceCents: dish.priceCents,
    active: dish.active,
    category: dish.category ?? '',
    order: dish.order,
    visibleAt: dish.visibleAt,
  };
}

function MenuDishesManagerInner({ initialDishes, initialMeta }: Props) {
  const toast = useToast();
  const [dishes, setDishes] = useState<AdminMenuDish[]>(initialDishes);
  const [meta, setMeta] = useState<MenuMeta>(initialMeta);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<DishFormValues>({ ...emptyForm });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<DishFormValues | null>(null);
  const [filterActive, setFilterActive] = useState<'all' | 'true' | 'false'>('all');
  const [filterCategory, setFilterCategory] = useState('');
  const [search, setSearch] = useState('');

  const pageSize = meta.pageSize;

  const loadDishes = useCallback(
    async (targetPage: number = meta.page) => {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(targetPage));
      params.set('pageSize', String(pageSize));
      if (filterActive !== 'all') params.set('active', filterActive);
      if (filterCategory.trim()) params.set('category', filterCategory.trim());
      if (search.trim()) params.set('q', search.trim());

      try {
        const res = await fetch(`/api/admin/menu/dishes?${params.toString()}`, {
          cache: 'no-store',
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || body?.error) {
          toast.error(body?.error || 'Impossibile caricare i piatti');
          return;
        }
        setDishes(body.data as AdminMenuDish[]);
        setMeta({
          page: body.page,
          pageSize: body.pageSize,
          total: body.total,
          totalPages: body.totalPages,
        });
      } catch (error) {
        console.error('[admin][menu] load error', error);
        toast.error('Errore di rete durante il caricamento');
      } finally {
        setLoading(false);
      }
    },
    [filterActive, filterCategory, search, pageSize, meta.page, toast]
  );

  const handleCreate = useCallback(async () => {
    if (!createForm.name.trim()) {
      toast.error('Inserisci un nome per il piatto');
      return;
    }
    if (!Number.isFinite(createForm.priceCents) || createForm.priceCents < 0) {
      toast.error('Prezzo non valido');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/admin/menu/dishes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name.trim(),
          slug: createForm.slug.trim() || undefined,
          description: createForm.description.trim() || undefined,
          priceCents: createForm.priceCents,
          active: createForm.active,
          category: createForm.category.trim() || undefined,
          order: createForm.order,
          visibleAt: createForm.visibleAt,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body?.error) {
        toast.error(body?.error === 'slug_conflict' ? 'Slug già in uso' : body?.error || 'Errore durante la creazione');
        return;
      }
      setCreateForm({ ...emptyForm });
      toast.success('Piatto creato');
      await loadDishes(1);
    } catch (error) {
      console.error('[admin][menu] create error', error);
      toast.error('Errore di rete durante la creazione');
    } finally {
      setCreating(false);
    }
  }, [createForm, loadDishes, toast]);

  const startEdit = (dish: AdminMenuDish) => {
    setEditingId(dish.id);
    setEditForm(toFormValues(dish));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleUpdate = useCallback(async () => {
    if (editingId == null || !editForm) return;
    if (!editForm.name.trim()) {
      toast.error('Il nome è obbligatorio');
      return;
    }
    if (!Number.isFinite(editForm.priceCents) || editForm.priceCents < 0) {
      toast.error('Prezzo non valido');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/menu/dishes/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          slug: editForm.slug.trim() || undefined,
          description: editForm.description.trim() || null,
          priceCents: editForm.priceCents,
          active: editForm.active,
          category: editForm.category.trim() || null,
          order: editForm.order,
          visibleAt: editForm.visibleAt,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body?.error) {
        toast.error(body?.error === 'slug_conflict' ? 'Slug già in uso' : body?.error || 'Errore durante l\'aggiornamento');
        return;
      }
      toast.success('Piatto aggiornato');
      cancelEdit();
      await loadDishes();
    } catch (error) {
      console.error('[admin][menu] update error', error);
      toast.error('Errore di rete durante l\'aggiornamento');
    } finally {
      setLoading(false);
    }
  }, [editingId, editForm, loadDishes, toast]);

  const handleToggleActive = useCallback(
    async (dish: AdminMenuDish) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/menu/dishes/${dish.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: !dish.active }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || body?.error) {
          toast.error(body?.error || 'Errore durante l\'aggiornamento');
        } else {
          toast.success(`Piatto ${!dish.active ? 'attivato' : 'disattivato'}`);
          await loadDishes();
        }
      } catch (error) {
        console.error('[admin][menu] toggle error', error);
        toast.error('Errore di rete');
      } finally {
        setLoading(false);
      }
    },
    [loadDishes, toast]
  );

  const handleDelete = useCallback(
    async (dish: AdminMenuDish) => {
      if (!window.confirm(`Disattivare il piatto “${dish.name}”?`)) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/menu/dishes/${dish.id}`, {
          method: 'DELETE',
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || body?.error) {
          toast.error(body?.error || 'Errore durante la disattivazione');
        } else {
          toast.success('Piatto disattivato');
          await loadDishes();
        }
      } catch (error) {
        console.error('[admin][menu] delete error', error);
        toast.error('Errore di rete');
      } finally {
        setLoading(false);
      }
    },
    [loadDishes, toast]
  );

  const applyFilters = () => {
    loadDishes(1);
  };

  const categories = useMemo(() => {
    const values = new Set<string>();
    dishes.forEach((dish) => {
      if (dish.category) values.add(dish.category);
    });
    return Array.from(values).sort();
  }, [dishes]);

  const canGoPrev = meta.page > 1;
  const canGoNext = meta.page < meta.totalPages;

  return (
    <section style={{ display: 'grid', gap: '1.5rem' }}>
      <header>
        <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Catalogo piatti pranzo</h1>
        <p style={{ color: '#6b7280', margin: '0.25rem 0 0' }}>
          Gestisci il menù utilizzato nelle prenotazioni per il pranzo.
        </p>
      </header>

      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 16,
          padding: '1.5rem',
          boxShadow: '0 10px 30px rgba(15,23,42,0.05)',
        }}
      >
        <h2 style={{ marginTop: 0 }}>Nuovo piatto</h2>
        <div style={{ display: 'grid', gap: '0.75rem', maxWidth: 480 }}>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>Nome *</span>
            <input
              type="text"
              value={createForm.name}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </label>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>Slug (opzionale)</span>
            <input
              type="text"
              value={createForm.slug}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, slug: e.target.value }))}
            />
          </label>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>Categoria</span>
            <input
              type="text"
              value={createForm.category}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, category: e.target.value }))}
            />
          </label>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>Descrizione</span>
            <textarea
              rows={2}
              value={createForm.description}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </label>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>Visibile per</span>
            <select
              value={createForm.visibleAt}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, visibleAt: e.target.value as 'lunch' | 'dinner' | 'both' }))}
            >
              <option value="both">Pranzo e cena</option>
              <option value="lunch">Solo pranzo</option>
              <option value="dinner">Solo cena</option>
            </select>
          </label>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <label style={{ display: 'grid', gap: '0.25rem', flex: 1 }}>
              <span>Prezzo (centesimi)</span>
              <input
                type="number"
                min={0}
                value={createForm.priceCents}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, priceCents: Number.parseInt(e.target.value, 10) || 0 }))
                }
              />
            </label>
            <label style={{ display: 'grid', gap: '0.25rem', width: 120 }}>
              <span>Ordine</span>
              <input
                type="number"
                value={createForm.order}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, order: Number.parseInt(e.target.value, 10) || 0 }))
                }
              />
            </label>
          </div>
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={createForm.active}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, active: e.target.checked }))}
            />
            Attivo
          </label>
          <button type="button" className="btn" onClick={handleCreate} disabled={creating}>
            {creating ? 'Creazione…' : 'Aggiungi piatto'}
          </button>
        </div>
      </div>

      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 16,
          padding: '1.5rem',
          boxShadow: '0 10px 30px rgba(15,23,42,0.05)',
        }}
      >
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>Stato</span>
            <select value={filterActive} onChange={(e) => setFilterActive(e.target.value as any)}>
              <option value="all">Tutti</option>
              <option value="true">Solo attivi</option>
              <option value="false">Solo disattivi</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>Categoria</span>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="">Tutte</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: '0.25rem', flex: 1 }}>
            <span>Ricerca</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome o descrizione" />
          </label>
          <button type="button" className="btn" onClick={() => applyFilters()} disabled={loading}>
            Aggiorna
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', backgroundColor: '#f9fafb' }}>
                <th style={{ padding: '0.75rem' }}>Nome</th>
                <th style={{ padding: '0.75rem' }}>Categoria</th>
                <th style={{ padding: '0.75rem' }}>Visibilità</th>
                <th style={{ padding: '0.75rem' }}>Prezzo</th>
                <th style={{ padding: '0.75rem' }}>Attivo</th>
                <th style={{ padding: '0.75rem' }}>Ordine</th>
                <th style={{ padding: '0.75rem' }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {dishes.map((dish) => (
                <tr key={dish.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '0.75rem' }}>
                    <div style={{ fontWeight: 600 }}>{dish.name}</div>
                    {dish.description && <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>{dish.description}</div>}
                  </td>
                  <td style={{ padding: '0.75rem' }}>{dish.category ?? '—'}</td>
                  <td style={{ padding: '0.75rem' }}>{formatVisibleAt(dish.visibleAt)}</td>
                  <td style={{ padding: '0.75rem' }}>{formatMoney(dish.priceCents)}</td>
                  <td style={{ padding: '0.75rem' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <input
                        type="checkbox"
                        checked={dish.active}
                        onChange={() => handleToggleActive(dish)}
                        disabled={loading}
                      />
                      {dish.active ? 'Attivo' : 'Off'}
                    </label>
                  </td>
                  <td style={{ padding: '0.75rem' }}>{dish.order}</td>
                  <td style={{ padding: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                    <button type="button" className="btn" onClick={() => startEdit(dish)} disabled={loading}>
                      Modifica
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => handleDelete(dish)}
                      disabled={loading}
                      style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}
                    >
                      Elimina
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '1rem',
          }}
        >
          <p style={{ margin: 0, color: '#6b7280' }}>Totale piatti: {meta.total}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn"
              onClick={() => loadDishes(meta.page - 1)}
              disabled={loading || !canGoPrev}
            >
              ← Prec.
            </button>
            <span>
              Pagina {meta.page} di {meta.totalPages}
            </span>
            <button
              type="button"
              className="btn"
              onClick={() => loadDishes(meta.page + 1)}
              disabled={loading || !canGoNext}
            >
              Succ. →
            </button>
          </div>
        </div>
      </div>

      {editingId != null && editForm && (
        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 16,
            padding: '1.5rem',
            boxShadow: '0 10px 30px rgba(15,23,42,0.05)',
          }}
        >
          <h2 style={{ marginTop: 0 }}>Modifica piatto</h2>
          <div style={{ display: 'grid', gap: '0.75rem', maxWidth: 480 }}>
            <label style={{ display: 'grid', gap: '0.25rem' }}>
              <span>Nome *</span>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
              />
            </label>
            <label style={{ display: 'grid', gap: '0.25rem' }}>
              <span>Slug</span>
              <input
                type="text"
                value={editForm.slug}
                onChange={(e) => setEditForm((prev) => (prev ? { ...prev, slug: e.target.value } : prev))}
              />
            </label>
            <label style={{ display: 'grid', gap: '0.25rem' }}>
              <span>Categoria</span>
              <input
                type="text"
                value={editForm.category}
                onChange={(e) => setEditForm((prev) => (prev ? { ...prev, category: e.target.value } : prev))}
              />
            </label>
            <label style={{ display: 'grid', gap: '0.25rem' }}>
              <span>Descrizione</span>
              <textarea
                rows={2}
                value={editForm.description}
                onChange={(e) => setEditForm((prev) => (prev ? { ...prev, description: e.target.value } : prev))}
              />
            </label>
            <label style={{ display: 'grid', gap: '0.25rem' }}>
              <span>Visibile per</span>
              <select
                value={editForm.visibleAt}
                onChange={(e) =>
                  setEditForm((prev) => (prev ? { ...prev, visibleAt: e.target.value as 'lunch' | 'dinner' | 'both' } : prev))
                }
              >
                <option value="both">Pranzo e cena</option>
                <option value="lunch">Solo pranzo</option>
                <option value="dinner">Solo cena</option>
              </select>
            </label>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <label style={{ display: 'grid', gap: '0.25rem', flex: 1 }}>
                <span>Prezzo (centesimi)</span>
                <input
                  type="number"
                  min={0}
                  value={editForm.priceCents}
                  onChange={(e) =>
                    setEditForm((prev) =>
                      prev ? { ...prev, priceCents: Number.parseInt(e.target.value, 10) || 0 } : prev
                    )
                  }
                />
              </label>
              <label style={{ display: 'grid', gap: '0.25rem', width: 120 }}>
                <span>Ordine</span>
                <input
                  type="number"
                  value={editForm.order}
                  onChange={(e) =>
                    setEditForm((prev) =>
                      prev ? { ...prev, order: Number.parseInt(e.target.value, 10) || 0 } : prev
                    )
                  }
                />
              </label>
            </div>
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={editForm.active}
                onChange={(e) => setEditForm((prev) => (prev ? { ...prev, active: e.target.checked } : prev))}
              />
              Attivo
            </label>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" className="btn" onClick={handleUpdate} disabled={loading}>
                Salva modifiche
              </button>
              <button type="button" className="btn" onClick={cancelEdit}>
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default function MenuDishesManager(props: Props) {
  return (
    <ToastProvider>
      <MenuDishesManagerInner {...props} />
    </ToastProvider>
  );
}
