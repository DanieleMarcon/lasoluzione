// src/app/prenota/page.tsx
import BookingWizard from '@/components/booking/BookingWizard';

export default function PrenotaPage() {
  return (
    <main
      className="container"
      style={{ padding: '2rem 1rem', maxWidth: 720, margin: '0 auto' }}
    >
      <h1 style={{ color: '#112f4d', textAlign: 'center' }}>
        Prenota un tavolo
      </h1>
      <p style={{ textAlign: 'center', marginBottom: 24 }}>
        Scegli data, orario e numero di persone. Ti risponderemo per confermare.
      </p>

      <BookingWizard />
    </main>
  );
}
