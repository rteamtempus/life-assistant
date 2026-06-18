// Small datetime helpers for binding ISO timestamps to <input type="datetime-local">
// and for defending the DB against malformed timestamps from the model.

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** ISO -> "YYYY-MM-DDTHH:mm" in local time (for datetime-local inputs). */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A local datetime-local value back to an ISO string (or null if blank/invalid). */
export function localInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Coerce a possibly-messy timestamp (e.g. the model returning "21:00" or
 * "morning") into a valid ISO string, falling back when it isn't a real
 * date-time. This is the guard that keeps a bad value from failing the whole
 * events insert.
 */
export function safeTimestamp(
  value: string | null | undefined,
  fallbackIso: string,
): string {
  if (!value) return fallbackIso;
  const t = Date.parse(value);
  return isNaN(t) ? fallbackIso : new Date(t).toISOString();
}

/** Coerce a value to a finite number or null (number inputs can yield strings). */
export function toNumberOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
