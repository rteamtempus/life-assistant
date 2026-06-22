import { Component, inject, OnInit, signal } from '@angular/core';
import { AnalysisService } from '../../core/analysis.service';
import { ExperimentsService } from '../../core/experiments.service';
import { Analysis } from '../../core/models';

/**
 * Analysis (Stage 5) — the payoff. Trigger a report over a range; read what
 * helped / hurt / patterns / recommendations; revisit past analyses.
 */
@Component({
  selector: 'app-analysis',
  template: `
    <section class="flex min-h-screen flex-col py-6">
      <h1 class="text-2xl font-light text-ink">analysis</h1>
      <p class="mt-1 text-ink-soft">a read on what's been helping and hurting.</p>

      @if (!viewing()) {
        <div class="mt-5 grid grid-cols-3 gap-2">
          @for (r of ranges; track r.label) {
            <button type="button" (click)="run(r.days)" [disabled]="busy()" class="rounded-2xl bg-calm px-3 py-3 text-sm font-medium text-white disabled:opacity-50">{{ r.label }}</button>
          }
        </div>

        @if (busy()) {
          <div class="mt-10 flex flex-col items-center gap-3 text-center">
            <div class="h-10 w-10 animate-spin rounded-full border-2 border-mist border-t-calm"></div>
            <p class="text-ink-soft">reading your {{ runningLabel() }}…</p>
          </div>
        }
        @if (error()) { <p class="mt-4 text-sm text-ink-soft">{{ error() }}</p> }

        @if (history().length) {
          <h2 class="mt-10 text-sm uppercase tracking-wide text-ink-faint">past analyses</h2>
          <ul class="mt-2 flex flex-col gap-2">
            @for (a of history(); track a.id) {
              <li>
                <button type="button" (click)="open(a)" class="w-full rounded-2xl bg-surface px-4 py-3 text-left ring-1 ring-mist active:scale-[0.99]">
                  <span class="text-ink">{{ rangeLabel(a) }}</span>
                  <span class="block truncate text-sm text-ink-faint">{{ a.summary }}</span>
                </button>
              </li>
            }
          </ul>
        }
      } @else {
        <!-- detail -->
        <button type="button" (click)="viewing.set(null)" class="mt-4 self-start text-sm text-ink-faint">‹ all analyses</button>
        <p class="mt-3 text-xs uppercase tracking-wide text-ink-faint">{{ rangeLabel(viewing()!) }}</p>

        @if (viewing()!.summary) { <p class="mt-2 leading-relaxed text-ink">{{ viewing()!.summary }}</p> }

        @if (viewing()!.experiment_progress.length) {
          <h2 class="mt-6 text-sm uppercase tracking-wide text-ink-faint">your experiments</h2>
          <ul class="mt-2 flex flex-col gap-2">
            @for (e of viewing()!.experiment_progress; track $index) {
              <li class="rounded-2xl bg-surface p-3 ring-1 ring-mist">
                <p class="text-ink">{{ e.experiment }}</p>
                @if (e.adherence) { <p class="text-sm text-ink-soft">how it's going: {{ e.adherence }}</p> }
                @if (e.effect) { <p class="text-sm text-ink-faint">effect: {{ e.effect }}</p> }
              </li>
            }
          </ul>
        }

        @if (viewing()!.helped.length) {
          <h2 class="mt-6 text-sm uppercase tracking-wide text-calm-deep">what helped</h2>
          <ul class="mt-2 flex flex-col gap-2">
            @for (h of viewing()!.helped; track $index) {
              <li class="rounded-2xl bg-surface p-3 ring-1 ring-mist">
                <p class="text-ink">{{ h.item }}</p>
                @if (h.why) { <p class="text-sm text-ink-soft">{{ h.why }}</p> }
                @if (h.evidence) { <p class="mt-1 text-xs text-ink-faint">{{ h.evidence }}</p> }
              </li>
            }
          </ul>
        }

        @if (viewing()!.hurt.length) {
          <h2 class="mt-6 text-sm uppercase tracking-wide text-warm">what weighed on you</h2>
          <ul class="mt-2 flex flex-col gap-2">
            @for (h of viewing()!.hurt; track $index) {
              <li class="rounded-2xl bg-surface p-3 ring-1 ring-mist">
                <p class="text-ink">{{ h.item }}</p>
                @if (h.why) { <p class="text-sm text-ink-soft">{{ h.why }}</p> }
                @if (h.evidence) { <p class="mt-1 text-xs text-ink-faint">{{ h.evidence }}</p> }
              </li>
            }
          </ul>
        }

        @if (viewing()!.patterns.length) {
          <h2 class="mt-6 text-sm uppercase tracking-wide text-ink-faint">patterns to notice</h2>
          <ul class="mt-2 flex flex-col gap-1.5">
            @for (p of viewing()!.patterns; track $index) { <li class="text-ink">· {{ p }}</li> }
          </ul>
        }

        @if (viewing()!.recommendations.length) {
          <h2 class="mt-6 text-sm uppercase tracking-wide text-calm-deep">worth trying</h2>
          <ul class="mt-2 flex flex-col gap-2">
            @for (r of viewing()!.recommendations; track $index) {
              <li class="rounded-2xl bg-surface p-3 ring-1 ring-mist">
                <p class="text-ink">{{ r.text }}</p>
                @if (r.rationale) { <p class="text-sm text-ink-soft">{{ r.rationale }}</p> }
                @if (added().has(r.text)) {
                  <p class="mt-2 text-sm text-calm">added to experiments ✓</p>
                } @else {
                  <button type="button" (click)="tryThis(r.text, r.rationale)" class="mt-2 rounded-full bg-calm px-3 py-1.5 text-sm font-medium text-white active:scale-95">try this</button>
                }
              </li>
            }
          </ul>
        }
      }
    </section>
  `,
})
export class AnalysisPage implements OnInit {
  private readonly service = inject(AnalysisService);
  private readonly experiments = inject(ExperimentsService);
  protected readonly added = signal<Set<string>>(new Set());

