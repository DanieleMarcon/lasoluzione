import Link from 'next/link';

type OrderStatus = 'paid' | 'failed' | 'pending';

type StatusResponse = { status: OrderStatus };

async function fetchStatus(orderId: string, ref?: string): Promise<StatusResponse> {
  const params = new URLSearchParams({ orderId });
  if (ref) params.set('ref', ref);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
  const res = await fetch(`${baseUrl}/api/payments/order-status?${params.toString()}`, {
    cache: 'no-store',
  });

  const body = (await res.json().catch(() => null)) as { ok: boolean; data?: StatusResponse; error?: string } | null;

  if (!res.ok || !body?.ok || !body.data) {
    throw new Error(body?.error || 'Status error');
  }

  return body.data;
}

export default async function ReturnPage({ searchParams }: { searchParams: { orderId?: string; ref?: string } }) {
  const orderId = searchParams?.orderId?.trim();
  const ref = searchParams?.ref?.trim();

  if (!orderId) {
    return (
      <main className="container py-5">
        <h1 className="mb-3">Esito pagamento</h1>
        <p className="text-danger">Ordine non valido. Torna al carrello e riprova.</p>
        <div className="mt-4">
          <Link href="/prenota" className="btn btn-primary">
            Torna alle prenotazioni
          </Link>
        </div>
      </main>
    );
  }

  let status: OrderStatus | 'error' = 'pending';

  try {
    const response = await fetchStatus(orderId, ref);
    status = response.status;
  } catch (error) {
    console.error('[checkout][return] status error', error);
    status = 'error';
  }

  return (
    <main className="container py-5">
      <h1 className="mb-3">Esito pagamento</h1>
      {status === 'paid' && (
        <p className="text-success">
          Pagamento confermato! Ti abbiamo inviato una conferma via email. Ordine #{orderId}.
        </p>
      )}
      {status === 'failed' && <p className="text-danger">Pagamento non riuscito o annullato.</p>}
      {status === 'pending' && (
        <p className="text-muted">
          Pagamento in elaborazione… ricarica tra qualche secondo oppure controlla l’email per aggiornamenti.
        </p>
      )}
      {status === 'error' && (
        <p className="text-danger">Impossibile verificare lo stato del pagamento. Riprova più tardi.</p>
      )}

      <div className="mt-4">
        <Link href="/prenota" className="btn btn-primary">
          Torna alle prenotazioni
        </Link>
      </div>
    </main>
  );
}
