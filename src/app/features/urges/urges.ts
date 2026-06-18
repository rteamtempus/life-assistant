import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AudioRecorderService } from '../../core/audio-recorder.service';
import { DumpsService } from '../../core/dumps.service';
import { UrgesService, UrgeWithDumps } from '../../core/urges.service';

/**
 * Past urges + the second stage of the urge flow (handoff pivot): look back,
 * and brain-dump a follow-up saying whether you used and what helped. "Urges
 * ridden out" is the quiet win — never a streak.
 */
@Component({
  selector: 'app-urges',
  imports: [FormsModule],
  template: `
    <section class="flex min-h-screen flex-col py-10">
      <button type="button" (click)="back()" class="self-start text-sm text-ink-faint">← home</button>
      <h1 class="mt-6 text-2xl font-light text-ink">your urges</h1>
      <p class="mt-1 text-ink-soft">every one logged is a moment you stayed with.</p>

      @if (loading()) {
        <p class="mt-8 text-ink-faint">…</p>
      } @else if (urges().length === 0) {
        <p class="mt-8 text-ink-soft">none logged yet.</p>
      } @else {
        <ul class="mt-6 flex flex-col gap-3">
          @for (u of urges(); track u.id) {
            <li class="rounded-2xl bg-surface p-4 ring-1 ring-mist">
              <div class="flex items-baseline justify-between">
                <span class="text-ink">{{ u.kind || 'urge' }}</span>
                <span class="text-xs text-ink-faint">{{ when(u.occurred_at) }}</span>
              </div>
              @if (u.trigger) { <p class="mt-1 text-sm text-ink-soft">trigger: {{ u.trigger }}</p> }
              @if (u.initial?.transcript) {
                <p class="mt-1 text-sm text-ink-faint">{{ u.initial?.transcript }}</p>
              }

              @if (u.resolved) {
                <p class="mt-2 text-sm" [class.text-calm]="u.acted_on === false" [class.text-ink-soft]="u.acted_on !== false">
                  {{ u.acted_on === false ? '✓ rode it out' : 'acted on it — and you logged it honestly' }}
                </p>
                @if (u.what_helped) { <p class="text-sm text-ink-faint">what helped: {{ u.what_helped }}</p> }
              } @else if (followingUp() === u.id) {
                <div class="mt-3 flex flex-col gap-2">
                  <textarea [(ngModel)]="followText" rows="3" placeholder="what happened? did you use, and what did you do?" class="rounded-xl border border-mist bg-canvas p-2 text-sm outline-none focus:border-calm"></textarea>
                  <div class="flex items-center gap-2">
                    <button type="button" (click)="recordFollow()" class="rounded-full px-3 py-1.5 text-sm text-white" [class.bg-calm]="!recorder.recording()" [class.bg-warm]="recorder.recording()">
                      {{ recorder.recording() ? 'stop' : '🎤 speak' }}
                    </button>
                    <span class="text-sm text-ink-faint">or type ↑</span>
                  </div>
                  <div class="mt-1 flex gap-2">
                    <button type="button" (click)="resolve(u, false)" [disabled]="busy()" class="flex-1 rounded-xl bg-calm px-3 py-2 text-sm font-medium text-white disabled:opacity-50">rode it out</button>
                    <button type="button" (click)="resolve(u, true)" [disabled]="busy()" class="flex-1 rounded-xl bg-surface px-3 py-2 text-sm ring-1 ring-mist disabled:opacity-50">I used</button>
                  </div>
                </div>
              } @else {
                <button type="button" (click)="startFollow(u.id)" class="mt-2 text-sm text-calm">add a follow-up</button>
              }
            </li>
          }
        </ul>
      }
      @if (error()) { <p class="mt-4 text-sm text-ink-soft">{{ error() }}</p> }
    </section>
  `,
})
export class Urges implements OnInit {
  protected readonly recorder = inject(AudioRecorderService);
  private readonly urgesService = inject(UrgesService);
  private readonly dumps = inject(DumpsService);
  private readonly router = inject(Router);

  protected readonly urges = signal<UrgeWithDumps[]>([]);
  protected readonly loading = signal(true);
  protected readonly followingUp = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected followText = '';

  async ngOnInit(): Promise<void> {
    await this.refresh();
  }

  private async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      this.urges.set(await this.urgesService.listRecent());
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.loading.set(false);
    }
  }

  protected when(iso: string): string {
    return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  protected startFollow(id: string): void {
    this.followingUp.set(id);
    this.followText = '';
  }

  /** Record a spoken follow-up; transcript drops into the text box. */
  protected async recordFollow(): Promise<void> {
    if (!this.recorder.recording()) {
      try {
        await this.recorder.start();
      } catch {
        this.error.set('No mic — type it instead.');
      }
      return;
    }
    try {
      const { blob, mimeType } = await this.recorder.stop();
      const path = await this.dumps.uploadAudio(blob, mimeType);
      const dump = await this.dumps.create('urge', { audio_path: path, status: 'transcribing' });
      const text = await this.dumps.transcribe(dump.id, path);
      this.followText = this.followText ? `${this.followText} ${text}` : text;
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    }
  }

  protected async resolve(u: UrgeWithDumps, actedOn: boolean): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      const text = this.followText.trim();
      const dump = await this.dumps.create('urge', {
        transcript: text || undefined,
        status: 'done',
      });
      await this.urgesService.resolve(u.id, dump.id, actedOn, text || null);
      this.followingUp.set(null);
      this.followText = '';
      await this.refresh();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected back(): void {
    this.recorder.cancel();
    this.router.navigateByUrl('/');
  }
}
