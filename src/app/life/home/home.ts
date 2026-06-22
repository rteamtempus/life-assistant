import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Home (v2). One primary action — brain-dump — and quiet entry points to the
 * specific capture surfaces. Sized to fit the viewport (minus the app header)
 * so nothing falls below the fold.
 */
@Component({
  selector: 'app-home',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex min-h-[calc(100dvh-5rem)] flex-col pb-6">
      <!-- The one thing: just talk. AI sorts it after. -->
      <a routerLink="/life/dump/adhoc" class="flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <span class="flex h-28 w-28 items-center justify-center rounded-full bg-calm text-white shadow-lg shadow-calm/20 transition active:scale-95" aria-hidden="true">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" />
          </svg>
        </span>
        <span class="max-w-xs text-lg font-light leading-relaxed text-ink">brain-dump — I'll sort it out</span>
      </a>

      <!-- Specific surfaces. -->
      <nav class="grid grid-cols-2 gap-3">
        <a routerLink="/life/dump/checkin" class="rounded-2xl bg-surface px-4 py-3 text-center text-ink-soft ring-1 ring-mist transition active:scale-[0.98]">check-in</a>
        <a routerLink="/life/dump/journal" class="rounded-2xl bg-surface px-4 py-3 text-center text-ink-soft ring-1 ring-mist transition active:scale-[0.98]">{{ journalLabel() }}</a>
      </nav>

      <a routerLink="/life/dump/urge" class="mt-3 block rounded-2xl bg-calm-deep px-4 py-3 text-center font-medium text-white transition active:scale-[0.99]">
        I'm having an urge
      </a>
      <a routerLink="/life/urges" class="mt-2 text-center text-sm text-ink-faint">past urges</a>
    </section>
  `,
})
export class Home {
  private readonly now = signal(new Date());
  protected readonly journalLabel = computed(() =>
    this.now().getHours() < 14 ? 'morning journal' : 'evening journal',
  );
}
