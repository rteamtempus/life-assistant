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

/**
 * Current time as an ISO-8601 string WITH the local UTC offset
 * (e.g. "2026-06-17T21:00:00-04:00") rather than UTC "Z". Passed to the
 * extractor so it resolves spoken times ("9am") against the user's local day,
 * not the UTC day — otherwise late-evening dumps land on tomorrow.
 */
export function localIsoNow(d = new Date()): string {
  const tz = -d.getTimezoneOffset(); // minutes east of UTC
  const sign = tz >= 0 ? '+' : '-';
  const abs = Math.abs(tz);
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return `${date}T${time}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** Coerce a value to a finite number or null (number inputs can yield strings). */
export function toNumberOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
