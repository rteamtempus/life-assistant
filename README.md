# Life Assistant

A voice-first personal regulation + self-knowledge tool. Audience of one.

> **Capture → Sense-making → Surfacing.** You speak. AI structures it later.
> The app hands the right thing back at the right moment. The payoff is the point.

See [`HANDOFF.md`](../HANDOFF.md) (in the workspace root) for the full product
brief and design principles. The short version, which the code is built to honor:

1. **Track presence, never absence** — no streaks, no missed-day counters.
2. **No blank boxes** — every capture surface opens with a warm rotating prompt.
3. **Anti-optimization ceiling** — surface one thing at a time; hide the rest.
4. **Non-shaming coach voice, always.**
5. **Therapist-in-the-loop** — this feeds therapy, doesn't replace it.
6. **Privacy is load-bearing** — RLS on, keys server-side, app lock planned.

## Stack

- **Angular 20** PWA (standalone components, signals, lazy routes) + **Tailwind v4**
- **Supabase** — Postgres + Storage + Edge Functions + pg_cron
- **Google Gemini** for everything generative — structuring, nightly/weekly
  summaries, the urge coach, transcription, and semantic-recall embeddings
- **Google Cloud TTS Chirp 3 HD** for the coach voice
  (all server-side in Edge Functions; never on the client)

## What's built

**Phase 1 — capture + deck**
| Area | Where |
|---|---|
| Time-aware home + rotating warm prompts | `src/app/features/home`, `src/app/core/{prompts,time-of-day}.ts` |
| Voice capture → Storage → `entries` | `src/app/features/capture` (`audio-recorder.service.ts` = MediaRecorder spine) |
| Tool deck + one-tap `tool_uses` logging | `src/app/features/tools` |
| Quick check-ins (mood / energy / activation) | `src/app/features/check-in` |
| Auth gate (Supabase session) | `src/app/features/auth`, `src/app/core/auth.guard.ts` |

**Phase 2 — close the loop**
| Area | Where |
|---|---|
| Gemini transcription | `supabase/functions/transcribe` |
| Structuring (mood/tags/…) + embeddings | `supabase/functions/structure-entry`, `_shared/{structuring,embeddings}.ts` |
| Nightly batch (process + embed + flip) | `supabase/functions/nightly-analysis` |
| Semantic recall + tool ranking | `supabase/functions/surface`, `migrations/0005_surfacing.sql` |
| "I feel ___ → what helped" screen | `src/app/features/surface` |

**Phase 3 — recovery**
| Area | Where |
|---|---|
| Urge-coach voice loop (voice + text fallback) | `src/app/features/urge` |
| TTS (Google Chirp 3 HD) + live STT | `supabase/functions/{tts,stt}` |
| `urge_events` + `coach_sessions` + close-out | `src/app/features/urge/urge.service.ts` |
| Future-self memos (record + playback) | `src/app/features/self-memos` |

**Phase 4 — reflection + export**
| Area | Where |
|---|---|
| Weekly auto-summary | `supabase/functions/weekly-summary`, `migrations/0006_reflections.sql` |
| Therapist export (client-side Markdown) | `src/app/features/export` |
| MCP read-mostly role + reflections write-path | `supabase/sql/mcp_readonly_role.sql` |

Graceful degradation: the urge coach and surfacing screens work **before** any
API keys are set (coach falls back to built-in grounding lines, surfacing falls
back to history-based tool ranking) — voice/AI layers light up once the
functions are deployed with keys.

**Not yet built:** the PIN/biometric app-lock (§6) and the work-notes module
(§10, deferred). Migrating the nightly/weekly jobs to the Batch API is a noted
future cost optimization (currently synchronous; pennies at single-user volume).

## Getting started

### 1. Client config (public, client-safe)

Add your Supabase project URL + anon key (Project Settings → API) to
`src/environments/environment.development.ts`. Both are safe to expose — RLS
gates everything.

### 2. Install + run

```bash
npm install
npm start          # ng serve → http://localhost:4200
npm run build      # production build
```

### 3. Database

```bash
npx supabase link --project-ref snlrpqamjzwoksmoxzir   # connect to the cloud project
npx supabase db push                                   # apply supabase/migrations/*
```

> Migrations `0001`–`0004` are already applied to the cloud project. `0005_surfacing`
> (tool ranking + semantic recall functions) and `0006_reflections` are new and
> need a `db push` before the surfacing/weekly-summary features work.

Then run the one-off SQL templates by hand (they carry secrets / project refs):
- `supabase/sql/mcp_readonly_role.sql` — the read-mostly MCP role (§6)
- `supabase/sql/schedule_nightly.sql` — pg_cron → nightly batch (§3, Phase 2)
- `supabase/sql/schedule_weekly.sql` — pg_cron → weekly summary (§3, Phase 4)

### 4. Edge Function secrets + deploy (privileged keys, server-side only)

Which key each function needs (Gemini powers all generative + transcription +
embeddings; Google Cloud TTS only for the coach voice):

| Function | Needs |
|---|---|
| `transcribe`, `stt` | `GEMINI_API_KEY` |
| `structure-entry`, `nightly-analysis`, `weekly-summary` | `GEMINI_API_KEY` |
| `urge-coach` | `GEMINI_API_KEY` |
| `surface` | `GEMINI_API_KEY` |
| `tts` | `GOOGLE_TTS_API_KEY` (may be the same Google key) |

```bash
cp .env.example .env      # fill in the keys above
npx supabase secrets set --env-file ./.env
npx supabase functions deploy transcribe stt structure-entry nightly-analysis \
  weekly-summary surface urge-coach tts
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically — don't set them.

Until the keys/functions are deployed, the app still runs: capture saves audio
(placeholder transcript), the urge coach uses built-in grounding lines, and
surfacing ranks tools from your own history.

## Project layout

```
src/app/
  core/        supabase client, models, auth guard, prompts, time-of-day
  features/    home, capture, tools, check-in, auth, surface, urge,
               self-memos, export (each lazy-loaded)
supabase/
  migrations/  schema, RLS, storage, surfacing fns, reflections
  functions/   Edge Functions (Deno): transcribe, stt, structure-entry,
               nightly-analysis, weekly-summary, surface, urge-coach, tts
               + _shared (anthropic, embeddings, structuring, cors, admin)
  sql/         one-off templates (MCP role, cron schedules)
  seed.sql     local-only dev fixtures (starter tools live in migration 0004)
```
