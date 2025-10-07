export const metadata = { title: 'Informativa Privacy' };

export default function PrivacyPage() {
  return (
    <main className="prose prose-neutral max-w-none">
      <h1>Informativa Privacy (base)</h1>
      <blockquote>
        <strong>Placeholder</strong>. Personalizza secondo la tua realtà (Titolare, Finalità, Basi giuridiche, Conservazione, Diritti).
      </blockquote>
      <ul>
        <li>Titolare: ____</li>
        <li>Contatti DPO (se presente): ____</li>
        <li>Finalità: servizio, newsletter (double opt-in), analytics (se abilitati)</li>
        <li>Basi giuridiche: contratto/consenso/interesse legittimo (valuta)</li>
        <li>Conservazione: ____</li>
        <li>Diritti: accesso, rettifica, cancellazione, portabilità, opposizione, reclamo Garante</li>
      </ul>
    </main>
  );
}
