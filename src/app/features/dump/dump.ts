import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AudioRecorderService } from '../../core/audio-recorder.service';
import { DumpsService } from '../../core/dumps.service';
import { ExtractionService } from '../../core/extraction.service';
import { EventsService } from '../../core/events.service';
import { UrgesService } from '../../core/urges.service';
import { CATEGORY_META, DumpKind, EventDraft } from '../../core/models';
import { promptFor } from '../../core/prompts';

type Phase = 'capture' | 'processing' | 'review' | 'saving' | 'done';

/**
 * The universal brain-dump flow (handoff pivot): record/type -> transcribe ->
 * extract -> confirm chips -> save. One component serves check-in, journals,
 * urges, and ad-hoc captures (kind comes from the route).
 */
@Component({
  selector: 'app-dump',
  imports: [FormsModule],
  template: `
    <section class="flex min-h-screen flex-col py-10">
      <button type="button" (click)="leave()" class="self-start text-sm text-ink-faint">← home</button>

      @switch (phase()) {
        @case ('done') {
          <div class="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <p class="text-2xl font-light text-ink">{{ doneNote() }}</p>
            <p class="text-ink-soft">{{ savedCount() }}</p>
          </div>
        }

        @case ('processing') {
          <div class="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <div class="h-12 w-12 animate-spin rounded-full border-2 border-mist border-t-calm"></div>
            <p class="text-ink-soft">{{ processingNote() }}</p>
          </div>
        }

        @case ('review') {
          <div class="mt-4 flex-1">
            <h1 class="text-xl font-light text-ink">here's what I caught</h1>
            <p class="mt-1 text-sm text-ink-soft">tap to keep or drop · edit anything · add what I missed</p>

            <ul class="mt-5 flex flex-col gap-2">
              @for (d of drafts; track $index) {
                <li
                  class="rounded-2xl px-3 py-2.5 ring-1 transition"
                  [class.bg-surface]="d.include"
                  [class.ring-mist]="d.include"
                  [class.bg-canvas]="!d.include"
                  [class.opacity-50]="!d.include"
                  [class.ring-transparent]="!d.include"
                >
                  <div class="flex items-center gap-2">
                    <button type="button" (click)="d.include = !d.include" class="text-lg" [attr.aria-pressed]="d.include">
                      {{ d.include ? '✓' : '○' }}
                    </button>
                    <span class="text-lg">{{ icon(d.category) }}</span>
                    <select [(ngModel)]="d.category" class="bg-transparent text-sm text-ink-soft outline-none">
                      @for (c of categories; track c) { <option [value]="c">{{ c }}</option> }
                    </select>
                    <input [(ngModel)]="d.label" placeholder="label" class="min-w-0 flex-1 bg-transparent text-ink outline-none" />
                    <button type="button" (click)="removeDraft($index)" class="text-ink-faint">✕</button>
                  </div>
                  <div class="mt-1 flex items-center gap-2 pl-9 text-sm text-ink-faint">
                    <input [(ngModel)]="d.amount" type="number" placeholder="amt" class="w-16 bg-transparent outline-none" />
                    <input [(ngModel)]="d.unit" placeholder="unit" class="w-16 bg-transparent outline-none" />
                    <input [(ngModel)]="d.note" placeholder="note" class="min-w-0 flex-1 bg-transparent outline-none" />
                  </div>
                </li>
              } @empty {
                <li class="rounded-2xl bg-surface p-4 text-sm text-ink-soft ring-1 ring-mist">
                  Nothing trackable jumped out — that's fine. Add anything you want to log, or just save the note.
                </li>
              }
            </ul>

            <button type="button" (click)="addBlank()" class="mt-3 text-sm text-calm">＋ add item</button>

            <details class="mt-5 rounded-2xl bg-surface p-3 text-sm ring-1 ring-mist">
              <summary class="cursor-pointer text-ink-soft">what you said</summary>
              <p class="mt-2 whitespace-pre-wrap text-ink-soft">{{ transcript() }}</p>
            </details>

            <div class="mt-6 flex gap-2 pb-2">
              <button type="button" (click)="save()" class="flex-1 rounded-2xl bg-calm px-4 py-3 font-medium text-white">
                save
              </button>
            </div>
          </div>
        }

        @default {
          <!-- capture -->
          <div class="flex flex-1 flex-col items-center justify-center gap-8 text-center">
            <p class="max-w-xs text-xl font-light leading-relaxed text-ink">{{ prompt() }}</p>

            @if (!typing()) {
              <button
                type="button"
                (click)="toggleRecord()"
                class="flex h-44 w-44 items-center justify-center rounded-full text-white shadow-lg transition active:scale-95"
                [class.bg-calm]="!recorder.recording()"
                [class.bg-warm]="recorder.recording()"
              >
                @if (recorder.recording()) {
                  <span class="text-lg font-light">tap when done</span>
                } @else {
                  <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                }
              </button>
              @if (recorder.recording()) {
                <p class="text-ink-faint">{{ seconds() }}s · take your time</p>
              } @else {
                <button type="button" (click)="typing.set(true)" class="text-sm text-ink-faint underline-offset-4 hover:underline">rather type it</button>
              }
            } @else {
              <textarea [(ngModel)]="typed" rows="6" placeholder="…" class="w-full rounded-2xl border border-mist bg-surface p-4 text-ink outline-none focus:border-calm"></textarea>
              <button type="button" (click)="submitTyped()" [disabled]="!typed.trim()" class="rounded-2xl bg-calm px-6 py-3 font-medium text-white disabled:opacity-50">capture</button>
            }
          </div>
        }
      }

      @if (error()) { <p class="pb-3 text-center text-sm text-ink-soft">{{ error() }}</p> }
    </section>
  `,
})
export class Dump {
  protected readonly recorder = inject(AudioRecorderService);
  private readonly dumps = inject(DumpsService);
  private readonly extraction = inject(ExtractionService);
  private readonly events = inject(EventsService);
  private readonly urges = inject(UrgesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly categories = Object.keys(CATEGORY_META);
  protected readonly kind: DumpKind = this.resolveKind();

  protected readonly phase = signal<Phase>('capture');
  protected readonly typing = signal(false);
  protected typed = '';
  protected drafts: EventDraft[] = [];
  protected readonly transcript = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly savedCount = signal('');
  protected readonly processingNote = signal('making sense of it…');

  private dumpId: string | null = null;
  protected readonly prompt = signal(promptFor(this.kind, Date.now() / 60000));

  private resolveKind(): DumpKind {
    const raw = this.route.snapshot.paramMap.get('kind') ?? 'adhoc';
    if (raw === 'journal') {
      return new Date().getHours() < 14 ? 'journal_morning' : 'journal_evening';
    }
    if (['checkin', 'urge', 'adhoc'].includes(raw)) return raw as DumpKind;
    return 'adhoc';
  }

  protected seconds(): number {
    return Math.floor(this.recorder.elapsedMs() / 1000);
  }

  protected icon(cat: string): string {
    return CATEGORY_META[cat]?.icon ?? '•';
  }

  protected async toggleRecord(): Promise<void> {
    this.error.set(null);
    if (!this.recorder.recording()) {
      try {
        await this.recorder.start();
      } catch {
        this.error.set('I could not reach the microphone — try typing instead.');
        this.typing.set(true);
      }
      return;
    }
    try {
      const { blob, mimeType } = await this.recorder.stop();
      await this.processAudio(blob, mimeType);
    } catch (e) {
      this.fail(e);
    }
  }

  protected async submitTyped(): Promise<void> {
    const text = this.typed.trim();
    if (!text) return;
    this.phase.set('processing');
    try {
      const dump = await this.dumps.create(this.kind, {
        transcript: text,
        status: 'transcribed',
      });
      this.dumpId = dump.id;
      this.transcript.set(text);
      await this.runExtraction(text);
    } catch (e) {
      this.fail(e);
    }
  }

  private async processAudio(blob: Blob, mime: string): Promise<void> {
    this.phase.set('processing');
    this.processingNote.set('transcribing…');
    const path = await this.dumps.uploadAudio(blob, mime);
    const dump = await this.dumps.create(this.kind, {
      audio_path: path,
      status: 'transcribing',
    });
    this.dumpId = dump.id;
    const transcript = await this.dumps.transcribe(dump.id, path);
    this.transcript.set(transcript);
    await this.runExtraction(transcript);
  }

  private async runExtraction(transcript: string): Promise<void> {
    this.processingNote.set('making sense of it…');
    try {
      this.drafts = await this.extraction.extract(transcript, this.kind);
    } catch {
      this.drafts = []; // extraction is best-effort; you can still add manually
    }
    this.phase.set('review');
  }

  protected addBlank(): void {
    this.drafts.push({
      category: 'mood',
      label: '',
      amount: null,
      unit: null,
      valence: null,
      occurred_at: null,
      note: null,
      confidence: 1,
      source: 'manual',
      include: true,
    });
  }

  protected removeDraft(i: number): void {
    this.drafts.splice(i, 1);
  }

  protected async save(): Promise<void> {
    this.phase.set('saving');
    const now = new Date().toISOString();
    try {
      await this.events.saveDrafts(this.drafts, this.dumpId, now);
      if (this.kind === 'urge' && this.dumpId) {
        await this.urges.createForDump(this.dumpId);
      }
      if (this.dumpId) await this.dumps.setStatus(this.dumpId, 'done');

      const n = this.drafts.filter((d) => d.include).length;
      this.savedCount.set(n ? `${n} thing${n === 1 ? '' : 's'} logged` : 'note saved');
      this.doneNote.set(this.kind === 'urge' ? 'logged. that took strength.' : 'got it.');
      this.phase.set('done');
      setTimeout(() => this.router.navigateByUrl('/'), 1800);
    } catch (e) {
      this.fail(e);
      this.phase.set('review');
    }
  }

  protected readonly doneNote = signal('got it.');

  protected leave(): void {
    this.recorder.cancel();
    this.router.navigateByUrl('/');
  }

  private fail(e: unknown): void {
    const msg = e instanceof Error ? e.message : String(e);
    this.error.set(`That didn't go through — nothing's lost on your end. (${msg})`);
  }
}
