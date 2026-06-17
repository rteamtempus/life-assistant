import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CheckInService } from './check-in.service';

interface Scale {
  key: 'mood' | 'energy' | 'activation';
  label: string;
  low: string;
  high: string;
}

/**
 * Quick check-in (handoff §4 check_ins, §9 bipolar early-warning). No journal,
 * just three gentle sliders for intra-day granularity. `activation` is the one
 * to watch for the climb signature — but we never frame it as alarming here.
 */
@Component({
  selector: 'app-check-in',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex min-h-screen flex-col py-10">
      <button type="button" (click)="back()" class="self-start text-sm text-ink-faint">
        ← home
      </button>

      @if (saved()) {
        <div class="flex flex-1 flex-col items-center justify-center text-center">
          <p class="text-2xl font-light text-ink">noted. thank you.</p>
        </div>
      } @else {
        <h1 class="mt-6 text-2xl font-light text-ink">a quick read</h1>
        <p class="mt-1 text-ink-soft">just a rough sense — no need to be precise.</p>

        <div class="mt-8 flex flex-col gap-8">
          @for (s of scales; track s.key) {
            <div>
              <div class="flex items-baseline justify-between">
                <span class="text-ink">{{ s.label }}</span>
                <span class="text-sm text-ink-faint">{{ value(s.key) }}</span>
              </div>
              <input
                type="range"
                min="-5"
                max="5"
                step="1"
                [ngModel]="value(s.key)"
                (ngModelChange)="set(s.key, $event)"
                class="mt-2 w-full accent-[var(--color-calm)]"
              />
              <div class="flex justify-between text-xs text-ink-faint">
                <span>{{ s.low }}</span>
                <span>{{ s.high }}</span>
              </div>
            </div>
          }

          <textarea
            [(ngModel)]="note"
            rows="2"
            placeholder="anything else? (optional)"
            class="rounded-2xl border border-mist bg-surface p-3 text-ink outline-none focus:border-calm"
          ></textarea>

          <button
            type="button"
            (click)="save()"
            [disabled]="busy()"
            class="rounded-2xl bg-calm px-4 py-3 font-medium text-white transition active:scale-[0.99] disabled:opacity-60"
          >
            {{ busy() ? 'saving…' : 'log it' }}
          </button>
        </div>
      }

      @if (error()) {
        <p class="mt-4 text-sm text-ink-soft">{{ error() }}</p>
      }
    </section>
  `,
})
export class CheckIn {
  private readonly checkIns = inject(CheckInService);
  private readonly router = inject(Router);

  protected readonly scales: Scale[] = [
    { key: 'mood', label: 'mood', low: 'low', high: 'bright' },
    { key: 'energy', label: 'energy', low: 'flat', high: 'charged' },
    { key: 'activation', label: 'activation', low: 'still', high: 'buzzing' },
  ];

  private readonly values = signal<Record<Scale['key'], number>>({
    mood: 0,
    energy: 0,
    activation: 0,
  });
  protected note = '';
  protected readonly busy = signal(false);
  protected readonly saved = signal(false);
  protected readonly error = signal<string | null>(null);

  protected value(key: Scale['key']): number {
    return this.values()[key];
  }

  protected set(key: Scale['key'], v: number): void {
    this.values.update((cur) => ({ ...cur, [key]: Number(v) }));
  }

  protected async save(): Promise<void> {
    this.error.set(null);
    this.busy.set(true);
    try {
      const v = this.values();
      await this.checkIns.save({
        mood: v.mood,
        energy: v.energy,
        activation: v.activation,
        note: this.note.trim() || null,
      });
      this.saved.set(true);
      setTimeout(() => this.router.navigateByUrl('/'), 1600);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected back(): void {
    this.router.navigateByUrl('/');
  }
}
