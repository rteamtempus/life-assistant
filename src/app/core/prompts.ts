// Warm rotating one-line prompts (no blank boxes — a blinking cursor is a
// trigger). Every brain-dump surface opens with one, keyed by dump kind.

import { DumpKind } from './models';

const PROMPTS: Record<DumpKind, string[]> = {
  checkin: [
    "how are you, right now?",
    "what's moving through you at the moment?",
    'a quick pulse — where are you?',
    "say whatever's here. even half-formed is fine.",
  ],
  journal_morning: [
    'how did you land in today?',
    'how was the night? what does this morning feel like?',
    "what's on your mind as the day starts?",
    'meds, sleep, mood — just talk it through.',
  ],
  journal_evening: [
    'what did today actually hold?',
    'walk me through the day — food, water, how you felt.',
    'what helped today? what didn\'t?',
    'how are you arriving at the end of the day?',
  ],
  urge: [
    "you came here instead — that counts. what's going on?",
    "what are you feeling right now, and what happened just before?",
    'just say where you are. no need to fix anything.',
  ],
  adhoc: [
    "what's on your mind?",
    'drop whatever you want to capture.',
    'say it your own way.',
  ],
};

export function promptFor(kind: DumpKind, seed: number): string {
  const list = PROMPTS[kind];
  return list[Math.abs(Math.floor(seed)) % list.length];
}