  protected readonly ranges = [
    { label: 'yesterday', days: 1 },
    { label: 'last 7 days', days: 7 },
    { label: 'last 30 days', days: 30 },
  ];

  protected readonly history = signal<Analysis[]>([]);
  protected readonly viewing = signal<Analysis | null>(null);
  protected readonly busy = signal(false);
  protected readonly runningLabel = signal('');
  protected readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.refresh();
  }

  private fmt(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  protected rangeLabel(a: Analysis): string {
    return a.period_start === a.period_end
      ? a.period_start
      : `${a.period_start} → ${a.period_end}`;
  }

  protected async run(days: number): Promise<void> {
    this.error.set(null);
    this.busy.set(true);
    this.runningLabel.set(days === 1 ? 'yesterday' : `last ${days} days`);
    try {
      const end = new Date();
      const start = new Date();
      if (days === 1) {
        // "yesterday" = the full prior day
        start.setDate(start.getDate() - 1);
        end.setDate(end.getDate() - 1);
      } else {
        start.setDate(start.getDate() - (days - 1));
      }
      const a = await this.service.run(this.fmt(start), this.fmt(end));
      this.viewing.set(a);
      await this.refresh();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.busy.set(false);
    }
  }

  private async refresh(): Promise<void> {
    try {
      this.history.set(await this.service.list());
    } catch {
      /* non-fatal */
    }
  }

  protected open(a: Analysis): void {
    this.viewing.set(a);
  }

  /** Turn a recommendation into a tracked experiment. */
  protected async tryThis(text: string, rationale?: string): Promise<void> {
    try {
      await this.experiments.create(text, rationale ?? null, this.viewing()?.id ?? null);
      this.added.update((s) => new Set(s).add(text));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    }
  }
}

