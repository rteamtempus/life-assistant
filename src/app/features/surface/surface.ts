import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SurfaceService, RankedTool, SurfaceResult } from './surface.service';
import { ToolsService } from '../tools/tools.service';

/**
 * "I feel ___ → here's what's worked" (handoff §9). State in, a personalized,
 * ranked tool menu out — plus, when the AI pipeline is live, a quiet note of
 * what helped during similar past moments. One thing at a time (§1.3): no
 * metrics, just the next helpful move.
 */
@Component({
  selector: 'app-surface',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex min-h-screen flex-col py-10">
      <button type="button" (click)="back()" class="self-start text-sm text-ink-faint">
        ← home
      </button>

      @if (!submitted()) {
        <div class="mt-10 flex flex-1 flex-col">
          <h1 class="text-2xl font-light text-ink">how are you feeling?</h1>
          <p class="mt-1 text-ink-soft">a word or two is plenty.</p>

          <div class="mt-5 flex flex-wrap gap-2">
            @for (chip of chips; track chip) {
              <button
                type="button"
                (click)="pick(chip)"
                class="rounded-full bg-surface px-4 py-2 text-sm text-ink-soft ring-1 ring-mist transition active:scale-95"
              >
                {{ chip }}
              </button>
            }
          </div>

          <input
            [(ngModel)]="feeling"
            (keyup.enter)="go()"
            placeholder="…or say it your own way"
            class="mt-4 rounded-2xl border border-mist bg-surface px-4 py-3 text-ink outline-none focus:border-calm"
          />
          <button
            type="button"
            (click)="go()"
            [disabled]="!feeling.trim() || busy()"
            class="mt-4 rounded-2xl bg-calm px-4 py-3 font-medium text-white disabled:opacity-50"
          >
            {{ busy() ? 'one moment…' : 'show me' }}
          </button>
        </div>
      } @else {
        <div class="mt-8 flex-1">
          <p class="text-ink-faint">when you've felt <span class="text-ink-soft">{{ feeling }}</span></p>

          @if (result().what_helped.length) {
            <h2 class="mt-6 text-sm uppercase tracking-wide text-ink-faint">what helped before</h2>
            <ul class="mt-2 flex flex-col gap-1.5">
              @for (h of result().what_helped; track h) {
                <li class="text-ink">· {{ h }}</li>
              }
            </ul>
          }

          <h2 class="mt-8 text-sm uppercase tracking-wide text-ink-faint">tools that work for you</h2>
          @if (tools().length) {
            <ul class="mt-2 flex flex-col gap-2">
              @for (t of tools(); track t.id) {
                <li>
                  <button
                    type="button"
                    (click)="useTool(t)"
                    class="flex w-full items-center justify-between rounded-2xl bg-surface px-4 py-3 text-left ring-1 ring-mist transition active:scale-[0.99]"
                    [class.ring-warm]="t.is_energizing"
                  >
                    <span class="text-ink">{{ t.name }}</span>
                    @if (justUsed() === t.id) {
                      <span class="text-sm text-calm">logged ✓</span>
                    } @else if (t.uses > 0) {
                      <span class="text-xs text-ink-faint">{{ t.uses }}×</span>
                    }
                  </button>
                </li>
              }
            </ul>
          } @else {
            <p class="mt-2 text-ink-soft">
              No tools yet — add a few on the tools screen and they'll start
              showing up here, ranked by what you reach for.
            </p>
          }
        </div>
      }

      @if (error()) {
        <p class="pb-4 text-sm text-ink-soft">{{ error() }}</p>
      }
    </section>
  `,
})
export class Surface {
  private readonly surface = inject(SurfaceService);
  private readonly toolsService = inject(ToolsService);
  private readonly router = inject(Router);

  protected readonly chips = [
    'anxious',
    'flat / low',
    'wired',
    'restless',
    'crashing',
    'foggy',
  ];

  protected feeling = '';
  protected readonly busy = signal(false);
  protected readonly submitted = signal(false);
  protected readonly tools = signal<RankedTool[]>([]);
  protected readonly result = signal<SurfaceResult>({ what_helped: [], moments: [] });
  protected readonly justUsed = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected pick(chip: string): void {
    this.feeling = chip;
    this.go();
  }

  protected async go(): Promise<void> {
    if (!this.feeling.trim()) return;
    this.error.set(null);
    this.busy.set(true);
    try {
      // Tools always; semantic recall best-effort (returns empty if not live).
      const [tools, result] = await Promise.all([
        this.surface.rankedTools(),
        this.surface.whatHelped(this.feeling.trim()),
      ]);
      this.tools.set(tools);
      this.result.set(result);
      this.submitted.set(true);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async useTool(t: RankedTool): Promise<void> {
    try {
      await this.toolsService.logUse(t.id);
      this.justUsed.set(t.id);
      setTimeout(() => this.justUsed.set(null), 1800);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    }
  }

  protected back(): void {
    this.router.navigateByUrl('/');
  }
}
