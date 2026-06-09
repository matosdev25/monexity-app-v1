const DATE_TIME_TIME_FORMATTER = new Intl.DateTimeFormat("es-PA", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const TIME_FORMATTER = new Intl.DateTimeFormat("es-PA", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "America/Panama",
});

const LONG_DATE_FORMATTER = new Intl.DateTimeFormat("es-PA", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function parseDisplayDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  return new Date(value);
}

function formatDateParts(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

export function formatShortDate(
  value: string | Date | null | undefined,
  fallback = "—"
) {
  if (!value) return fallback;
  const date = value instanceof Date ? value : parseDisplayDate(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return formatDateParts(date);
}

export function formatDateTime(
  value: string | Date | null | undefined,
  fallback = "—"
) {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return `${formatDateParts(date)}, ${DATE_TIME_TIME_FORMATTER.format(date)}`;
}

export function formatTime(
  value: string | Date | null | undefined,
  fallback = "—"
) {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return TIME_FORMATTER.format(date);
}

export function formatLongDate(
  value: string | Date | null | undefined,
  fallback = "—"
) {
  if (!value) return fallback;
  const date = value instanceof Date ? value : parseDisplayDate(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return LONG_DATE_FORMATTER.format(date);
}
