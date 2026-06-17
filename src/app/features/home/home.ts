import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { dayContext } from '../../core/time-of-day';

/**
 * Home (v2). Time-aware greeting, one primary action — brain-dump — and quiet
 * entry points to the specific capture surfaces. One thing forward at a time
 * (anti-optimization ceiling); analysis + review live behind their own routes.
 */
@Component({
  selector: 'app-home',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex min-h-screen flex-col py-12">
      <header><p class="text-ink-faint">{{ ctx().greeting }}.</p></header>

      <!-- The one thing: just talk. AI sorts it after. -->
      <a routerLink="/dump/adhoc" class="mt-10 flex flex-1 flex-col items-center justify-center gap-8 text-center">
        <span class="flex h-40 w-40 items-center justify-center rounded-full bg-calm text-white shadow-lg shadow-calm/20 transition active:scale-95" aria-hidden="true">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" />
          </svg>
        </span>
        <span class="max-w-xs text-xl font-light leading-relaxed text-ink">brain-dump — I'll sort it out</span>
      </a>

      <!-- Specific surfaces. -->
      <nav class="mt-10 grid grid-cols-2 gap-3">
        <a routerLink="/dump/checkin" class="rounded-2xl bg-surface px-4 py-3 text-center text-ink-soft ring-1 ring-mist transition active:scale-[0.98]">check-in</a>
        <a routerLink="/dump/journal" class="rounded-2xl bg-surface px-4 py-3 text-center text-ink-soft ring-1 ring-mist transition active:scale-[0.98]">{{ journalLabel() }}</a>
      </nav>

      <a routerLink="/dump/urge" class="mt-3 block rounded-2xl bg-calm-deep px-4 py-3 text-center font-medium text-white transition active:scale-[0.99]">
        I'm having an urge
      </a>
      <a routerLink="/urges" class="mt-3 text-center text-sm text-ink-faint">past urges</a>
    </section>
  `,
})
export class Home {
  private readonly now = signal(new Date());
  protected readonly ctx = computed(() => dayContext(this.now()));
  protected readonly journalLabel = computed(() =>
    this.now().getHours() < 14 ? 'morning journal' : 'evening journal',
  );
}
