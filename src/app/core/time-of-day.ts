// Time-aware home screen logic (handoff §9). The home screen shows ONE
// segment at a time — morning menu in the morning, regulation tools in the
// known crash hours, wind-down at night — and hides the rest (§1: anti-
// optimization ceiling, no dashboard).

export type DayPart = 'morning' | 'day' | 'crash' | 'night';

export interface DayContext {
  part: DayPart;
  /** Warm, lower-case greeting fragment used in the header. */
  greeting: string;
}

/**
 * Map an hour to a day-part. Crash window is mid-afternoon by default — the
 * owner can recalibrate these bounds later from their own check-in data.
 */
export function dayPartForHour(hour: number): DayPart {
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 14 && hour < 17) return 'crash';
  if (hour >= 21 || hour < 5) return 'night';
  return 'day';
}

export function dayContext(now: Date = new Date()): DayContext {
  const part = dayPartForHour(now.getHours());
  const greeting = {
    morning: 'good morning',
    day: 'hey',
    crash: 'afternoon',
    night: 'winding down',
  }[part];
  return { part, greeting };
}
