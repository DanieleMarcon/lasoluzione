function parseDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function capitalize(value: string): string {
  if (!value.length) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const DATE_FORMATTER = new Intl.DateTimeFormat('it-IT', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const DATE_FORMATTER_SHORT = new Intl.DateTimeFormat('it-IT', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const TIME_FORMATTER = new Intl.DateTimeFormat('it-IT', {
  hour: '2-digit',
  minute: '2-digit',
});

export function formatEventSchedule(start: Date | string, end?: Date | string): string {
  const startDate = parseDate(start);
  if (!startDate) {
    return '';
  }

  const startTimeLabel = TIME_FORMATTER.format(startDate);

  const startDateLabel = capitalize(DATE_FORMATTER.format(startDate));
  const endDate = parseDate(end);
  if (!endDate) {
    return `${startDateLabel}, ${startTimeLabel}`;
  }

  const endTimeLabel = TIME_FORMATTER.format(endDate);
  const sameDay =
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getDate() === endDate.getDate();

  if (sameDay) {
    return `${startDateLabel}, ${startTimeLabel}–${endTimeLabel}`;
  }

  const startDateShortLabel = capitalize(DATE_FORMATTER_SHORT.format(startDate));
  const endDateShortLabel = capitalize(DATE_FORMATTER_SHORT.format(endDate));

  return `${startDateShortLabel}, ${startTimeLabel} → ${endDateShortLabel}, ${endTimeLabel}`;
}

export function formatEventDateRange(
  startAt: Date | string | null | undefined,
  endAt?: Date | string | null,
): string {
  const start = parseDate(startAt);
  if (!start) return '';

  const startDate = capitalize(DATE_FORMATTER.format(start));
  const startTime = TIME_FORMATTER.format(start);

  if (!endAt) {
    return `${startDate} alle ${startTime}`;
  }

  const end = parseDate(endAt);
  if (!end) {
    return `${startDate} alle ${startTime}`;
  }

  const endDate = capitalize(DATE_FORMATTER.format(end));
  const endTime = TIME_FORMATTER.format(end);
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  if (sameDay) {
    return `${startDate} dalle ${startTime} alle ${endTime}`;
  }

  return `${startDate} alle ${startTime} - ${endDate} alle ${endTime}`;
}
