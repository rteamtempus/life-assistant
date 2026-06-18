import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DumpsService } from '../../core/dumps.service';
import { Dump, DumpKind } from '../../core/models';

export const KIND_LABEL: Record<DumpKind, string> = {
  checkin: 'check-in',
  journal_morning: 'morning journal',
  journal_evening: 'evening journal',
  urge: 'urge',
  adhoc: 'note',
};

/** All your entries (dumps), newest first. Tap one for its detail page. */
@Component({
  selector: 'app-entries',
  imports: [RouterLink],
  template: `
    <section class="flex min-h-[calc(100dvh-5rem)] flex-col py-4">
      <h1 class="text-2xl font-light text-ink">your entries</h1>
      <p class="mt-1 text-ink-soft">journals, check-ins and notes.</p>

      @if (loading()) {
        <p class="mt-8 text-ink-faint">…</p>
      } @else if (dumps().length === 0) {
        <p class="mt-8 text-ink-soft">nothing captured yet.</p>
      } @else {
        <ul class="mt-6 flex flex-col gap-2">
          @for (d of dumps(); track d.id) {
            <li>
              <a [routerLink]="['/entries', d.id]" class="block rounded-2xl bg-surface px-4 py-3 ring-1 ring-mist transition active:scale-[0.99]">
                <div class="flex items-baseline justify-between">
                  <span class="text-ink">{{ kindLabel(d.kind) }}</span>
                  <span class="text-xs text-ink-faint">{{ when(d.created_at) }}</span>
                </div>
                <p class="mt-1 line-clamp-2 text-sm text-ink-soft">{{ d.summary || d.transcript || '—' }}</p>
              </a>
            </li>
          }
        </ul>
      }
      @if (error()) { <p class="mt-4 text-sm text-ink-soft">{{ error() }}</p> }
    </section>
  `,
})
export class Entries implements OnInit {
  private readonly dumps_ = inject(DumpsService);

  protected readonly dumps = signal<Dump[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      this.dumps.set(await this.dumps_.list());
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
    return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
}
