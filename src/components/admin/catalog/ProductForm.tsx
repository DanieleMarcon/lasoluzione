'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, CSSProperties, FormEvent } from 'react';

import { ToastProvider, useToast } from '@/components/admin/ui/toast';

export type AdminProduct = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  ingredients: string | null;
  allergens: string | null;
  priceCents: number;
  unitCostCents: number;
  supplierName: string | null;
  stockQty: number;
  imageUrl: string | null;
  category: string | null;
  order: number;
  active: boolean;
  isVegan: boolean;
  isVegetarian: boolean;
  isGlutenFree: boolean;
  isLactoseFree: boolean;
  isOrganic: boolean;
  createdAt: string;
  updatedAt: string;
};

type ProductFormState = {
  name: string;
  slug: string;
  description: string;
  ingredients: string;
  allergens: string;
  priceCents: string;
  unitCostCents: string;
  supplierName: string;
  stockQty: string;
  imageUrl: string;
  category: string;
  order: string;
  active: boolean;
  isVegan: boolean;
  isVegetarian: boolean;
  isGlutenFree: boolean;
  isLactoseFree: boolean;
  isOrganic: boolean;
};

export type ProductFormInitialValues = Partial<
  Pick<
    AdminProduct,
    | 'name'
    | 'slug'
    | 'description'
    | 'ingredients'
    | 'allergens'
    | 'priceCents'
    | 'unitCostCents'
    | 'supplierName'
    | 'stockQty'
    | 'imageUrl'
    | 'category'
    | 'order'
    | 'active'
    | 'isVegan'
    | 'isVegetarian'
    | 'isGlutenFree'
    | 'isLactoseFree'
    | 'isOrganic'
  >
>;

type ProductFormProps = {
  productId?: number;
  initialValues?: ProductFormInitialValues;
  onSuccess?: (product: AdminProduct) => void;
  onCancel?: () => void;
};

