import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { AudioRecorderService } from '../capture/audio-recorder.service';
import { SelfMemosService, PlayableMemo } from './self-memos.service';

type Phase = 'idle' | 'recording' | 'saving';

/**
 * Future-self memos (handoff §8.5). Record a short message to yourself while
 * calm; it's offered back during an urge or a crash. "You, earlier, on your
 * side." Recorded here; surfaced by the urge-coach loop.
 */
@Component({
  selector: 'app-self-memos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex min-h-screen flex-col py-10">
      <button type="button" (click)="back()" class="self-start text-sm text-ink-faint">
        ← home
      </button>

      <h1 class="mt-6 text-2xl font-light text-ink">a note to future you</h1>
      <p class="mt-1 text-ink-soft">
        record this while you're steady. it'll be here when a harder moment comes.
      </p>

      <div class="mt-6 flex flex-wrap gap-2">
        @for (c of contexts; track c.value) {
          <button
            type="button"
            (click)="context.set(c.value)"
            [class.bg-calm]="context() === c.value"
            [class.text-white]="context() === c.value"
            class="rounded-full bg-surface px-4 py-2 text-sm ring-1 ring-mist"
          >
            {{ c.label }}
          </button>
        }
      </div>

      <div class="mt-8 flex flex-col items-center gap-3">
        <button
          type="button"
          (click)="toggle()"
          [disabled]="phase() === 'saving'"
          class="flex h-32 w-32 items-center justify-center rounded-full text-white shadow-lg transition active:scale-95"
          [class.bg-calm]="phase() !== 'recording'"
          [class.bg-warm]="phase() === 'recording'"
        >
          {{ phase() === 'recording' ? 'done' : phase() === 'saving' ? '…' : 'record' }}
        </button>
        @if (phase() === 'recording') {
          <p class="text-ink-faint">speaking to {{ contextLabel() }} · take your time</p>
        }
      </div>

      <h2 class="mt-12 text-sm uppercase tracking-wide text-ink-faint">your memos</h2>
      @if (loading()) {
        <p class="mt-3 text-ink-faint">…</p>
      } @else if (memos().length === 0) {
        <p class="mt-3 text-ink-soft">none yet.</p>
      } @else {
        <ul class="mt-3 flex flex-col gap-2">
          @for (m of memos(); track m.id) {
            <li class="flex items-center justify-between rounded-2xl bg-surface px-4 py-3 ring-1 ring-mist">
              <span class="text-sm text-ink-soft">{{ m.for_context || 'anytime' }}</span>
              @if (m.signedUrl) {
                <audio controls [src]="m.signedUrl" class="h-8"></audio>
              }
            </li>
          }
        </ul>
      }

      @if (error()) {
        <p class="mt-4 text-sm text-ink-soft">{{ error() }}</p>
      }
    </section>
  `,
})
export class SelfMemos implements OnInit {
  private readonly recorder = inject(AudioRecorderService);
  private readonly memosService = inject(SelfMemosService);
  private readonly router = inject(Router);

  protected readonly contexts = [
    { value: 'urge', label: 'an urge' },
    { value: 'crash', label: 'a crash' },
    { value: 'hard-morning', label: 'a hard morning' },
    { value: 'anytime', label: 'anytime' },
  ];

  protected readonly context = signal('urge');
  protected readonly phase = signal<Phase>('idle');
  protected readonly memos = signal<PlayableMemo[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.refresh();
  }

  protected contextLabel(): string {
    return this.contexts.find((c) => c.value === this.context())?.label ?? '';
  }

  protected async toggle(): Promise<void> {
    this.error.set(null);
    if (this.phase() === 'idle') {
      try {
        await this.recorder.start();
        this.phase.set('recording');
      } catch {
        this.error.set('No mic access — check permissions?');
      }
      return;
    }
    if (this.phase() === 'recording') {
      this.phase.set('saving');
      try {
        const { blob, mimeType } = await this.recorder.stop();
        await this.memosService.record(blob, mimeType, this.context());
        await this.refresh();
      } catch (e) {
        this.error.set(e instanceof Error ? e.message : String(e));
      } finally {
        this.phase.set('idle');
      }
    }
  }

  private async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      this.memos.set(await this.memosService.list());
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.loading.set(false);
    }
  }

  protected back(): void {
    this.recorder.cancel();
    this.router.navigateByUrl('/');
  }
}
