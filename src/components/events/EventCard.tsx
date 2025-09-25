export default function EventCard({ event }: { event: { id:string; title:string; date:string; time?:string } }) {
  return (
    <article style={{ border:'1px solid var(--color-border)', borderRadius:'12px', padding:'1rem' }}>
      <h3>{event.title}</h3>
      <p><time dateTime={event.date}>{new Date(event.date).toLocaleDateString('it-IT')}</time>{event.time ? ` · ${event.time}` : ''}</p>
      {/* TODO: link dettagli evento / ticketUrl */}
    </article>
  );
}
