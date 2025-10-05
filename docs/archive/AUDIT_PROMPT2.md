Executive summary
- Config, DTO e backend includono i campi cena (visibleAt, dinnerCoverCents, dinner* JSON) e le migrazioni risultano applicate nel DB locale.
- Il wizard filtra correttamente i piatti per pranzo/cena e calcola coperti e totali distinti, ma il percorso cena non commuta sull'endpoint di prepagamento.
- Le API di prenotazione e prepay validano e salvano i riepiloghi cena simmetricamente al pranzo, utilizzando gli helper condivisi.
- Le email al cliente includono il riepilogo cena, ma la notifica admin omette ancora il blocco cena.
- pnpm type-check passa; il server Next non era in esecuzione quindi /api/booking-config non è stato ispezionato live.

Checklist requisiti (✅/❌)
- ✅ API config (visibleAt + dinnerCoverCents) — vedi `src/app/api/booking-config/route.ts:43`.
- ✅ DTO / Types (visibleAt e dinnerCoverCents) — vedi `src/types/bookingConfig.ts:1`.
- ❌ Wizard pubblico (cenni flusso cena) — UI ok ma il submit non instrada le cene con prepay; vedi `src/components/booking/BookingWizard.tsx:224`.
- ✅ Server POST /api/bookings e /api/bookings/prepay — riepiloghi cena gestiti via helper; vedi `src/app/api/bookings/route.ts:77` e `src/app/api/bookings/prepay/route.ts:72`.
- ❌ Email — blocco cena assente nella mail admin; vedi `src/lib/mailer.ts:192`.
- ✅ Admin – Menu (visibleAt CRUD) — vedi `src/components/admin/menu/MenuDishesManager.tsx:210` e API `src/app/api/admin/menu/dishes/route.ts:43`.
- ✅ Admin – Settings (dinnerCoverCents) — vedi `src/components/admin/settings/SettingsForm.tsx:29` e `src/app/api/admin/settings/route.ts:14`.
- ✅ Schema / Migrazioni — colonne presenti in `prisma/schema.prisma:11` e confermate via `sqlite3`.

Dettagli per file (≤10 righe ciascuno)
- `src/app/api/booking-config/route.ts:43`
  ```ts
  const menu = {
    dishes: dishes.map((dish) => ({
      ...,
      visibleAt: (dish as any).visibleAt as 'lunch' | 'dinner' | 'both',
    })),
    coverCents: settings.coverCents,
    dinnerCoverCents: settings.dinnerCoverCents ?? 0,
  };
  ```
- `src/types/bookingConfig.ts:1`
  ```ts
  export type BookingMenuDishDTO = {
    ...
    visibleAt: 'lunch' | 'dinner' | 'both';
  };
  export type BookingMenuDTO = {
    ...
    dinnerCoverCents: number;
  };
  ```
- `src/components/booking/steps/Step2People.tsx:133`
  ```ts
  const filteredDishes = useMemo(() => {
    if (isLunch) return menu.dishes.filter((dish) => dish.visibleAt === 'lunch' || dish.visibleAt === 'both');
    if (isDinner) return menu.dishes.filter((dish) => dish.visibleAt === 'dinner' || dish.visibleAt === 'both');
    return [];
  }, [isLunch, isDinner, menu.dishes]);
  ```
- `src/components/booking/steps/Step4Review.tsx:93`
  ```ts
  if (values.type === 'cena') {
    const items = order
      .map((item) => {
        const dish = dishMap.get(item.dishId);
        if (!(dish.visibleAt === 'dinner' || dish.visibleAt === 'both')) return null;
        return { name: dish.name, qty: item.qty, priceCents: dish.priceCents };
      })
      .filter(Boolean);
  }
  ```
- `src/components/booking/validation.ts:67`
  ```ts
  const isLunch = data.type === 'pranzo';
  const isDinner = data.type === 'cena';
  if (!order.length) {
    ctx.addIssue({ message: 'Seleziona almeno un piatto', path: ['lunchOrder'] });
  }
  ```
- `src/components/booking/BookingWizard.tsx:224`
  ```ts
  const requiresPrepay =
    config.prepayTypes.includes(payloadType) ||
    (payloadType === 'pranzo' && config.menu.lunchRequirePrepay);
  const endpoint = requiresPrepay ? '/api/bookings/prepay' : '/api/bookings';
  ```
- `src/lib/lunchOrder.ts:44`
  ```ts
  return buildMealOrderSummary(order, people, coverCentsInput, ['dinner', 'both'], 'DINNER');
  ```