const DEFAULT_STATE: ProductFormState = {
  name: '',
  slug: '',
  description: '',
  ingredients: '',
  allergens: '',
  priceCents: '0,00',
  unitCostCents: '0',
  supplierName: '',
  stockQty: '0',
  imageUrl: '',
  category: '',
  order: '0',
  active: true,
  isVegan: false,
  isVegetarian: false,
  isGlutenFree: false,
  isLactoseFree: false,
  isOrganic: false,
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function toStringValue(value: string | null | undefined) {
  return value ?? '';
}

function toNumberString(value: number | null | undefined, fallback = '0') {
  return value != null ? String(value) : fallback;
}

function buildState(values?: ProductFormInitialValues): ProductFormState {
  if (!values) return { ...DEFAULT_STATE };
  return {
    name: values.name ?? DEFAULT_STATE.name,
    slug: values.slug ?? DEFAULT_STATE.slug,
    description: toStringValue(values.description),
    ingredients: toStringValue(values.ingredients),
    allergens: toStringValue(values.allergens),
    priceCents:
      values.priceCents != null ? formatPriceInput(values.priceCents) : DEFAULT_STATE.priceCents,
    unitCostCents: toNumberString(values.unitCostCents, DEFAULT_STATE.unitCostCents),
    supplierName: toStringValue(values.supplierName),
    stockQty: toNumberString(values.stockQty, DEFAULT_STATE.stockQty),
    imageUrl: toStringValue(values.imageUrl),
    category: toStringValue(values.category),
    order: toNumberString(values.order, DEFAULT_STATE.order),
    active: values.active ?? DEFAULT_STATE.active,
    isVegan: values.isVegan ?? DEFAULT_STATE.isVegan,
    isVegetarian: values.isVegetarian ?? DEFAULT_STATE.isVegetarian,
    isGlutenFree: values.isGlutenFree ?? DEFAULT_STATE.isGlutenFree,
    isLactoseFree: values.isLactoseFree ?? DEFAULT_STATE.isLactoseFree,
    isOrganic: values.isOrganic ?? DEFAULT_STATE.isOrganic,
  };
}

function parseRequiredInt(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function parseOptionalInt(value: string) {
  if (!value.trim()) {
    return 0;
  }
  return parseRequiredInt(value);
}

function formatPriceInput(cents: number) {
  return (cents / 100).toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parsePriceInput(value: string) {
  const normalized = value.replace(/\s+/g, '').replace(',', '.');
  if (!normalized) {
    return null;
  }
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Math.round(parsed * 100);
}

export default function ProductForm({ productId, initialValues, onSuccess, onCancel }: ProductFormProps) {
  const toast = useToast();
  const [form, setForm] = useState<ProductFormState>(() => buildState(initialValues));
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(() => Boolean(initialValues?.slug?.trim()));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setForm(buildState(initialValues));
    setSlugManuallyEdited(Boolean(initialValues?.slug?.trim()));
  }, [initialValues, productId]);

  const handleNameChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      setForm((prev) => {
        const updated: ProductFormState = { ...prev, name: nextValue };
        const prevAuto = slugify(prev.name);
        const shouldAutoUpdate = !slugManuallyEdited || prev.slug === prevAuto;
        if (shouldAutoUpdate) {
          updated.slug = slugify(nextValue);
        }
        return updated;
      });
    },
    [slugManuallyEdited]
  );

  const handleSlugChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, slug: value }));
    const trimmed = value.trim();
    setSlugManuallyEdited(Boolean(trimmed));
  };

  const handleSlugBlur = () => {
    setForm((prev) => {
      if (!prev.slug.trim() && prev.name.trim()) {
        return { ...prev, slug: slugify(prev.name) };
      }
      return prev;
    });
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const trimmedName = form.name.trim();
    if (trimmedName.length < 2) {
      toast.error('Il nome deve contenere almeno 2 caratteri');
      return;
    }

    const priceCents = parsePriceInput(form.priceCents);
    if (priceCents === null) {
      toast.error('Prezzo non valido (minimo 0)');
      return;
    }

    const unitCostCents = parseOptionalInt(form.unitCostCents);
    if (unitCostCents === null) {
      toast.error('Costo unitario non valido');
      return;
    }

    const stockQty = parseOptionalInt(form.stockQty);
    if (stockQty === null) {
      toast.error('Giacenza non valida');
      return;
    }

    const order = parseOptionalInt(form.order);
    if (order === null) {
      toast.error('Ordine non valido');
      return;
    }

    const slugInput = form.slug.trim();
    const finalSlug = slugInput ? slugify(slugInput) : '';

    const payload: Record<string, unknown> = {
      name: trimmedName,
      description: form.description.trim() || undefined,
      ingredients: form.ingredients.trim() || undefined,
      allergens: form.allergens.trim() || undefined,
      priceCents,
      unitCostCents,
      supplierName: form.supplierName.trim() || undefined,
      stockQty,
      imageUrl: form.imageUrl.trim() || undefined,
      category: form.category.trim() || undefined,
      order,
      active: form.active,
      isVegan: form.isVegan,
      isVegetarian: form.isVegetarian,
      isGlutenFree: form.isGlutenFree,
      isLactoseFree: form.isLactoseFree,
      isOrganic: form.isOrganic,
    };

    if (finalSlug) {
      payload.slug = finalSlug;
    }

    const endpoint = productId ? `/api/admin/products/${productId}` : '/api/admin/products';
    const method = productId ? 'PATCH' : 'POST';

    setSubmitting(true);
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body?.ok) {
        const errorCode = body?.error;
        if (errorCode === 'slug_conflict') {
          toast.error('Slug già in uso, scegline un altro');
        } else if (errorCode === 'validation_error') {
          toast.error('Dati non validi: controlla i campi');
        } else {
          toast.error('Errore durante il salvataggio');
        }
        return;
      }

      const product = body.data as AdminProduct;
      toast.success(productId ? 'Prodotto aggiornato' : 'Prodotto creato');
      onSuccess?.(product);
      if (!productId) {
        setForm({ ...DEFAULT_STATE });
        setSlugManuallyEdited(false);
      }
    } catch (error) {
      console.error('[ProductForm] submit error', error);
      toast.error('Errore di rete, riprova');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Nome *</span>
          <input
            type="text"
            value={form.name}
            onChange={handleNameChange}
            required
            minLength={2}
            style={inputStyle}
          />
        </label>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Slug</span>
          <input
            type="text"
            value={form.slug}
            onChange={handleSlugChange}
            onBlur={handleSlugBlur}
            style={inputStyle}
            placeholder="auto dal nome se vuoto"
          />
        </label>
      </div>

      <label style={{ display: 'grid', gap: '0.25rem' }}>
        <span>Descrizione</span>
        <textarea
          value={form.description}
          onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </label>

      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <label style={fieldLabelStyle}>
          <span>Ingredienti</span>
          <input
            type="text"
            value={form.ingredients}
            onChange={(event) => setForm((prev) => ({ ...prev, ingredients: event.target.value }))}
            style={inputStyle}
          />
        </label>
        <label style={fieldLabelStyle}>
          <span>Allergeni</span>
          <input
            type="text"
            value={form.allergens}
            onChange={(event) => setForm((prev) => ({ ...prev, allergens: event.target.value }))}
            style={inputStyle}
          />
        </label>
      </div>

      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <label style={fieldLabelStyle}>
          <span>Prezzo (€)</span>
          <input
            type="text"
            inputMode="decimal"
            value={form.priceCents}
            onChange={(event) => setForm((prev) => ({ ...prev, priceCents: event.target.value }))}
            style={inputStyle}
            placeholder="0,00"
            required
          />
        </label>
        <label style={fieldLabelStyle}>
          <span>Costo unitario (cent)</span>
          <input
            type="number"
            min={0}
            step={1}
            value={form.unitCostCents}
            onChange={(event) => setForm((prev) => ({ ...prev, unitCostCents: event.target.value }))}
            style={inputStyle}
          />
        </label>
        <label style={fieldLabelStyle}>
          <span>Giacenza</span>
          <input
            type="number"
            min={0}
            step={1}
            value={form.stockQty}
            onChange={(event) => setForm((prev) => ({ ...prev, stockQty: event.target.value }))}
            style={inputStyle}
          />
        </label>
        <label style={fieldLabelStyle}>
          <span>Ordine</span>
          <input
            type="number"
            min={0}
            step={1}
            value={form.order}
            onChange={(event) => setForm((prev) => ({ ...prev, order: event.target.value }))}
            style={inputStyle}
          />
        </label>
      </div>

      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <label style={fieldLabelStyle}>
          <span>Fornitore</span>
          <input
            type="text"
            value={form.supplierName}
            onChange={(event) => setForm((prev) => ({ ...prev, supplierName: event.target.value }))}
            style={inputStyle}
          />
        </label>
        <label style={fieldLabelStyle}>
          <span>Categoria</span>
          <input
            type="text"
            value={form.category}
            onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
            style={inputStyle}
          />
        </label>
        <label style={fieldLabelStyle}>
          <span>Immagine (URL)</span>
          <input
            type="url"
            value={form.imageUrl}
            onChange={(event) => setForm((prev) => ({ ...prev, imageUrl: event.target.value }))}
            style={inputStyle}
            placeholder="https://..."
          />
        </label>
      </div>

      <fieldset
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: '1rem',
          display: 'grid',
          gap: '0.75rem',
        }}
      >
        <legend style={{ padding: '0 0.5rem', fontWeight: 600 }}>Flag nutrizionali</legend>
        <label style={checkboxLabelStyle}>
          <input
            type="checkbox"
            checked={form.isVegan}
            onChange={(event) => setForm((prev) => ({ ...prev, isVegan: event.target.checked }))}
          />
          <span>Vegano (🌱)</span>
        </label>
        <label style={checkboxLabelStyle}>
          <input
            type="checkbox"
            checked={form.isVegetarian}
            onChange={(event) => setForm((prev) => ({ ...prev, isVegetarian: event.target.checked }))}
          />
          <span>Vegetariano (🥕)</span>
        </label>
        <label style={checkboxLabelStyle}>
          <input
            type="checkbox"
            checked={form.isGlutenFree}
            onChange={(event) => setForm((prev) => ({ ...prev, isGlutenFree: event.target.checked }))}
          />
          <span>Senza glutine (🌾🚫)</span>
        </label>
        <label style={checkboxLabelStyle}>
          <input
            type="checkbox"
            checked={form.isLactoseFree}
            onChange={(event) => setForm((prev) => ({ ...prev, isLactoseFree: event.target.checked }))}
          />
          <span>Senza lattosio (🥛🚫)</span>
        </label>
        <label style={checkboxLabelStyle}>
          <input
            type="checkbox"
            checked={form.isOrganic}
            onChange={(event) => setForm((prev) => ({ ...prev, isOrganic: event.target.checked }))}
          />
          <span>Biologico (♻️)</span>
        </label>
      </fieldset>

      <label style={checkboxLabelStyle}>
        <input
          type="checkbox"
          checked={form.active}
          onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
        />
        <span>Prodotto attivo</span>
      </label>

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            style={secondaryButtonStyle}
            disabled={submitting}
          >
            Annulla
          </button>
        ) : null}
        <button type="submit" style={primaryButtonStyle} disabled={submitting}>
          {submitting ? 'Salvataggio…' : productId ? 'Salva modifiche' : 'Crea prodotto'}
        </button>
      </div>
    </form>
  );
}

