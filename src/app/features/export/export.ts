import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { ExportService } from './export.service';

/**
 * Therapist export screen (handoff §5). Pick a range, preview the Markdown,
 * copy or download it. The owner decides what leaves the app — nothing is sent
 * anywhere automatically.
 */
@Component({
  selector: 'app-export',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex min-h-screen flex-col py-10">
      <button type="button" (click)="back()" class="self-start text-sm text-ink-faint">
        ← home
      </button>

      <h1 class="mt-6 text-2xl font-light text-ink">notes for therapy</h1>
      <p class="mt-1 text-ink-soft">a clean summary to bring to a session. yours to share or not.</p>

      <div class="mt-5 flex gap-2">
        @for (r of ranges; track r.days) {
          <button
            type="button"
            (click)="select(r.days)"
            [class.bg-calm]="days() === r.days"
            [class.text-white]="days() === r.days"
            class="rounded-full bg-surface px-4 py-2 text-sm ring-1 ring-mist"
          >
            {{ r.label }}
          </button>
        }
      </div>

      @if (loading()) {
        <p class="mt-6 text-ink-faint">gathering…</p>
      } @else if (markdown()) {
        <pre class="mt-6 flex-1 overflow-auto whitespace-pre-wrap rounded-2xl bg-surface p-4 text-sm text-ink ring-1 ring-mist">{{ markdown() }}</pre>
        <div class="mt-4 flex gap-2 pb-2">
          <button type="button" (click)="copy()" class="flex-1 rounded-2xl bg-calm px-4 py-3 font-medium text-white">
            {{ copied() ? 'copied ✓' : 'copy' }}
          </button>
          <button type="button" (click)="download()" class="flex-1 rounded-2xl bg-surface px-4 py-3 font-medium text-ink ring-1 ring-mist">
            download
          </button>
        </div>
      }

      @if (error()) {
        <p class="mt-4 text-sm text-ink-soft">{{ error() }}</p>
      }
    </section>
  `,
})
export class Export {
  private readonly exportService = inject(ExportService);
  private readonly router = inject(Router);

  protected readonly ranges = [
    { days: 7, label: 'last week' },
    { days: 30, label: 'last month' },
    { days: 90, label: 'last 3 months' },
  ];

  protected readonly days = signal(7);
  protected readonly markdown = signal('');
  protected readonly loading = signal(true);
  protected readonly copied = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    void this.load();
  }

  protected async select(days: number): Promise<void> {
    this.days.set(days);
    await this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.markdown.set(await this.exportService.buildMarkdown(this.days()));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.loading.set(false);
    }
  }

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.markdown());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1800);
    } catch {
      this.error.set('Copy failed — you can select the text manually.');
    }
  }

  protected download(): void {
    const blob = new Blob([this.markdown()], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `therapy-notes-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  protected back(): void {
    this.router.navigateByUrl('/');
  }
}
