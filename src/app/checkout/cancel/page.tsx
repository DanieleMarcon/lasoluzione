import Link from 'next/link';

export default function CancelPage() {
  return (
    <main className="container py-5">
      <h1 className="mb-3">Pagamento annullato</h1>
      <p className="text-muted">Hai annullato il pagamento. Puoi riprovare quando vuoi.</p>
      <div className="mt-4">
        <Link href="/prenota" className="btn btn-secondary">
          Torna al carrello
        </Link>
      </div>
    </main>
  );
}
