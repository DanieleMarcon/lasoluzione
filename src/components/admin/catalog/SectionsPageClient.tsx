"use client";

import type { CSSProperties } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { useToast } from '@/components/admin/ui/toast';

type SectionProductRow = {
  productId: number;
  productName: string;
  slug: string | null;
  priceCents: number;
  order: number;
  featured: boolean;
  showInHome: boolean;
};

type SectionEventRow = {
  eventId: string;
  title: string;
  slug: string;
  startAt: string;
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
  events: SectionEventRow[];
};

type SectionSearchResult = {
  id: number | string;
  name: string;
  priceCents: number;
  slug: string;
  startAt?: string;
};

type SectionSearchState = {
  term: string;
  loading: boolean;
  results: SectionSearchResult[];
  selectedItemId: number | string | null;
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
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<number, Record<string, AssignmentDraft>>>(() => {
    const draft: Record<number, Record<string, AssignmentDraft>> = {};
    for (const s of initialSections) {
      draft[s.id] = {};
      for (const p of s.products) {
        draft[s.id][String(p.productId)] = {
          order: p.order,
          featured: p.featured,
          showInHome: p.showInHome,
        };
      }
      for (const event of s.events ?? []) {
        draft[s.id][event.eventId] = {
          order: event.order,
          featured: event.featured,
          showInHome: event.showInHome,
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

  const setAssignmentLoading = useCallback((sectionId: number, itemId: number | string, loading: boolean) => {
    const key = `${sectionId}:${itemId}`;
    setAssignmentSaving((prev) => ({ ...prev, [key]: loading }));
  }, []);

  const getAssignmentDraft = useCallback(
    (sectionId: number, itemId: number | string): AssignmentDraft => {
      const key = String(itemId);
      const sectionDraft = assignmentDrafts[sectionId];
      if (sectionDraft && sectionDraft[key]) return sectionDraft[key];
      const section = sections.find((s) => s.id === sectionId);
      const product = section?.products.find((p) => String(p.productId) === key);
      const event = section?.events.find((e) => e.eventId === key);
      return {
        order: product?.order ?? event?.order ?? 0,
        featured: product?.featured ?? event?.featured ?? false,
        showInHome: product?.showInHome ?? event?.showInHome ?? false,
      };
    },
    [assignmentDrafts, sections]
  );

  const updateAssignmentDraft = (sectionId: number, itemId: number | string, patch: Partial<AssignmentDraft>) => {
    setAssignmentDrafts((prev) => {
      const sectionDraft = { ...(prev[sectionId] ?? {}) };
      const key = String(itemId);
      const current = getAssignmentDraft(sectionId, key);
      sectionDraft[key] = {
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
      const current: SectionSearchState = prev[sectionId] ?? { term: '', loading: false, results: [], selectedItemId: null };
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

  const handleProductAssignmentSave = async (sectionId: number, productId: number) => {
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
        sec[String(productId)] = payload;
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

  const removeProductAssignment = async (sectionId: number, productId: number) => {
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
        delete sec[String(productId)];
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
      const current: SectionSearchState = prev[sectionId] ?? { term: '', loading: false, results: [], selectedItemId: null };
      return { ...prev, [sectionId]: { ...current, ...patch } };
    });
  };

  const searchItems = async (sectionId: number) => {
    const section = sections.find((s) => s.id === sectionId);
    const state = searchState[sectionId];
    const term = state?.term?.trim() ?? '';
    if (!term) {
      updateSearchStateSafe(sectionId, { results: [], selectedItemId: null });
      return;
    }

    updateSearchStateSafe(sectionId, { loading: true });
    try {
      if (section?.key === 'eventi') {
        const params = new URLSearchParams({ q: term, take: '20' });
        const res = await fetch(`/api/admin/events/search?${params.toString()}`, { cache: 'no-store' });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body?.items) {
          toast.error('Ricerca eventi non riuscita');
          updateSearchStateSafe(sectionId, { loading: false });
          return;
        }

        const assignedIds = new Set((section?.events ?? []).map((e) => e.eventId));
        const results: SectionSearchResult[] = (body.items as any[])
          .filter((item) => item?.id && !assignedIds.has(item.id))
          .map((item) => ({
            id: String(item.id),
            name: item.title as string,
            priceCents: Number(item.priceCents) || 0,
            slug: item.slug as string,
            startAt: item.startAt as string,
          }));

        updateSearchStateSafe(sectionId, {
          loading: false,
          results,
          selectedItemId: results.length > 0 ? results[0].id : null,
        });
      } else {
        const params = new URLSearchParams({ q: term, active: 'true', pageSize: '20' });
        const res = await fetch(`/api/admin/products?${params.toString()}`, { cache: 'no-store' });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body?.ok) {
          toast.error('Ricerca prodotti non riuscita');
          updateSearchStateSafe(sectionId, { loading: false });
          return;
        }

        const assignedIds = new Set((section?.products ?? []).map((p) => p.productId));
        const results: SectionSearchResult[] = (body.data as any[])
          .filter((p) => !assignedIds.has(p.id))
          .map((p) => ({ id: p.id as number, name: p.name as string, priceCents: p.priceCents as number, slug: p.slug as string }));

        updateSearchStateSafe(sectionId, {
          loading: false,
          results,
          selectedItemId: results.length > 0 ? results[0].id : null,
        });
      }
    } catch (e) {
      console.error('[admin][sections] product search error', e);
      toast.error('Errore durante la ricerca');
      updateSearchStateSafe(sectionId, { loading: false });
    }
  };

  const assignProduct = async (sectionId: number) => {
    const state = searchState[sectionId];
    const productId = typeof state?.selectedItemId === 'number' ? state.selectedItemId : null;
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
        sec[String(productId)] = { order: newProduct.order, featured: newProduct.featured, showInHome: newProduct.showInHome };
        return { ...prev, [sectionId]: sec };
      });

      updateSearchStateSafe(sectionId, {
        results: (state?.results ?? []).filter((r) => r.id !== productId),
        selectedItemId: null,
      });

      toast.success('Prodotto assegnato alla sezione');
    } catch (e) {
      console.error('[admin][sections] assign product error', e);
      toast.error("Errore durante l'assegnazione");
    } finally {
      setAssigning((prev) => ({ ...prev, [sectionId]: false }));
    }
  };

  const assignEvent = async (sectionId: number) => {
    const state = searchState[sectionId];
    const eventId = state?.selectedItemId ? String(state.selectedItemId) : null;
    if (!eventId) {
      toast.error('Seleziona un evento da assegnare');
      return;
    }

    const section = sections.find((s) => s.id === sectionId);
    const existing = section?.events.find((e) => e.eventId === eventId);
    if (existing) {
      toast.error('Evento già presente nella sezione');
      return;
    }

    const result = state?.results.find((r) => String(r.id) === eventId);
    const defaultOrder = section?.events.length ?? 0;

    setAssigning((prev) => ({ ...prev, [sectionId]: true }));
    try {
      const payload = { eventItemId: eventId, displayOrder: defaultOrder };
      const res = await fetch(`/api/admin/sections/${sectionId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.ok) {
        toast.error("Impossibile assegnare l'evento");
        return;
      }

      const row = body.row as {
        displayOrder: number;
        featured: boolean;
        showInHome: boolean;
        eventItem: { id: string; title: string; slug: string; priceCents: number; startAt: string };
      };

      const newEvent: SectionEventRow = {
        eventId: row.eventItem.id,
        title: row.eventItem.title,
        slug: row.eventItem.slug,
        startAt: row.eventItem.startAt,
        priceCents: row.eventItem.priceCents,
        order: row.displayOrder,
        featured: row.featured,
        showInHome: row.showInHome,
      };

      updateSectionState(sectionId, (s) => {
        const next = [...(s.events ?? []), newEvent].sort((a, b) =>
          a.order !== b.order ? a.order - b.order : a.title.localeCompare(b.title, 'it', { sensitivity: 'base' })
        );
        return { ...s, events: next };
      });

      setAssignmentDrafts((prev) => {
        const sec = { ...(prev[sectionId] ?? {}) };
        sec[newEvent.eventId] = { order: newEvent.order, featured: newEvent.featured, showInHome: newEvent.showInHome };
        return { ...prev, [sectionId]: sec };
      });

      updateSearchStateSafe(sectionId, {
        results: (state?.results ?? []).filter((r) => String(r.id) !== eventId),
        selectedItemId: null,
      });

      toast.success('Evento assegnato alla sezione');
    } catch (e) {
      console.error('[admin][sections] assign event error', e);
      toast.error("Errore durante l'assegnazione");
    } finally {
      setAssigning((prev) => ({ ...prev, [sectionId]: false }));
    }
  };

  const handleEventAssignmentSave = async (sectionId: number, eventId: string) => {
    const draft = getAssignmentDraft(sectionId, eventId);
    const payload = {
      eventItemId: eventId,
      displayOrder: Math.max(0, Math.round(draft.order)),
      featured: draft.featured,
      showInHome: draft.showInHome,
    };

    setAssignmentLoading(sectionId, eventId, true);
    try {
      const res = await fetch(`/api/admin/sections/${sectionId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.ok) {
        toast.error("Impossibile salvare l'evento assegnato");
        return;
      }

      updateSectionState(sectionId, (s) => {
        const events = (s.events ?? []).map((event) =>
          event.eventId === eventId
            ? { ...event, order: payload.displayOrder, featured: payload.featured, showInHome: payload.showInHome }
            : event
        );
        const sorted = [...events].sort((a, b) =>
          a.order !== b.order ? a.order - b.order : a.title.localeCompare(b.title, 'it', { sensitivity: 'base' })
        );
        return { ...s, events: sorted };
      });

      setAssignmentDrafts((prev) => {
        const sec = { ...(prev[sectionId] ?? {}) };
        sec[eventId] = {
          order: payload.displayOrder,
          featured: payload.featured,
          showInHome: payload.showInHome,
        };
        return { ...prev, [sectionId]: sec };
      });

      toast.success('Evento aggiornato');
    } catch (e) {
      console.error('[admin][sections] event assignment save error', e);
      toast.error('Errore di rete durante il salvataggio');
    } finally {
      setAssignmentLoading(sectionId, eventId, false);
    }
  };

  const removeEventAssignment = async (sectionId: number, eventId: string) => {
    const ok = window.confirm('Rimuovere l\'evento dalla sezione?');
    if (!ok) return;

    setAssignmentLoading(sectionId, eventId, true);
    try {
      const params = new URLSearchParams({ eventItemId: eventId });
      const res = await fetch(`/api/admin/sections/${sectionId}/events?${params.toString()}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.ok) {
        toast.error("Impossibile rimuovere l'evento");
        return;
      }

      updateSectionState(sectionId, (s) => ({
        ...s,
        events: (s.events ?? []).filter((event) => event.eventId !== eventId),
      }));

      setAssignmentDrafts((prev) => {
        const sec = { ...(prev[sectionId] ?? {}) };
        delete sec[eventId];
        return { ...prev, [sectionId]: sec };
      });

      toast.success('Evento rimosso dalla sezione');
    } catch (e) {
      console.error('[admin][sections] event assignment remove error', e);
      toast.error('Errore di rete durante la rimozione');
    } finally {
      setAssignmentLoading(sectionId, eventId, false);
    }
  };

  const formatPrice = (cents: number) => (cents / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
  const formatDate = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
  };

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
            selectedItemId: null,
          };
          const isEventSection = section.key === 'eventi';
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
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                    {isEventSection ? 'Eventi assegnati' : 'Prodotti assegnati'}
                  </h3>
                  <p style={{ margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.9rem' }}>
                    {isEventSection
                      ? 'Ordina gli eventi e scegli visibilità in home.'
                      : 'Ordina i prodotti e scegli visibilità in home.'}
                  </p>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                    <thead style={{ backgroundColor: '#f9fafb', textAlign: 'left', fontSize: '0.85rem', color: '#6b7280' }}>
                      <tr>
                        <th style={tableHeaderCell}>Ordine</th>
                        <th style={tableHeaderCell}>{isEventSection ? 'Evento' : 'Prodotto'}</th>
                        {isEventSection ? <th style={tableHeaderCell}>Data</th> : null}
                        <th style={tableHeaderCell}>Prezzo</th>
                        <th style={tableHeaderCell}>Featured</th>
                        <th style={tableHeaderCell}>Home</th>
                        <th style={tableHeaderCell}>Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(isEventSection ? section.events.length === 0 : section.products.length === 0) ? (
                        <tr>
                          <td colSpan={isEventSection ? 7 : 6} style={{ padding: '1.5rem', textAlign: 'center', color: '#6b7280' }}>
                            {isEventSection ? 'Nessun evento assegnato.' : 'Nessun prodotto assegnato.'}
                          </td>
                        </tr>
                      ) : (
                        (isEventSection
                          ? section.events.map((event) => {
                              const draft = getAssignmentDraft(section.id, event.eventId);
                              const key = `${section.id}:${event.eventId}`;
                              const loading = assignmentSaving[key] ?? false;
                              const isDirty =
                                draft.order !== event.order || draft.featured !== event.featured || draft.showInHome !== event.showInHome;
                              return (
                                <tr key={event.eventId} style={{ borderTop: '1px solid #f1f5f9' }}>
                                  <td style={tableCell}>
                                    <input
                                      type="number"
                                      min={0}
                                      step={1}
                                      value={draft.order}
                                      onChange={(e) => {
                                        const value = Number.parseInt(e.target.value, 10);
                                        updateAssignmentDraft(section.id, event.eventId, { order: Number.isNaN(value) ? 0 : value });
                                      }}
                                      style={{ ...inputStyle, maxWidth: 96 }}
                                    />
                                  </td>
                                  <td style={{ ...tableCell, fontWeight: 600 }}>
                                    <div style={{ display: 'grid' }}>
                                      <span>{event.title}</span>
                                      <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>{event.slug}</span>
                                    </div>
                                  </td>
                                  <td style={tableCell}>{formatDate(event.startAt)}</td>
                                  <td style={tableCell}>{formatPrice(event.priceCents)}</td>
                                  <td style={tableCell}>
                                    <label style={checkboxLabel}>
                                      <input
                                        type="checkbox"
                                        checked={draft.featured}
                                        onChange={(e) => updateAssignmentDraft(section.id, event.eventId, { featured: e.target.checked })}
                                      />
                                      <span>Sì</span>
                                    </label>
                                  </td>
                                  <td style={tableCell}>
                                    <label style={checkboxLabel}>
                                      <input
                                        type="checkbox"
                                        checked={draft.showInHome}
                                        onChange={(e) => updateAssignmentDraft(section.id, event.eventId, { showInHome: e.target.checked })}
                                      />
                                      <span>In home</span>
                                    </label>
                                  </td>
                                  <td style={tableCell}>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                      <button
                                        type="button"
                                        onClick={() => handleEventAssignmentSave(section.id, event.eventId)}
                                        disabled={loading || !isDirty}
                                        style={linkButtonStyle}
                                      >
                                        Salva
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => removeEventAssignment(section.id, event.eventId)}
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
                          : section.products.map((product) => {
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
                                        onClick={() => handleProductAssignmentSave(section.id, product.productId)}
                                        disabled={loading || !isDirty}
                                        style={linkButtonStyle}
                                      >
                                        Salva
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => removeProductAssignment(section.id, product.productId)}
                                        disabled={loading}
                                        style={dangerButtonStyle}
                                      >
                                        Rimuovi
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            }))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                    {isEventSection ? 'Aggiungi evento' : 'Aggiungi prodotto'}
                  </h3>
                  <p style={{ margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.9rem' }}>
                    {isEventSection
                      ? 'Cerca tra gli eventi attivi e assegna alla sezione.'
                      : 'Cerca tra i prodotti attivi e assegna alla sezione.'}
                  </p>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    searchItems(section.id).catch((err) => console.error('[admin][sections] submit search error', err));
                  }}
                  style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}
                >
                  <input
                    type="text"
                    value={search.term}
                    onChange={(e) => updateSearchState(section.id, { term: e.target.value })}
                    placeholder={isEventSection ? 'Titolo o slug evento' : 'Nome o slug prodotto'}
                    style={{ ...inputStyle, minWidth: 220, flex: '1 1 auto' }}
                  />
                  <button type="submit" style={secondaryButtonStyle} disabled={search.loading}>
                    {search.loading ? 'Ricerca…' : 'Cerca'}
                  </button>
                </form>
                {search.results.length > 0 ? (
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <select
                      value={search.selectedItemId != null ? String(search.selectedItemId) : ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (!value) {
                          updateSearchState(section.id, { selectedItemId: null });
                          return;
                        }
                        updateSearchState(section.id, {
                          selectedItemId: isEventSection ? value : Number.parseInt(value, 10),
                        });
                      }}
                      style={{ ...inputStyle, minWidth: 260 }}
                    >
                      <option value="">{isEventSection ? 'Seleziona un evento' : 'Seleziona un prodotto'}</option>
                      {search.results.map((p) => (
                        <option key={String(p.id)} value={String(p.id)}>
                          {isEventSection && p.startAt
                            ? `${p.name} — ${formatDate(p.startAt)}`
                            : `${p.name} — ${formatPrice(p.priceCents)}`}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => (isEventSection ? assignEvent(section.id) : assignProduct(section.id))}
                      disabled={assigning[section.id] || !search.selectedItemId}
                      style={primaryButtonStyle}
                    >
                      {assigning[section.id] ? 'Assegnazione…' : 'Assegna'}
                    </button>
                  </div>
                ) : search.term.trim() && !search.loading ? (
                  <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>
                    {isEventSection ? 'Nessun evento trovato.' : 'Nessun prodotto trovato.'}
                  </p>
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
