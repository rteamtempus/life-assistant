import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ExperimentsService } from '../../core/experiments.service';
import { Experiment } from '../../core/models';

/**
 * Experiments (Stage 6) — the insight->experiment->progress loop. Things you
 * decided to try (usually from an analysis recommendation). Each new analysis
 * reports how the active ones are going. Presence, not pressure.
 */
@Component({
  selector: 'app-experiments',
  template: `
    <section class="flex min-h-[calc(100dvh-4rem)] flex-col py-4">
      <h1 class="text-2xl font-light text-ink">experiments</h1>
      <p class="mt-1 text-ink-soft">small things you're trying. analysis tracks how they go.</p>

      @if (loading()) {
        <p class="mt-8 text-ink-faint">…</p>
      } @else {
        @if (active().length) {
          <h2 class="mt-6 text-sm uppercase tracking-wide text-calm-deep">active</h2>
          <ul class="mt-2 flex flex-col gap-2">
            @for (e of active(); track e.id) {
              <li class="rounded-2xl bg-surface p-3 ring-1 ring-mist">
                <p class="text-ink">{{ e.text }}</p>
                @if (e.rationale) { <p class="text-sm text-ink-soft">{{ e.rationale }}</p> }
                <p class="mt-1 text-xs text-ink-faint">since {{ e.started_on }}</p>
                <div class="mt-2 flex gap-2">
                  <button type="button" (click)="set(e, 'done')" class="rounded-full bg-calm px-3 py-1.5 text-sm font-medium text-white active:scale-95">mark done</button>
                  <button type="button" (click)="set(e, 'dropped')" class="rounded-full px-3 py-1.5 text-sm text-ink-faint active:scale-95">drop</button>
                </div>
              </li>
            }
          </ul>
        } @else {
          <p class="mt-6 text-ink-soft">
            No active experiments. Run an <span class="text-ink">analysis</span> and tap "try this" on a
            recommendation to start one.
          </p>
        }

        @if (past().length) {
          <h2 class="mt-8 text-sm uppercase tracking-wide text-ink-faint">past</h2>
          <ul class="mt-2 flex flex-col gap-2">
            @for (e of past(); track e.id) {
              <li class="rounded-2xl bg-surface p-3 text-ink-soft ring-1 ring-mist">
                <p>{{ e.text }}</p>
                <p class="mt-1 text-xs text-ink-faint">{{ e.status }}@if (e.ended_on) { · {{ e.ended_on }} }</p>
              </li>
            }
          </ul>
        }
      }
      @if (error()) { <p class="mt-4 text-sm text-ink-soft">{{ error() }}</p> }
    </section>
  `,
})
export class Experiments implements OnInit {
  private readonly service = inject(ExperimentsService);

  protected readonly all = signal<Experiment[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly active = computed(() => this.all().filter((e) => e.status === 'active'));
  protected readonly past = computed(() => this.all().filter((e) => e.status !== 'active'));

  async ngOnInit(): Promise<void> {
    await this.refresh();
  }

  private async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      this.all.set(await this.service.list());
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.loading.set(false);
    }
  }

  protected async set(e: Experiment, status: Experiment['status']): Promise<void> {
    try {
      await this.service.setStatus(e.id, status);
      await this.refresh();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    }
  }
}
