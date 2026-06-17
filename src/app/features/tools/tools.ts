import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ToolsService } from './tools.service';
import { Tool, ToolCategory } from '../../core/models';

const CATEGORY_LABELS: Record<ToolCategory, string> = {
  morning: 'morning',
  nightly: 'wind-down',
  regulation: 'regulation',
  dopamine: 'dopamine',
};

const CATEGORY_ORDER: ToolCategory[] = [
  'morning',
  'regulation',
  'dopamine',
  'nightly',
];

/**
 * Tool deck (handoff §10 Phase 1). A catalog of regulation tools the owner
 * can tap to log a use. The amber "is_energizing" flag marks the climb-risk
 * tools (§1.3) so they read differently. Logging is one tap — a win, never a
 * chore.
 */
@Component({
  selector: 'app-tools',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex min-h-screen flex-col py-10">
      <button type="button" (click)="back()" class="self-start text-sm text-ink-faint">
        ← home
      </button>

      <h1 class="mt-6 text-2xl font-light text-ink">your tools</h1>

      @if (loading()) {
        <p class="mt-8 text-ink-faint">…</p>
      } @else if (groups().length === 0) {
        <p class="mt-8 text-ink-soft">
          No tools yet. Add the things that actually help you — a walk, NSDR, a
          glass of water, a specific song.
        </p>
      } @else {
        @for (group of groups(); track group.category) {
          <div class="mt-8">
            <h2 class="text-sm uppercase tracking-wide text-ink-faint">
              {{ label(group.category) }}
            </h2>
            <ul class="mt-3 flex flex-col gap-2">
              @for (tool of group.tools; track tool.id) {
                <li>
                  <button
                    type="button"
                    (click)="use(tool)"
                    class="flex w-full items-center justify-between rounded-2xl bg-surface px-4 py-3 text-left ring-1 ring-mist transition active:scale-[0.99]"
                    [class.ring-warm]="tool.is_energizing"
                  >
                    <span>
                      <span class="text-ink">{{ tool.name }}</span>
                      @if (tool.description) {
                        <span class="block text-sm text-ink-faint">{{ tool.description }}</span>
                      }
                    </span>
                    @if (justUsed() === tool.id) {
                      <span class="text-sm text-calm">logged ✓</span>
                    } @else {
                      <span class="text-ink-faint" aria-hidden="true">＋</span>
                    }
                  </button>
                </li>
              }
            </ul>
          </div>
        }
      }

      <!-- Add a tool. Kept quiet at the bottom. -->
      <details class="mt-10 rounded-2xl bg-surface p-4 ring-1 ring-mist">
        <summary class="cursor-pointer text-sm text-ink-soft">add a tool</summary>
        <div class="mt-3 flex flex-col gap-3">
          <input
            [(ngModel)]="newName"
            placeholder="name (e.g. 10-min walk)"
            class="rounded-xl border border-mist bg-canvas px-3 py-2 outline-none focus:border-calm"
          />
          <select
            [(ngModel)]="newCategory"
            class="rounded-xl border border-mist bg-canvas px-3 py-2 outline-none focus:border-calm"
          >
            @for (c of categoryOptions; track c) {
              <option [value]="c">{{ label(c) }}</option>
            }
          </select>
          <label class="flex items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" [(ngModel)]="newEnergizing" />
            energizing (climb-risk)
          </label>
          <button
            type="button"
            (click)="add()"
            [disabled]="!newName.trim()"
            class="rounded-xl bg-calm px-4 py-2 font-medium text-white disabled:opacity-50"
          >
            add
          </button>
        </div>
      </details>

      @if (error()) {
        <p class="mt-4 text-sm text-ink-soft">{{ error() }}</p>
      }
    </section>
  `,
})
export class Tools implements OnInit {
  private readonly tools = inject(ToolsService);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly all = signal<Tool[]>([]);
  protected readonly justUsed = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected newName = '';
  protected newCategory: ToolCategory = 'regulation';
  protected newEnergizing = false;
  protected readonly categoryOptions = CATEGORY_ORDER;

  protected readonly groups = computed(() => {
    const byCat = new Map<ToolCategory, Tool[]>();
    for (const t of this.all()) {
      const list = byCat.get(t.category) ?? [];
      list.push(t);
      byCat.set(t.category, list);
    }
    return CATEGORY_ORDER.filter((c) => byCat.has(c)).map((category) => ({
      category,
      tools: byCat.get(category)!,
    }));
  });

  async ngOnInit(): Promise<void> {
    await this.refresh();
  }

  protected label(c: ToolCategory): string {
    return CATEGORY_LABELS[c];
  }

  private async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      this.all.set(await this.tools.list());
    } catch (e) {
      this.error.set(this.describe(e));
    } finally {
      this.loading.set(false);
    }
  }

  protected async use(tool: Tool): Promise<void> {
    try {
      await this.tools.logUse(tool.id);
      this.justUsed.set(tool.id);
      setTimeout(() => this.justUsed.set(null), 1800);
    } catch (e) {
      this.error.set(this.describe(e));
    }
  }

  protected async add(): Promise<void> {
    try {
      await this.tools.add(
        this.newName.trim(),
        this.newCategory,
        this.newEnergizing,
      );
      this.newName = '';
      this.newEnergizing = false;
      await this.refresh();
    } catch (e) {
      this.error.set(this.describe(e));
    }
  }

  protected back(): void {
    this.router.navigateByUrl('/');
  }

  private describe(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
  }
}