const inputStyle: CSSProperties = {
  borderRadius: 10,
  border: '1px solid #d1d5db',
  padding: '0.6rem 0.75rem',
  fontSize: '0.95rem',
  width: '100%',
  boxSizing: 'border-box',
};

const fieldLabelStyle: CSSProperties = {
  display: 'grid',
  gap: '0.25rem',
};

const checkboxLabelStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  fontSize: '0.95rem',
};

const primaryButtonStyle: CSSProperties = {
  padding: '0.65rem 1.2rem',
  borderRadius: 10,
  border: 'none',
  backgroundColor: '#1d4ed8',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
};

const secondaryButtonStyle: CSSProperties = {
  padding: '0.65rem 1.2rem',
  borderRadius: 10,
  border: '1px solid #d1d5db',
  backgroundColor: '#fff',
  color: '#1f2937',
  fontWeight: 500,
  cursor: 'pointer',
};

type FilterState = {
  q: string;
  active: 'all' | 'true' | 'false';
  category: string;
};

type MetaState = {
  total: number;
  totalPages: number;
  pageSize: number;
};

const PAGE_SIZE = 20;
const INITIAL_FILTERS: FilterState = { q: '', active: 'all', category: '' };

function AdminCatalogProductsManager() {
  const toast = useToast();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const filtersRef = useRef<FilterState>(INITIAL_FILTERS);
  const [searchDraft, setSearchDraft] = useState('');
  const [categoryDraft, setCategoryDraft] = useState('');
  const [activeDraft, setActiveDraft] = useState<'all' | 'true' | 'false'>('all');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<MetaState>({ total: 0, totalPages: 1, pageSize: PAGE_SIZE });
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const pageRef = useRef<number>(1);

  const loadProducts = useCallback(
    async (options?: { page?: number; filters?: FilterState }) => {
      const targetFilters = options?.filters ?? filtersRef.current;
      const targetPage = options?.page ?? pageRef.current;

      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(targetPage));
      params.set('pageSize', String(PAGE_SIZE));
      if (targetFilters.q.trim()) params.set('q', targetFilters.q.trim());
      if (targetFilters.category.trim()) params.set('category', targetFilters.category.trim());
      if (targetFilters.active !== 'all') params.set('active', targetFilters.active);

      try {
        const response = await fetch(`/api/admin/products?${params.toString()}`, {
          cache: 'no-store',
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || !body?.ok) {
          toast.error('Impossibile caricare i prodotti');
          return;
        }
        setProducts(body.data as AdminProduct[]);
        const appliedFilters: FilterState = {
          q: targetFilters.q,
          category: targetFilters.category,
          active: targetFilters.active,
        };
        filtersRef.current = appliedFilters;
        setSearchDraft(appliedFilters.q);
        setCategoryDraft(appliedFilters.category);
        setActiveDraft(appliedFilters.active);
        const nextPage = body.meta?.page ?? targetPage;
        setPage(nextPage);
        pageRef.current = nextPage;
        setMeta({
          total: body.meta?.total ?? 0,
          totalPages: body.meta?.totalPages ?? 1,
          pageSize: body.meta?.pageSize ?? PAGE_SIZE,
        });
      } catch (error) {
        console.error('[AdminCatalogProductsManager] load error', error);
        toast.error('Errore di rete durante il caricamento');
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    // primo caricamento
    loadProducts({ page: 1, filters: INITIAL_FILTERS }).catch((error) => {
      console.error('[AdminCatalogProductsManager] initial load error', error);
    });
  }, [loadProducts]);

  const totalLabel = useMemo(() => {
    return `${meta.total} prodotti`;
  }, [meta.total]);

  const openCreate = () => {
    setEditingProduct(null);
    setShowForm(true);
  };

  const openEdit = (product: AdminProduct) => {
    setEditingProduct(product);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingProduct(null);
  };

  const refreshAfterChange = async () => {
    await loadProducts();
  };

  const handleToggleActive = async (product: AdminProduct) => {
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !product.active }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body?.ok) {
        toast.error('Impossibile aggiornare lo stato');
        return;
      }
      toast.success(!product.active ? 'Prodotto attivato' : 'Prodotto disattivato');
      await refreshAfterChange();
    } catch (error) {
      console.error('[AdminCatalogProductsManager] toggle error', error);
      toast.error('Errore di rete');
    }
  };

  const handleDelete = async (product: AdminProduct) => {
    const confirmDelete = window.confirm(`Eliminare definitivamente "${product.name}"?`);
    if (!confirmDelete) return;
    try {
      const response = await fetch(`/api/admin/products/${product.id}?hard=true`, {
        method: 'DELETE',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body?.ok) {
        toast.error('Impossibile eliminare il prodotto');
        return;
      }
      toast.success('Prodotto eliminato');
      await refreshAfterChange();
    } catch (error) {
      console.error('[AdminCatalogProductsManager] delete error', error);
      toast.error('Errore di rete');
    }
  };

  const applyFilters = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await loadProducts({ page: 1, filters: { q: searchDraft, category: categoryDraft, active: activeDraft } });
  };

  const resetFilters = async () => {
    setSearchDraft('');
    setCategoryDraft('');
    setActiveDraft('all');
    await loadProducts({ page: 1, filters: INITIAL_FILTERS });
  };

  const goPrev = async () => {
    if (pageRef.current <= 1) return;
    await loadProducts({ page: pageRef.current - 1 });
  };

  const goNext = async () => {
    if (pageRef.current >= meta.totalPages) return;
    await loadProducts({ page: pageRef.current + 1 });
  };

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Catalogo prodotti</h2>
          <p style={{ margin: '0.25rem 0 0', color: '#6b7280' }}>{totalLabel}</p>
        </div>
        <button type="button" onClick={openCreate} style={primaryButtonStyle}>
          Nuovo prodotto
        </button>
      </div>

      <form
        onSubmit={applyFilters}
        style={{
          display: 'grid',
          gap: '1rem',
          padding: '1rem',
          borderRadius: 12,
          backgroundColor: '#fff',
          border: '1px solid #e5e7eb',
        }}
      >
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <label style={fieldLabelStyle}>
            <span>Ricerca</span>
            <input
              type="text"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Nome o slug"
              style={inputStyle}
            />
          </label>
          <label style={fieldLabelStyle}>
            <span>Categoria</span>
            <input
              type="text"
              value={categoryDraft}
              onChange={(event) => setCategoryDraft(event.target.value)}
              placeholder="Categoria"
              style={inputStyle}
            />
          </label>
          <label style={fieldLabelStyle}>
            <span>Stato</span>
            <select
              value={activeDraft}
              onChange={(event) => setActiveDraft(event.target.value as FilterState['active'])}
              style={inputStyle}
            >
              <option value="all">Tutti</option>
              <option value="true">Solo attivi</option>
              <option value="false">Solo disattivi</option>
            </select>
          </label>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button type="button" onClick={resetFilters} style={secondaryButtonStyle} disabled={loading}>
            Resetta
          </button>
          <button type="submit" style={primaryButtonStyle} disabled={loading}>
            {loading ? 'Filtraggio…' : 'Applica filtri'}
          </button>
        </div>
      </form>

      <div
        style={{
          borderRadius: 12,
          border: '1px solid #e5e7eb',
          overflow: 'hidden',
          backgroundColor: '#fff',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ backgroundColor: '#f9fafb', textAlign: 'left' }}>
            <tr>
              <th style={headerCellStyle}>ID</th>
              <th style={headerCellStyle}>Nome</th>
              <th style={headerCellStyle}>Prezzo</th>
              <th style={headerCellStyle}>Categoria</th>
              <th style={headerCellStyle}>Giacenza</th>
              <th style={headerCellStyle}>Attivo</th>
              <th style={headerCellStyle}>Ordine</th>
              <th style={headerCellStyle}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '1.5rem', textAlign: 'center', color: '#6b7280' }}>
                  {loading ? 'Caricamento…' : 'Nessun prodotto trovato'}
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={bodyCellStyle}>{product.id}</td>
                  <td style={{ ...bodyCellStyle, fontWeight: 600 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                      <span>{product.name}</span>
                      <span style={{ display: 'flex', gap: '0.25rem', fontSize: '0.9rem' }}>
                        {product.isVegan ? <span title="Vegano">🌱</span> : null}
                        {product.isVegetarian ? <span title="Vegetariano">🥕</span> : null}
                        {product.isGlutenFree ? <span title="Senza glutine">🌾🚫</span> : null}
                        {product.isLactoseFree ? <span title="Senza lattosio">🥛🚫</span> : null}
                        {product.isOrganic ? <span title="Biologico">♻️</span> : null}
                      </span>
                    </div>
                  </td>
                  <td style={bodyCellStyle}>{formatPrice(product.priceCents)}</td>
                  <td style={bodyCellStyle}>{product.category ?? '—'}</td>
                  <td style={bodyCellStyle}>{product.stockQty}</td>
                  <td style={bodyCellStyle}>{product.active ? 'Sì' : 'No'}</td>
                  <td style={bodyCellStyle}>{product.order}</td>
                  <td style={bodyCellStyle}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button type="button" style={linkButtonStyle} onClick={() => openEdit(product)}>
                        Modifica
                      </button>
                      <button type="button" style={linkButtonStyle} onClick={() => handleToggleActive(product)}>
                        {product.active ? 'Disattiva' : 'Attiva'}
                      </button>
                      <button type="button" style={dangerButtonStyle} onClick={() => handleDelete(product)}>
                        Elimina
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#6b7280' }}>
          Pagina {page} di {meta.totalPages}
        </span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" onClick={goPrev} disabled={loading || page <= 1} style={secondaryButtonStyle}>
            Precedente
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={loading || page >= meta.totalPages}
            style={secondaryButtonStyle}
          >
            Successiva
          </button>
        </div>
      </div>

      {showForm ? (
        <div style={modalBackdropStyle}>
          <div style={modalContentStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>{editingProduct ? 'Modifica prodotto' : 'Nuovo prodotto'}</h3>
              <button type="button" onClick={closeForm} style={closeButtonStyle}>
                ×
              </button>
            </div>
            <ProductForm
              productId={editingProduct?.id}
              initialValues={editingProduct ?? undefined}
              onCancel={closeForm}
              onSuccess={async () => {
                await refreshAfterChange();
                closeForm();
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

const headerCellStyle: CSSProperties = {
  padding: '0.75rem',
  fontSize: '0.85rem',
  fontWeight: 600,
  color: '#374151',
};

const bodyCellStyle: CSSProperties = {
  padding: '0.75rem',
  fontSize: '0.9rem',
  color: '#1f2937',
  verticalAlign: 'top',
};

const linkButtonStyle: CSSProperties = {
  border: 'none',
  background: 'none',
  color: '#1d4ed8',
  padding: 0,
  cursor: 'pointer',
  fontWeight: 600,
};

const dangerButtonStyle: CSSProperties = {
  ...linkButtonStyle,
  color: '#b91c1c',
};

const modalBackdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(17, 24, 39, 0.55)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '1.5rem',
  zIndex: 2000,
};

const modalContentStyle: CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: 16,
  padding: '1.5rem',
  width: 'min(720px, 100%)',
  maxHeight: '90vh',
  overflowY: 'auto',
  boxShadow: '0 40px 80px rgba(15, 23, 42, 0.35)',
};

const closeButtonStyle: CSSProperties = {
  border: 'none',
  background: 'none',
  fontSize: '1.5rem',
  cursor: 'pointer',
  lineHeight: 1,
};

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

export function CatalogProductsPageClient() {
  return (
    <ToastProvider>
      <AdminCatalogProductsManager />
    </ToastProvider>
  );
}
