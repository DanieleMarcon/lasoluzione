# API Eventi pubblica

## `GET /api/events`
- **Metodo**: `GET`
- **Auth**: nessuna (public endpoint)
- **Cache**: `force-dynamic`
- **Query opzionali**:
  - `limit` — numero massimo di eventi da restituire (default `6`, massimo `50`).
  - `from` — data ISO `YYYY-MM-DD` di riferimento; di default oggi (00:00 locale).
  - `includePast` — se `true` include anche eventi con `startAt` antecedente a `from` (default `false`).
- **Selezione**: solo eventi `active = true` e `showOnHome = true`.
- **Ordinamento**: `startAt` crescente.
- **Risposta**: array JSON di oggetti `{ id, slug, title, description, startAt, endAt, showOnHome, excerpt }`.
  - `excerpt` è calcolato lato server troncando `description` a 240 caratteri (aggiunge `…` se necessario).

### Esempi

```bash
# Eventi futuri (default)
curl -s "http://localhost:3000/api/events" | jq

# Eventi da una data specifica
curl -s "http://localhost:3000/api/events?from=2025-01-01&limit=3" | jq '.[].startAt'

# Includere eventi già passati
curl -s "http://localhost:3000/api/events?includePast=true" | jq length
```
