import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-work-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex min-h-[70vh] flex-col items-center justify-center py-12 text-center">
      <h1 class="text-3xl font-light text-ink">Work Assistant</h1>
      <p class="mt-3 text-ink-soft">coming soon.</p>
    </section>
  `,
})
export class WorkHome {}
