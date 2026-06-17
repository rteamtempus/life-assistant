// TypeScript mirrors of the Postgres tables (handoff §4).
// Keep these in sync with supabase/migrations.

export type EntryKind = 'morning' | 'night' | 'adhoc';
export type ToolCategory = 'morning' | 'nightly' | 'regulation' | 'dopamine';
export type UrgeKind = 'porn' | 'nicotine' | 'scroll' | 'other';

export interface Entry {
  id: string;
  created_at: string;
  kind: EntryKind;
  audio_path: string | null;
  transcript: string | null;
  processed: boolean;
}

export interface EntryInsight {
  id: string;
  entry_id: string;
  mood: number | null;
  energy: number | null;
  tags: string[];
  people: string[];
  stressors: string[];
  what_helped: string[];
  summary: string | null;
  // embedding is server-side only; not surfaced to the client
}

export interface CheckIn {
  id: string;
  created_at: string;
  mood: number | null;
  energy: number | null;
  activation: number | null;
  note: string | null;
}

export interface Tool {
  id: string;
  name: string;
  category: ToolCategory;
  description: string | null;
  is_energizing: boolean;
  media_url: string | null;
  archived: boolean;
}

export interface ToolUse {
  id: string;
  tool_id: string;
  used_at: string;
  duration_min: number | null;
  note: string | null;
}

export interface Media {
  id: string;
  title: string;
  url: string;
  need_tags: string[];
  source: string | null;
  archived: boolean;
}

export interface UrgeEvent {
  id: string;
  occurred_at: string;
  kind: UrgeKind;
  acted_on: boolean | null;
  rode_out: boolean | null;
  intensity: number | null;
  antecedent_state: string | null;
  antecedent_note: string | null;
  time_of_day: string | null;
  underlying_need: string | null;
  what_helped: string | null;
}

export interface CoachSession {
  id: string;
  urge_event_id: string | null;
  started_at: string;
  messages: CoachMessage[];
}

export interface CoachMessage {
  role: 'coach' | 'user';
  text: string;
  at: string;
}

export interface SelfMemo {
  id: string;
  created_at: string;
  audio_path: string;
  for_context: string | null;
}

export interface DailyLog {
  log_date: string;
  water_note: string | null;
  food_note: string | null;
  med_note: string | null;
  numbing_note: string | null;
}
