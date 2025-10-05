"use client";

import { useToast } from '@/components/admin/ui/toast';
import type { CSSProperties } from 'react';
import { useCallback, useMemo, useState } from 'react';

type SectionProductRow = {
  productId: number;
  productName: string;
  slug: string | null;
  priceCents: number;
  order: number;
  featured: boolean;
  showInHome: boolean;
};

type SectionRow = {
  id: number;
  key: string;
  title: string;
  active: boolean;
  enableDateTime: boolean;
  displayOrder: number;
  products: SectionProductRow[];
};

type SectionSearchResult = {
  id: number;
  name: string;
  priceCents: number;
  slug: string;
};

type SectionSearchState = {
  term: string;
  loading: boolean;
  results: SectionSearchResult[];
  selectedProductId: number | null;
};

type AssignmentDraft = {
  order: number;
  featured: boolean;
  showInHome: boolean;
};

export default function SectionsPageClient({ initialSections }: { initialSections: SectionRow[] }) {
  const toast = useToast();

  const [sections, setSections] = useState<SectionRow[]>(initialSections);
  const [sectionDraftOrder, setSectionDraftOrder] = useState<Record<number, number>>(() => {
    const draft: Record<number, number> = {};
    for (const s of initialSections) draft[s.id] = s.displayOrder;
    return draft;
  });
  const [sectionSaving, setSectionSaving] = useState<Record<number, boolean>>({});
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<number, Record<number, AssignmentDraft>>>(() => {
    const draft: Record<number, Record<number, AssignmentDraft>> = {};
    for (const s of initialSections) {
      draft[s.id] = {};
      for (const p of s.products) {
        draft[s.id][p.productId] = {
          order: p.order,
          featured: p.featured,
          showInHome: p.showInHome,
        };
      }
    }
    return draft;
  });
  const [assignmentSaving, setAssignmentSaving] = useState<Record<string, boolean>>({});
  const [searchState, setSearchState] = useState<Record<number, SectionSearchState>>({});
  const [assigning, setAssigning] = useState<Record<number, boolean>>({});

  const allowedDateTimeToggle = useMemo(() => new Set(['pranzo', 'cena']), []);

  const setSectionLoading = useCallback((sectionId: number, loading: boolean) => {
    setSectionSaving((prev) => ({ ...prev, [sectionId]: loading }));
  }, []);

  const setAssignmentLoading = useCallback((sectionId: number, productId: number, loading: boolean) => {
    const key = `${sectionId}:${productId}`;
    setAssignmentSaving((prev) => ({ ...prev, [key]: loading }));
  }, []);

  const getAssignmentDraft = useCallback(
    (sectionId: number, productId: number): AssignmentDraft => {
      const sectionDraft = assignmentDrafts[sectionId];
      if (sectionDraft && sectionDraft[productId]) return sectionDraft[productId];
      const section = sections.find((s) => s.id === sectionId);
      const product = section?.products.find((p) => p.productId === productId);
      return {
        order: product?.order ?? 0,
        featured: product?.featured ?? false,
        showInHome: product?.showInHome ?? false,
      };
    },
    [assignmentDrafts, sections]
  );

  const updateAssignmentDraft = (sectionId: number, productId: number, patch: Partial<AssignmentDraft>) => {
    setAssignmentDrafts((prev) => {
      const sectionDraft = { ...(prev[sectionId] ?? {}) };
      const current = getAssignmentDraft(sectionId, productId);
      sectionDraft[productId] = {
        order: patch.order ?? current.order,
        featured: patch.featured ?? current.featured,
        showInHome: patch.showInHome ?? current.showInHome,
      };
      return { ...prev, [sectionId]: sectionDraft };
    });
  };

  const updateSectionState = (sectionId: number, updater: (s: SectionRow) => SectionRow) => {
    setSections((prev) => prev.map((s) => (s.id === sectionId ? updater(s) : s)));
  };

  const reorderSections = (next: SectionRow[]) =>
    [...next].sort((a, b) => (a.displayOrder !== b.displayOrder ? a.displayOrder - b.displayOrder : a.title.localeCompare(b.title, 'it')));

  const updateSearchState = (sectionId: number, patch: Partial<SectionSearchState>) => {
    setSearchState((prev) => {
      const current: SectionSearchState = prev[sectionId] ?? { term: '', loading: false, results: [], selectedProductId: null };
      return { ...prev, [sectionId]: { ...current, ...patch } };
    });
  };

  const saveSection = async (
    sectionId: number,
    patch: Partial<Pick<SectionRow, 'active' | 'enableDateTime' | 'displayOrder'>>
  ) => {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;

    const payload = {
      key: section.key,
      title: section.title,
      active: patch.active ?? section.active,
      enableDateTime: patch.enableDateTime ?? section.enableDateTime,
      displayOrder: patch.displayOrder ?? section.displayOrder,
    };

    setSectionLoading(sectionId, true);
    try {
      const res = await fetch('/api/admin/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.ok) {
        toast.error('Impossibile aggiornare la sezione');
        return;
      }

      setSections((prev) => {
        const next = prev.map((s) =>
          s.id === sectionId
            ? { ...s, active: payload.active, enableDateTime: payload.enableDateTime, displayOrder: payload.displayOrder }
            : s
        );
        return patch.displayOrder !== undefined ? reorderSections(next) : next;
      });
      if (patch.displayOrder !== undefined) {
        setSectionDraftOrder((prev) => ({ ...prev, [sectionId]: payload.displayOrder }));
      }

      if (patch.active !== undefined) toast.success(payload.active ? 'Sezione attivata' : 'Sezione disattivata');
      else if (patch.enableDateTime !== undefined) toast.success(payload.enableDateTime ? 'Abilitato data/ora' : 'Disabilitato data/ora');
      else if (patch.displayOrder !== undefined) toast.success('Ordine aggiornato');
    } catch (e) {
      console.error('[admin][sections] save error', e);
      toast.error('Errore di rete durante il salvataggio');
    } finally {
      setSectionLoading(sectionId, false);
    }
  };

  const toggleActive = (sectionId: number) => {
    const s = sections.find((x) => x.id === sectionId);
    if (!s) return;
    saveSection(sectionId, { active: !s.active });
  };

  const toggleEnableDateTime = (sectionId: number) => {
    const s = sections.find((x) => x.id === sectionId);
    if (!s) return;
    if (!allowedDateTimeToggle.has(s.key)) return;
    saveSection(sectionId, { enableDateTime: !s.enableDateTime });
  };

  const saveDisplayOrder = (sectionId: number) => {
    const raw = sectionDraftOrder[sectionId];
    const current = sections.find((x) => x.id === sectionId);
    const fallback = current?.displayOrder ?? 0;
    const next = Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : fallback;
    saveSection(sectionId, { displayOrder: next });
  };

  const handleAssignmentSave = async (sectionId: number, productId: number) => {
    const draft = getAssignmentDraft(sectionId, productId);
    const payload = {
      productId,
      order: Math.max(0, Math.round(draft.order)),
      featured: draft.featured,
      showInHome: draft.showInHome,
    };

    setAssignmentLoading(sectionId, productId, true);
    try {
      const res = await fetch(`/api/admin/sections/${sectionId}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.ok) {
        toast.error('Impossibile salvare il prodotto assegnato');
        return;
      }

      updateSectionState(sectionId, (s) => {
        const products = s.products.map((p) =>
          p.productId === productId ? { ...p, order: payload.order, featured: payload.featured, showInHome: payload.showInHome } : p
        );
        const sorted = [...products].sort((a, b) => (a.order !== b.order ? a.order - b.order : a.productName.localeCompare(b.productName, 'it')));
        return { ...s, products: sorted };
      });

      setAssignmentDrafts((prev) => {
        const sec = { ...(prev[sectionId] ?? {}) };
        sec[productId] = payload;
        return { ...prev, [sectionId]: sec };
      });

      toast.success('Prodotto aggiornato');
    } catch (e) {
      console.error('[admin][sections] assignment save error', e);
      toast.error('Errore di rete durante il salvataggio');
    } finally {
      setAssignmentLoading(sectionId, productId, false);
    }
  };

  const removeAssignment = async (sectionId: number, productId: number) => {
    const ok = window.confirm('Rimuovere il prodotto dalla sezione?');
    if (!ok) return;

    setAssignmentLoading(sectionId, productId, true);
    try {
      const res = await fetch(`/api/admin/sections/${sectionId}/products?productId=${productId}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.ok) {
        toast.error('Impossibile rimuovere il prodotto');
        return;
      }

      updateSectionState(sectionId, (s) => ({ ...s, products: s.products.filter((p) => p.productId !== productId) }));

      setAssignmentDrafts((prev) => {
        const sec = { ...(prev[sectionId] ?? {}) };
        delete sec[productId];
        return { ...prev, [sectionId]: sec };
      });

      toast.success('Prodotto rimosso dalla sezione');
    } catch (e) {
      console.error('[admin][sections] assignment remove error', e);
      toast.error('Errore di rete durante la rimozione');
    } finally {
      setAssignmentLoading(sectionId, productId, false);
    }
  };

  const updateSearchStateSafe = (sectionId: number, patch: Partial<SectionSearchState>) => {
    setSearchState((prev) => {
      const current: SectionSearchState = prev[sectionId] ?? { term: '', loading: false, results: [], selectedProductId: null };
      return { ...prev, [sectionId]: { ...current, ...patch } };
    });
  };

  const searchProducts = async (sectionId: number) => {
    const state = searchState[sectionId];
    const term = state?.term?.trim() ?? '';
    if (!term) {
      updateSearchStateSafe(sectionId, { results: [], selectedProductId: null });
      return;
    }

    updateSearchStateSafe(sectionId, { loading: true });
    try {
      const params = new URLSearchParams({ q: term, active: 'true', pageSize: '20' });
      const res = await fetch(`/api/admin/products?${params.toString()}`, { cache: 'no-store' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.ok) {
        toast.error('Ricerca prodotti non riuscita');
        updateSearchStateSafe(sectionId, { loading: false });
        return;
      }

      const section = sections.find((s) => s.id === sectionId);
      const assignedIds = new Set((section?.products ?? []).map((p) => p.productId));
      const results: SectionSearchResult[] = (body.data as any[])
        .filter((p) => !assignedIds.has(p.id))
        .map((p) => ({ id: p.id, name: p.name, priceCents: p.priceCents, slug: p.slug }));

      updateSearchStateSafe(sectionId, {
        loading: false,
        results,
        selectedProductId: results.length > 0 ? results[0].id : null,
      });
    } catch (e) {
      console.error('[admin][sections] product search error', e);
      toast.error('Errore durante la ricerca');
      updateSearchStateSafe(sectionId, { loading: false });
    }
  };

  const assignProduct = async (sectionId: number) => {
    const state = searchState[sectionId];
    const productId = state?.selectedProductId ?? null;
    if (!productId) {
      toast.error('Seleziona un prodotto da assegnare');
      return;
    }

    const section = sections.find((s) => s.id === sectionId);
    const existing = section?.products.find((p) => p.productId === productId);
    if (existing) {
      toast.error('Prodotto già presente nella sezione');
      return;
    }

    const result = state?.results.find((r) => r.id === productId);
    const defaultOrder = section?.products.length ?? 0;

    setAssigning((prev) => ({ ...prev, [sectionId]: true }));
    try {
      const payload = { productId, order: defaultOrder };
      const res = await fetch(`/api/admin/sections/${sectionId}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.ok) {
        toast.error('Impossibile assegnare il prodotto');
        return;
      }

      const assignment = body.data as { order: number; featured: boolean; showInHome: boolean };
      const newProduct: SectionProductRow = {
        productId,
        productName: result?.name ?? `Prodotto #${productId}`,
        slug: result?.slug ?? null,
        priceCents: result?.priceCents ?? 0,
        order: assignment.order,
        featured: assignment.featured,
        showInHome: assignment.showInHome,
      };

      updateSectionState(sectionId, (s) => {
        const next = [...s.products, newProduct].sort((a, b) =>
          a.order !== b.order ? a.order - b.order : a.productName.localeCompare(b.productName, 'it', { sensitivity: 'base' })
        );
        return { ...s, products: next };
      });

      setAssignmentDrafts((prev) => {
        const sec = { ...(prev[sectionId] ?? {}) };
        sec[productId] = { order: newProduct.order, featured: newProduct.featured, showInHome: newProduct.showInHome };
        return { ...prev, [sectionId]: sec };
      });

      updateSearchStateSafe(sectionId, {
        results: (state?.results ?? []).filter((r) => r.id !== productId),
        selectedProductId: null,
      });

      toast.success('Prodotto assegnato alla sezione');
    } catch (e) {
      console.error('[admin][sections] assign product error', e);
      toast.error("Errore durante l'assegnazione");
    } finally {
      setAssigning((prev) => ({ ...prev, [sectionId]: false }));
    }
  };

  const formatPrice = (cents: number) => (cents / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });

  return (
    <div style={{ display: 'grid', gap: '2rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>Sezioni catalogo</h1>
          <p style={{ margin: '0.25rem 0 0', color: '#6b7280' }}>Gestisci visibilità, ordine e assegnazioni prodotti.</p>
        </div>
      </header>

      <div style={{ display: 'grid', gap: '1.5rem' }}>
        {sections.map((section) => {
          const search = searchState[section.id] ?? {
            term: '',
            loading: false,
            results: [],
            selectedProductId: null,
          };
          return (
            <section
              key={section.id}
              style={{
                backgroundColor: '#fff',
                borderRadius: 16,
                border: '1px solid #e5e7eb',
                padding: '1.5rem',
                display: 'grid',
                gap: '1.5rem',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '1rem' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 600 }}>{section.title}</h2>
                  <p style={{ margin: '0.25rem 0 0', color: '#6b7280' }}>
                    Key: <code>{section.key}</code>
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => toggleActive(section.id)}
                    disabled={sectionSaving[section.id]}
                    style={primaryButtonStyle}
                  >
                    {section.active ? 'Disattiva' : 'Attiva'}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleEnableDateTime(section.id)}
                    disabled={sectionSaving[section.id] || !allowedDateTimeToggle.has(section.key)}
                    style={secondaryButtonStyle}
                  >
                    {section.enableDateTime ? 'Disabilita data/ora' : 'Abilita data/ora'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <label style={{ display: 'grid', gap: '0.25rem', fontWeight: 500 }}>
                  <span>Display order</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={sectionDraftOrder[section.id] ?? section.displayOrder}
                    onChange={(e) => {
                      const value = Number.parseInt(e.target.value, 10);
                      setSectionDraftOrder((prev) => ({ ...prev, [section.id]: Number.isNaN(value) ? 0 : value }));
                    }}
                    style={inputStyle}
                  />
                </label>
                <button type="button" onClick={() => saveDisplayOrder(section.id)} disabled={sectionSaving[section.id]} style={secondaryButtonStyle}>
                  Salva ordine
                </button>
              </div>

              <div style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Prodotti assegnati</h3>
                  <p style={{ margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.9rem' }}>Ordina i prodotti e scegli visibilità in home.</p>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                    <thead style={{ backgroundColor: '#f9fafb', textAlign: 'left', fontSize: '0.85rem', color: '#6b7280' }}>
                      <tr>
                        <th style={tableHeaderCell}>Ordine</th>
                        <th style={tableHeaderCell}>Prodotto</th>
                        <th style={tableHeaderCell}>Prezzo</th>
                        <th style={tableHeaderCell}>Featured</th>
                        <th style={tableHeaderCell}>Home</th>
                        <th style={tableHeaderCell}>Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.products.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ padding: '1.5rem', textAlign: 'center', color: '#6b7280' }}>
                            Nessun prodotto assegnato.
                          </td>
                        </tr>
                      ) : (
                        section.products.map((product) => {
                          const draft = getAssignmentDraft(section.id, product.productId);
                          const key = `${section.id}:${product.productId}`;
                          const loading = assignmentSaving[key] ?? false;
                          const isDirty =
                            draft.order !== product.order || draft.featured !== product.featured || draft.showInHome !== product.showInHome;
                          return (
                            <tr key={product.productId} style={{ borderTop: '1px solid #f1f5f9' }}>
                              <td style={tableCell}>
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={draft.order}
                                  onChange={(e) => {
                                    const value = Number.parseInt(e.target.value, 10);
                                    updateAssignmentDraft(section.id, product.productId, { order: Number.isNaN(value) ? 0 : value });
                                  }}
                                  style={{ ...inputStyle, maxWidth: 96 }}
                                />
                              </td>
                              <td style={{ ...tableCell, fontWeight: 600 }}>
                                <div style={{ display: 'grid' }}>
                                  <span>{product.productName}</span>
                                  <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>#{product.productId}</span>
                                </div>
                              </td>
                              <td style={tableCell}>{formatPrice(product.priceCents)}</td>
                              <td style={tableCell}>
                                <label style={checkboxLabel}>
                                  <input
                                    type="checkbox"
                                    checked={draft.featured}
                                    onChange={(e) => updateAssignmentDraft(section.id, product.productId, { featured: e.target.checked })}
                                  />
                                  <span>Sì</span>
                                </label>
                              </td>
                              <td style={tableCell}>
                                <label style={checkboxLabel}>
                                  <input
                                    type="checkbox"
                                    checked={draft.showInHome}
                                    onChange={(e) => updateAssignmentDraft(section.id, product.productId, { showInHome: e.target.checked })}
                                  />
                                  <span>In home</span>
                                </label>
                              </td>
                              <td style={tableCell}>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleAssignmentSave(section.id, product.productId)}
                                    disabled={loading || !isDirty}
                                    style={linkButtonStyle}
                                  >
                                    Salva
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeAssignment(section.id, product.productId)}
                                    disabled={loading}
                                    style={dangerButtonStyle}
                                  >
                                    Rimuovi
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Aggiungi prodotto</h3>
                  <p style={{ margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.9rem' }}>
                    Cerca tra i prodotti attivi e assegna alla sezione.
                  </p>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    searchProducts(section.id).catch((err) => console.error('[admin][sections] submit search error', err));
                  }}
                  style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}
                >
                  <input
                    type="text"
                    value={search.term}
                    onChange={(e) => updateSearchState(section.id, { term: e.target.value })}
                    placeholder="Nome o slug prodotto"
                    style={{ ...inputStyle, minWidth: 220, flex: '1 1 auto' }}
                  />
                  <button type="submit" style={secondaryButtonStyle} disabled={search.loading}>
                    {search.loading ? 'Ricerca…' : 'Cerca'}
                  </button>
                </form>
                {search.results.length > 0 ? (
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <select
                      value={search.selectedProductId ?? ''}
                      onChange={(e) =>
                        updateSearchState(section.id, {
                          selectedProductId: e.target.value ? Number.parseInt(e.target.value, 10) : null,
                        })
                      }
                      style={{ ...inputStyle, minWidth: 260 }}
                    >
                      <option value="">Seleziona un prodotto</option>
                      {search.results.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {formatPrice(p.priceCents)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => assignProduct(section.id)}
                      disabled={assigning[section.id] || !search.selectedProductId}
                      style={primaryButtonStyle}
                    >
                      {assigning[section.id] ? 'Assegnazione…' : 'Assegna'}
                    </button>
                  </div>
                ) : search.term.trim() && !search.loading ? (
                  <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>Nessun prodotto trovato.</p>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/* —— styles —— */
const inputStyle: CSSProperties = {
  borderRadius: 10,
  border: '1px solid #d1d5db',
  padding: '0.6rem 0.75rem',
  fontSize: '0.95rem',
  width: '100%',
  boxSizing: 'border-box',
};

const primaryButtonStyle: CSSProperties = {
  padding: '0.65rem 1.1rem',
  borderRadius: 10,
  border: 'none',
  backgroundColor: '#2563eb',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
};

const secondaryButtonStyle: CSSProperties = {
  padding: '0.65rem 1.1rem',
  borderRadius: 10,
  border: '1px solid #d1d5db',
  backgroundColor: '#fff',
  color: '#1f2937',
  fontWeight: 500,
  cursor: 'pointer',
};

const tableHeaderCell: CSSProperties = { padding: '0.75rem', fontWeight: 600 };

const tableCell: CSSProperties = { padding: '0.75rem', verticalAlign: 'middle', fontSize: '0.95rem' };

const checkboxLabel: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.5rem' };

const linkButtonStyle: CSSProperties = {
  border: 'none',
  background: 'none',
  color: '#2563eb',
  padding: 0,
  cursor: 'pointer',
  fontWeight: 600,
};

const dangerButtonStyle: CSSProperties = { ...linkButtonStyle, color: '#b91c1c' };
