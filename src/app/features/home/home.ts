import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { dayContext } from '../../core/time-of-day';
import { rotatingPrompt } from '../../core/prompts';

/**
 * Time-aware home (handoff §9). Surfaces ONE primary thing for the moment —
 * the capture button with a warm, contextual prompt — and keeps everything
 * else quiet beneath it (§1.3 anti-optimization ceiling). No metrics, no
 * dashboard, no streaks.
 */
@Component({
  selector: 'app-home',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex min-h-screen flex-col py-12">
      <header>
        <p class="text-ink-faint">{{ ctx().greeting }}.</p>
      </header>

      <!-- The one thing: a low-friction way to speak. -->
      <a
        routerLink="/capture"
        class="mt-10 flex flex-1 flex-col items-center justify-center gap-8 text-center"
      >
        <span
          class="flex h-40 w-40 items-center justify-center rounded-full bg-calm text-white shadow-lg shadow-calm/20 transition active:scale-95"
          aria-hidden="true"
        >
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </svg>
        </span>
        <span class="max-w-xs text-xl font-light leading-relaxed text-ink">
          {{ prompt() }}
        </span>
      </a>

      <!-- Always reachable, never alarming (§8). Calm, not a red panic button. -->
      <a
        routerLink="/urge"
        class="mt-8 block rounded-2xl bg-calm-deep px-4 py-3 text-center font-medium text-white transition active:scale-[0.99]"
      >
        I'm having an urge
      </a>

      <!-- Quiet, secondary surfaces. Deliberately small. -->
      <nav class="mt-4 flex flex-wrap justify-center gap-3 pb-4 text-sm">
        <a
          routerLink="/surface"
          class="rounded-full bg-surface px-4 py-2 text-ink-soft ring-1 ring-mist transition active:scale-95"
          >what helps</a
        >
        <a
          routerLink="/check-in"
          class="rounded-full bg-surface px-4 py-2 text-ink-soft ring-1 ring-mist transition active:scale-95"
          >quick check-in</a
        >
        <a
          routerLink="/tools"
          class="rounded-full bg-surface px-4 py-2 text-ink-soft ring-1 ring-mist transition active:scale-95"
          >tools</a
        >
        <a
          routerLink="/memos"
          class="rounded-full bg-surface px-4 py-2 text-ink-soft ring-1 ring-mist transition active:scale-95"
          >memos</a
        >
        <a
          routerLink="/export"
          class="rounded-full bg-surface px-4 py-2 text-ink-soft ring-1 ring-mist transition active:scale-95"
          >therapy notes</a
        >
      </nav>
    </section>
  `,
})
export class Home {
  // Stable per-load so the prompt doesn't flicker on change detection.
  private readonly now = signal(new Date());
  protected readonly ctx = computed(() => dayContext(this.now()));
  protected readonly prompt = computed(() => {
    const d = this.now();
    const seed = d.getHours() * 60 + d.getMinutes();
    return rotatingPrompt(this.ctx().part, seed);
  });
}
