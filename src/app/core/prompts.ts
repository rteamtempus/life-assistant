// Warm rotating one-line prompts (handoff §1.2: no blank boxes — a blinking
// cursor is a trigger). Every capture surface opens with one of these.
// Voice: warm, calm coach. Never a scold, never a form label.

import { DayPart } from './time-of-day';

const PROMPTS: Record<DayPart, string[]> = {
  morning: [
    "what's the first thing on your mind?",
    'how did you land in today?',
    'just say whatever is here right now.',
    "no need to sort it — what's going on?",
  ],
  day: [
    "what's moving through you right now?",
    'say it out loud — even half-formed is fine.',
    "what's taking up space at the moment?",
  ],
  crash: [
    'rough patch? just say where you are.',
    "you don't have to fix anything — what's here?",
    'what does this afternoon feel like?',
  ],
  night: [
    'what did today actually hold?',
    "name a couple of things you did — i'll catch the rest.",
    'how are you arriving at the end of the day?',
    "what's worth setting down before sleep?",
  ],
};

/**
 * Pick a prompt for the context. `seed` (e.g. minutes since midnight) keeps
 * the choice stable across re-renders instead of flickering each tick.
 */
export function rotatingPrompt(part: DayPart, seed: number): string {
  const list = PROMPTS[part];
  return list[Math.abs(Math.floor(seed)) % list.length];
}
