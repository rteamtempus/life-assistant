import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AudioRecorderService } from './audio-recorder.service';
import { CaptureService } from './capture.service';
import { dayContext } from '../../core/time-of-day';
import { rotatingPrompt } from '../../core/prompts';
import { EntryKind } from '../../core/models';

type Phase = 'idle' | 'recording' | 'saving' | 'done' | 'typing';

/**
 * Voice brain-dump (handoff §10 Phase 1). Opens with a warm prompt, one big
 * tap to speak. Saving is decoupled from any AI work — the entry lands first,
 * structuring happens later. A typed fallback is offered but never the
 * default (§1.2 speaking is low-friction).
 */
@Component({
  selector: 'app-capture',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex min-h-screen flex-col py-10">
      <button
        type="button"
        (click)="back()"
        class="self-start text-sm text-ink-faint"
      >
        ← home
      </button>

      <div class="flex flex-1 flex-col items-center justify-center gap-10 text-center">
        @switch (phase()) {
          @case ('done') {
            <p class="text-2xl font-light text-ink">got it. that's safe now.</p>
            <p class="text-ink-soft">{{ savedNote() }}</p>
          }
          @case ('typing') {
            <p class="max-w-xs text-lg font-light text-ink">{{ prompt() }}</p>
            <textarea
              [(ngModel)]="typed"
              rows="6"
              placeholder="…"
              class="w-full rounded-2xl border border-mist bg-surface p-4 text-ink outline-none focus:border-calm"
            ></textarea>
            <button
              type="button"
              (click)="saveTyped()"
              [disabled]="!typed.trim()"
              class="rounded-2xl bg-calm px-6 py-3 font-medium text-white disabled:opacity-50"
            >
              set it down
            </button>
          }
          @default {
            <p class="max-w-xs text-xl font-light leading-relaxed text-ink">
              {{ prompt() }}
            </p>

            <button
              type="button"
              (click)="toggle()"
              [disabled]="phase() === 'saving'"
              class="flex h-44 w-44 items-center justify-center rounded-full text-white shadow-lg transition active:scale-95"
              [class.bg-calm]="phase() !== 'recording'"
              [class.bg-warm]="phase() === 'recording'"
            >
              @if (phase() === 'recording') {
                <span class="text-lg font-light">tap when done</span>
              } @else if (phase() === 'saving') {
                <span class="text-lg font-light">saving…</span>
              } @else {
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              }
            </button>

            @if (phase() === 'recording') {
              <p class="text-ink-faint">{{ seconds() }}s · take your time</p>
            } @else if (phase() === 'idle') {
              <button
                type="button"
                (click)="phase.set('typing')"
                class="text-sm text-ink-faint underline-offset-4 hover:underline"
              >
                rather type it
              </button>
            }
          }
        }
      </div>

      @if (error()) {
        <p class="pb-4 text-center text-sm text-ink-soft">{{ error() }}</p>
      }
    </section>
  `,
})
export class Capture {
  private readonly recorder = inject(AudioRecorderService);
  private readonly capture = inject(CaptureService);
  private readonly router = inject(Router);

  protected readonly phase = signal<Phase>('idle');
  protected readonly error = signal<string | null>(null);
  protected readonly savedNote = signal('');
  protected typed = '';

  private readonly now = new Date();
  private readonly part = dayContext(this.now).part;
  protected readonly prompt = signal(
    rotatingPrompt(this.part, this.now.getHours() * 60 + this.now.getMinutes()),
  );

  protected readonly seconds = computed(() =>
    Math.floor(this.recorder.elapsedMs() / 1000),
  );

  /** Entry kind derived from the time of day. */
  private kind(): EntryKind {
    if (this.part === 'morning') return 'morning';
    if (this.part === 'night') return 'night';
    return 'adhoc';
  }

  protected async toggle(): Promise<void> {
    this.error.set(null);
    if (this.phase() === 'idle') {
      try {
        await this.recorder.start();
        this.phase.set('recording');
      } catch {
        this.error.set('I could not reach the microphone. Check permissions?');
      }
      return;
    }
    if (this.phase() === 'recording') {
      this.phase.set('saving');
      try {
        const { blob, mimeType } = await this.recorder.stop();
        await this.capture.saveVoiceEntry(blob, mimeType, this.kind());
        this.savedNote.set("i'll make sense of it overnight.");
        this.phase.set('done');
        this.returnHomeSoon();
      } catch (e) {
        this.error.set(this.describe(e));
        this.phase.set('idle');
      }
    }
  }

  protected async saveTyped(): Promise<void> {
    this.error.set(null);
    this.phase.set('saving');
    try {
      await this.capture.saveTextEntry(this.typed.trim(), this.kind());
      this.savedNote.set('set down.');
      this.phase.set('done');
      this.returnHomeSoon();
    } catch (e) {
      this.error.set(this.describe(e));
      this.phase.set('typing');
    }
  }

  protected back(): void {
    this.recorder.cancel();
    this.router.navigateByUrl('/');
  }

  private returnHomeSoon(): void {
    setTimeout(() => this.router.navigateByUrl('/'), 2200);
  }

  private describe(e: unknown): string {
    const msg = e instanceof Error ? e.message : String(e);
    // Keep the coach voice even on errors (handoff §1.4): never a scold.
    return `That didn't save — but nothing's lost on your end. (${msg})`;
  }
}
