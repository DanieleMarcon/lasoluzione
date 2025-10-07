export const metadata = { title: 'Cookie Policy' };

export default function CookiePolicyPage() {
  return (
    <main className="prose prose-neutral max-w-none">
      <h1>Cookie Policy (base)</h1>
      <blockquote>
        <strong>Placeholder</strong>. Descrivi categorie: essenziali, funzionali, analitici, marketing. Indica strumenti/terze parti e durate cookie.
      </blockquote>
      <ul>
        <li>Versione policy: {process.env.NEXT_PUBLIC_POLICY_VERSION}</li>
        <li>Revoca/modifica consenso: vedi pulsante &quot;Gestisci cookie&quot; nel footer</li>
      </ul>
    </main>
  );
}
