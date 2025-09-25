'use client';
export function SkipLink({ targetId = 'main' }: { targetId?: string }) {
  return (
    <a
      href={`#${targetId}`}
      className="visually-hidden"
      onFocus={(e) => (e.currentTarget.className = '')}
      onBlur={(e) => (e.currentTarget.className = 'visually-hidden')}
    >
      Salta al contenuto
    </a>
  );
}