- `src/app/api/bookings/route.ts:134`
  ```ts
  dinnerItemsJson: dinnerSummary ? dinnerSummary.items : undefined,
  dinnerCoverCents: dinnerSummary ? dinnerSummary.coverCents : null,
  dinnerSubtotalCents: dinnerSummary ? dinnerSummary.subtotalCents : null,
  dinnerTotalCents: dinnerSummary ? dinnerSummary.totalCents : null,
  ```
- `src/app/api/bookings/prepay/route.ts:132`
  ```ts
  dinnerItemsJson: dinnerSummary ? dinnerSummary.items : undefined,
  dinnerCoverCents: dinnerSummary ? dinnerSummary.coverCents : null,
  dinnerSubtotalCents: dinnerSummary ? dinnerSummary.subtotalCents : null,
  dinnerTotalCents: dinnerSummary ? dinnerSummary.totalCents : null,
  ```
- `src/lib/mailer.ts:192`
  ```ts
  const r2 = await transporter.sendMail({
    ...
    text:
`Nuova prenotazione:
...
${tierText}${lunchText}`
  });
  ```
- `src/components/admin/menu/MenuDishesManager.tsx:210`
  ```ts
  <select value={createForm.visibleAt} onChange={...}>
    <option value="both">Pranzo e cena</option>
    <option value="lunch">Solo pranzo</option>
    <option value="dinner">Solo cena</option>
  </select>
  ```
- `src/app/api/admin/menu/dishes/route.ts:43`
  ```ts
  const createSchema = z.object({
    ...
    visibleAt: visibleAtEnum.default('both'),
  });
  ```
- `src/components/admin/settings/SettingsForm.tsx:29`
  ```ts
  const [dinnerCoverCents, setDinnerCoverCents] = useState(String(settings.dinnerCoverCents ?? 0));
  const [dinnerRequirePrepay, setDinnerRequirePrepay] = useState(settings.dinnerRequirePrepay);
  ```
- `src/app/api/admin/settings/route.ts:14`
  ```ts
  const settingsSchema = z.object({
    ...
    dinnerCoverCents: z.coerce.number().int().min(0).max(1_000_000).default(0),
    dinnerRequirePrepay: z.boolean().default(false),
  });
  ```
- `prisma/schema.prisma:11`
  ```prisma
  dinnerItemsJson     Json?
  dinnerSubtotalCents Int?
  dinnerCoverCents    Int?
  dinnerTotalCents    Int?
  ```
- `sqlite3 prisma/prisma/data.db "pragma table_info('MenuDish');"`
  ```
  ...
  10|visibleAt|TEXT|1|'both'|0
  ```
- `sqlite3 prisma/prisma/data.db "pragma table_info('BookingSettings');"`
  ```
  ...
  10|dinnerCoverCents|INTEGER|1|0|0
  11|dinnerRequirePrepay|BOOLEAN|1|false|0
  ```

Eventuali errori di type-check e come riprodurli
- Nessun errore: `pnpm type-check` (usa `pnpm type-check`).

Note comandi
- `curl -s http://localhost:3000/api/booking-config` non ha restituito dati perché il server Next non era attivo (solo messaggio shellenv `Operation not permitted`).

Patch suggerite (non applicate)
```diff
--- a/src/components/booking/BookingWizard.tsx
+++ b/src/components/booking/BookingWizard.tsx
@@
-    const requiresPrepay =
-      config.prepayTypes.includes(payloadType) ||
-      (payloadType === 'pranzo' && config.menu.lunchRequirePrepay);
+    const requiresPrepay =
+      config.prepayTypes.includes(payloadType) ||
+      (payloadType === 'pranzo' && config.menu.lunchRequirePrepay) ||
+      (payloadType === 'cena' && config.menu.dinnerRequirePrepay);
```
```diff
--- a/src/lib/mailer.ts
+++ b/src/lib/mailer.ts
@@
-  const r2 = await transporter.sendMail({
+  const r2 = await transporter.sendMail({
     from,
     to: toAdmin,
     subject: `Nuova prenotazione #${data.id} – ${data.name} (${data.people}p)`,
     text:
 `Nuova prenotazione:
@@
-${data.phone ? `Telefono: ${data.phone}\n` : ''}${data.notes ? `Note: ${data.notes}\n` : ''}${tierText}${lunchText}`
+${data.phone ? `Telefono: ${data.phone}\n` : ''}${data.notes ? `Note: ${data.notes}\n` : ''}${tierText}${lunchText}${dinnerText}`
   });
```
