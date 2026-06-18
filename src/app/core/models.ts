// TypeScript mirrors of the v2 Postgres schema (supabase/migrations/0007).
// Core loop: Dump -> Extract -> Analyze.

export type DumpKind =
  | 'checkin'
  | 'journal_morning'
  | 'journal_evening'
  | 'urge'
  | 'adhoc';

export type DumpStatus =
  | 'pending'
  | 'transcribing'
  | 'transcribed'
  | 'extracting'
  | 'done'
  | 'error';

export interface Dump {
  id: string;
  created_at: string;
  occurred_at: string;
  kind: DumpKind;
  audio_path: string | null;
  transcript: string | null;
  summary: string | null;
  status: DumpStatus;
  error: string | null;
}

export type EventSource = 'ai' | 'manual';

/** The generic timestamped tracker row. Named LogEvent to avoid the DOM Event. */
export interface LogEvent {
  id: string;
  created_at: string;
  occurred_at: string;
  category: string;
  label: string | null;
  amount: number | null;
  unit: string | null;
  valence: number | null;
  note: string | null;
  details: Record<string, unknown>;
  source: EventSource;
  source_dump_id: string | null;
  confidence: number | null;
  confirmed: boolean;
}

/** A candidate event from extraction, shown as a confirm-chip before saving. */
export interface EventDraft {
  category: string;
  label: string | null;
  amount: number | null;
  unit: string | null;
  valence: number | null;
  occurred_at: string | null;
  note: string | null;
  confidence: number;
  source: EventSource;
  include: boolean;
}

export interface Urge {
  id: string;
  created_at: string;
  occurred_at: string;
  initial_dump_id: string | null;
  followup_dump_id: string | null;
  intensity: number | null;
  acted_on: boolean | null;
  trigger: string | null;
  kind: string | null;
  what_helped: string | null;
  resolved: boolean;
}

/** A candidate urge detected in a dump, shown as a confirm-chip before saving. */
export interface UrgeDraft {
  kind: string | null;
  occurred_at: string | null;
  acted_on: boolean | null;
  trigger: string | null;
  what_helped: string | null;
  intensity: number | null;
  include: boolean;
}

export interface AnalysisItem {
  item: string;
  why?: string;
  evidence?: string;
}

export interface Recommendation {
  text: string;
  rationale?: string;
}

export interface ExperimentProgress {
  experiment: string;
  adherence?: string;
  effect?: string;
}

export interface Analysis {
  id: string;
  created_at: string;
  period_start: string;
  period_end: string;
  trigger: 'morning' | 'weekly' | 'manual';
  model: string | null;
  summary: string | null;
  helped: AnalysisItem[];
  hurt: AnalysisItem[];
  patterns: string[];
  recommendations: Recommendation[];
  experiment_progress: ExperimentProgress[];
}

export interface Experiment {
  id: string;
  created_at: string;
  text: string;
  rationale: string | null;
  source_analysis_id: string | null;
  status: 'active' | 'paused' | 'done' | 'dropped';
  started_on: string | null;
  ended_on: string | null;
}

/** UI metadata for event categories (icons used in chips + review). */
export const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  food: { label: 'food', icon: '🍽️' },
  water: { label: 'water', icon: '💧' },
  medication: { label: 'medication', icon: '💊' },
  tool: { label: 'tool', icon: '🌿' },
  sleep: { label: 'sleep', icon: '🌙' },
  tiredness: { label: 'tiredness', icon: '😴' },
  mood: { label: 'mood', icon: '🌤️' },
  activity: { label: 'activity', icon: '🏃' },
  social: { label: 'social', icon: '💬' },
  symptom: { label: 'symptom', icon: '🩹' },
  substance: { label: 'substance', icon: '🚭' },
};

export function categoryMeta(category: string): { label: string; icon: string } {
  return CATEGORY_META[category] ?? { label: category, icon: '•' };
}
