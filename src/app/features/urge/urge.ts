import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AudioRecorderService } from '../capture/audio-recorder.service';
import { UrgeService, CoachTurn } from './urge.service';
import { CoachMessage, UrgeKind } from '../../core/models';

type Phase = 'ready' | 'talking' | 'listening' | 'thinking' | 'closing' | 'done';

// Gentle grounding lines used when the coach Edge Function isn't reachable yet
// (no keys / not deployed). Keeps the loop usable and never shaming (§1.4).
const FALLBACK_LINES = [
  "I'm really glad you came here instead. You don't have to do anything yet — let's just breathe for a second.",
  'Where do you feel this in your body right now?',
  'What was going on just before this showed up?',
  "This wave will crest and pass on its own. What's one small thing that's helped before?",
  "You're already doing the hard part by staying with it. What do you actually need right now — a break, some quiet, something else?",
];

// 1x1 silent mp3 — played on the opening gesture to unlock audio for iOS (§7).
const SILENT_MP3 =
  'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQxAADB8AhSmxhIIEVCSiJrDCQBTcu3UrAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

@Component({
  selector: 'app-urge',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex min-h-screen flex-col py-10">
      <button type="button" (click)="leave()" class="self-start text-sm text-ink-faint">
        ← I'm okay now
      </button>

      @switch (phase()) {
        @case ('ready') {
          <div class="flex flex-1 flex-col items-center justify-center gap-8 text-center">
            <p class="max-w-xs text-2xl font-light leading-relaxed text-ink">
              I'm here with you. There's no wrong thing to say.
            </p>
            <button
              type="button"
              (click)="begin()"
              class="flex h-44 w-44 items-center justify-center rounded-full bg-calm text-lg font-light text-white shadow-lg transition active:scale-95"
            >
              start when ready
            </button>
            <p class="text-sm text-ink-faint">just being here already counts.</p>
          </div>
        }

        @case ('done') {
          <div class="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <p class="text-2xl font-light text-ink">you stayed with it.</p>
            <p class="text-ink-soft">{{ closingNote() }}</p>
          </div>
        }

        @case ('closing') {
          <div class="mt-8 flex flex-1 flex-col gap-6">
            <p class="text-xl font-light text-ink">before you go — how did it land?</p>

            <div>
              <p class="text-sm text-ink-soft">did the urge pass without acting on it?</p>
              <div class="mt-2 flex gap-2">
                <button type="button" (click)="rodeOut = true" [class.bg-calm]="rodeOut === true" [class.text-white]="rodeOut === true" class="flex-1 rounded-2xl bg-surface px-4 py-3 ring-1 ring-mist">rode it out</button>
                <button type="button" (click)="rodeOut = false" [class.bg-calm]="rodeOut === false" [class.text-white]="rodeOut === false" class="flex-1 rounded-2xl bg-surface px-4 py-3 ring-1 ring-mist">acted on it</button>
              </div>
              @if (rodeOut === false) {
                <p class="mt-2 text-sm text-ink-faint">that's data, not failure. it still counts that you logged it.</p>
              }
            </div>

            <div>
              <p class="text-sm text-ink-soft">what was underneath it?</p>
              <div class="mt-2 flex flex-wrap gap-2">
                @for (n of needs; track n) {
                  <button type="button" (click)="need = n" [class.bg-calm]="need === n" [class.text-white]="need === n" class="rounded-full bg-surface px-3 py-1.5 text-sm ring-1 ring-mist">{{ n }}</button>
                }
              </div>
            </div>

            <button type="button" (click)="finish()" class="mt-2 rounded-2xl bg-calm px-4 py-3 font-medium text-white">done</button>
            <button type="button" (click)="finish()" class="text-sm text-ink-faint">skip</button>
          </div>
        }

        @default {
          <!-- talking / listening / thinking -->
          <div class="flex flex-1 flex-col">
            <div class="flex-1 space-y-4 overflow-y-auto py-6">
              @for (m of messages(); track $index) {
                <p
                  class="max-w-[85%] rounded-2xl px-4 py-3 leading-relaxed"
                  [class.bg-surface]="m.role === 'coach'"
                  [class.text-ink]="m.role === 'coach'"
                  [class.ring-1]="m.role === 'coach'"
                  [class.ring-mist]="m.role === 'coach'"
                  [class.ml-auto]="m.role === 'user'"
                  [class.bg-calm]="m.role === 'user'"
                  [class.text-white]="m.role === 'user'"
                >
                  {{ m.text }}
                </p>
              }
              @if (phase() === 'thinking') {
                <p class="text-ink-faint">…</p>
              }
            </div>

            <div class="flex flex-col items-center gap-4 pb-2">
              <button
                type="button"
                (click)="toggleListen()"
                [disabled]="phase() === 'thinking'"
                class="flex h-28 w-28 items-center justify-center rounded-full text-white shadow-lg transition active:scale-95 disabled:opacity-50"
                [class.bg-calm]="phase() !== 'listening'"
                [class.bg-warm]="phase() === 'listening'"
              >
                {{ phase() === 'listening' ? 'done' : 'speak' }}
              </button>

              <button type="button" (click)="showType = !showType" class="text-sm text-ink-faint">
                {{ showType ? 'hide' : 'or type instead' }}
              </button>
              @if (showType) {
                <div class="flex w-full gap-2">
                  <input
                    [(ngModel)]="typed"
                    (keyup.enter)="sendTyped()"
                    placeholder="say it here…"
                    class="flex-1 rounded-2xl border border-mist bg-surface px-4 py-2 outline-none focus:border-calm"
                  />
                  <button type="button" (click)="sendTyped()" class="rounded-2xl bg-calm px-4 text-white">send</button>
                </div>
              }
              <button type="button" (click)="enterClose()" class="text-sm text-ink-faint underline-offset-4 hover:underline">
                I'm steadier now
              </button>
            </div>
          </div>
        }
      }

      @if (error()) {
        <p class="pb-3 text-center text-sm text-ink-soft">{{ error() }}</p>
      }
    </section>
  `,
})
export class Urge {
  private readonly recorder = inject(AudioRecorderService);
  private readonly urge = inject(UrgeService);
  private readonly router = inject(Router);

  protected readonly phase = signal<Phase>('ready');
  protected readonly messages = signal<CoachMessage[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly closingNote = signal('logged. that was the win.');

  protected showType = false;
  protected typed = '';
  protected rodeOut: boolean | null = null;
  protected need = '';
  protected readonly needs = ['stimulation', 'escape', 'a break', 'comfort', 'connection', 'not sure'];

  private audio = new Audio();
  private urgeId: string | null = null;
  private fallbackIdx = 0;
  private sessionSaved = false;

  /** §8.1: the opening gesture — create the event, unlock audio, coach speaks. */
  protected async begin(): Promise<void> {
    this.error.set(null);
    // Unlock audio within the gesture (iOS, §7).
    this.audio.src = SILENT_MP3;
    this.audio.play().catch(() => {});

    try {
      const ev = await this.urge.startUrge('other' as UrgeKind);
      this.urgeId = ev.id;
    } catch (e) {
      // Don't block the coach if logging fails — the support matters more.
      console.warn('urge logging failed', e);
    }

    this.phase.set('talking');
    await this.coachTurn(true);
  }

  /** Ask the coach for the next line (or fall back), show + speak it. */
  private async coachTurn(opening = false): Promise<void> {
    this.phase.set('thinking');
    const history: CoachTurn[] = this.messages().map((m) => ({
      role: m.role,
      text: m.text,
    }));

    let reply = '';
    try {
      reply = await this.urge.coachReply(history);
    } catch {
      reply = '';
    }
    if (!reply) {
      reply = opening ? FALLBACK_LINES[0] : this.nextFallback();
    }

    this.append('coach', reply);
    // Show the line (clears the "…"), speak it, then hand the turn back. We
    // don't auto-record — the user taps "speak" when ready (calmer, §8).
    this.phase.set('talking');
    await this.play(reply);
  }

  private nextFallback(): string {
    this.fallbackIdx = (this.fallbackIdx + 1) % FALLBACK_LINES.length;
    return FALLBACK_LINES[this.fallbackIdx];
  }

  protected async toggleListen(): Promise<void> {
    if (this.phase() === 'listening') {
      // stop + transcribe
      this.phase.set('thinking');
      try {
        const { blob, mimeType } = await this.recorder.stop();
        const text = await this.urge.transcribeTurn(blob, mimeType);
        if (text) {
          this.append('user', text);
          await this.coachTurn();
        } else {
          this.error.set("I couldn't catch that — you can type it instead.");
          this.showType = true;
          this.phase.set('talking');
        }
      } catch (e) {
        this.error.set(this.describe(e));
        this.phase.set('talking');
      }
      return;
    }
    // start listening
    this.error.set(null);
    try {
      await this.recorder.start();
      this.phase.set('listening');
    } catch {
      this.error.set('No mic access — type instead?');
      this.showType = true;
    }
  }

  protected async sendTyped(): Promise<void> {
    const t = this.typed.trim();
    if (!t) return;
    this.typed = '';
    this.append('user', t);
    await this.coachTurn();
  }

  protected enterClose(): void {
    this.recorder.cancel();
    this.phase.set('closing');
  }

  protected async finish(): Promise<void> {
    try {
      if (this.urgeId) {
        await this.urge.closeUrge(this.urgeId, {
          rode_out: this.rodeOut ?? undefined,
          acted_on: this.rodeOut === null ? undefined : !this.rodeOut,
          underlying_need: this.need || undefined,
        });
        await this.persistSession();
      }
    } catch (e) {
      console.warn('closeout save failed', e);
    }
    if (this.rodeOut === false) {
      this.closingNote.set("you logged it honestly. that's how the pattern gets clearer.");
    }
    this.phase.set('done');
    setTimeout(() => this.router.navigateByUrl('/'), 2600);
  }

  protected async leave(): Promise<void> {
    this.recorder.cancel();
    // Don't lose the conversation just because they left without a formal
    // close-out — the transcript is the gold for therapy (§8).
    await this.persistSession();
    this.router.navigateByUrl('/');
  }

  /** Save the coach transcript once (guarded against finish()+leave() double). */
  private async persistSession(): Promise<void> {
    if (this.sessionSaved || !this.urgeId || this.messages().length === 0) return;
    this.sessionSaved = true;
    try {
      await this.urge.saveSession(this.urgeId, this.messages());
    } catch (e) {
      console.warn('session save failed', e);
    }
  }

  private append(role: 'coach' | 'user', text: string): void {
    this.messages.update((m) => [
      ...m,
      { role, text, at: new Date().toISOString() },
    ]);
  }

  private async play(text: string): Promise<void> {
    const url = await this.urge.speak(text);
    if (!url) return; // TTS not live — text on screen is enough.
    try {
      this.audio.src = url;
      await this.audio.play();
    } catch {
      /* autoplay blocked — text is still shown */
    }
  }

  private describe(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
  }
}
