import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ProfileService } from '../profile.service';

@Component({
  selector: 'app-tarot-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex min-h-[70vh] flex-col py-12">
      <h1 class="text-3xl font-light text-ink">Tarot</h1>
      <p class="mt-2 text-ink-soft">{{ greeting() }}</p>

      <div class="mt-10 rounded-2xl bg-surface p-6 ring-1 ring-mist">
        <h2 class="text-xl text-ink">Foundation ready</h2>
        <p class="mt-2 text-sm leading-relaxed text-ink-soft">
          The reading view, spreads, and AI synthesis come next. The 78-card
          deck, interpretations, and built-in spreads are seeded in the database.
        </p>
      </div>
    </section>
  `,
})
export class TarotHome {
  // Ensures the tarot_profiles row exists for the signed-in user (lazy upsert).
  private readonly profileSvc = inject(ProfileService);

  protected readonly greeting = computed(() => {
    const name = this.profileSvc.profile()?.display_name;
    return name ? `welcome back, ${name}.` : 'a quiet mirror for reflection.';
  });
}
