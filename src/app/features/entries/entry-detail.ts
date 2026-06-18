import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DumpsService } from '../../core/dumps.service';
import { Dump, DumpKind } from '../../core/models';
import { KIND_LABEL } from './entries';

/**
 * Entry detail: date + summary up top, full transcript in a drawer that's
 * closed by default. If there's no summary yet, a button generates one (and
 * then disappears).
 */
@Component({
  selector: 'app-entry-detail',
  template: `
    <section class="flex min-h-[calc(100dvh-5rem)] flex-col py-4">
      <button type="button" (click)="back()" class="self-start text-sm text-ink-faint">‹ entries</button>

      @if (loading()) {
        <p class="mt-8 text-ink-faint">…</p>
      } @else if (dump(); as d) {
        <p class="mt-4 text-xs uppercase tracking-wide text-ink-faint">{{ kindLabel(d.kind) }}</p>
        <h1 class="text-xl font-light text-ink">{{ when(d.created_at) }}</h1>

        @if (d.summary) {
          <h2 class="mt-5 text-sm uppercase tracking-wide text-ink-faint">summary</h2>
          <p class="mt-2 whitespace-pre-wrap leading-relaxed text-ink">{{ d.summary }}</p>
        } @else if (d.transcript) {
          <button type="button" (click)="generate(d)" [disabled]="busy()" class="mt-5 self-start rounded-2xl bg-calm px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
            {{ busy() ? 'summarizing…' : 'generate summary' }}
          </button>
        }

        @if (d.transcript) {
          <details class="mt-6 rounded-2xl bg-surface p-4 ring-1 ring-mist">
            <summary class="cursor-pointer text-sm text-ink-soft">full transcript</summary>
            <p class="mt-2 whitespace-pre-wrap leading-relaxed text-ink-soft">{{ d.transcript }}</p>
          </details>
        } @else {
          <p class="mt-6 text-ink-soft">No transcript on this entry.</p>
        }
      } @else {
        <p class="mt-8 text-ink-soft">Entry not found.</p>
      }
      @if (error()) { <p class="mt-4 text-sm text-ink-soft">{{ error() }}</p> }
    </section>
  `,
})
export class EntryDetail implements OnInit {
  private readonly dumps = inject(DumpsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly dump = signal<Dump | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      return;
    }
    try {
      this.dump.set(await this.dumps.get(id));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.loading.set(false);
    }
  }

  protected kindLabel(k: DumpKind): string {
    return KIND_LABEL[k];
  }

  protected when(iso: string): string {
    return new Date(iso).toLocaleString([], { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  protected async generate(d: Dump): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      const summary = await this.dumps.summarize(d.id);
      this.dump.set({ ...d, summary });
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected back(): void {
    this.router.navigateByUrl('/entries');
  }
}
