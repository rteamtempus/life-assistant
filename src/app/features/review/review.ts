import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EventsService } from '../../core/events.service';
import { CATEGORY_META, categoryMeta, LogEvent } from '../../core/models';
import { isoToLocalInput, localInputToIso } from '../../core/datetime';

interface Group {
  category: string;
  icon: string;
  label: string;
  events: LogEvent[];
}

/**
 * Review screen (Stage 4). Everything you've tracked, by day, grouped by
 * category, fully editable — the manual override layer for when the AI missed
 * something or you forgot to mention it.
 */
@Component({
  selector: 'app-review',
  imports: [FormsModule],
  template: `
    <section class="flex min-h-screen flex-col py-6">
      <!-- day nav -->
      <div class="flex items-center justify-between">
        <button type="button" (click)="shiftDay(-1)" class="rounded-lg px-3 py-2 text-ink-soft active:bg-mist">‹</button>
        <div class="text-center">
          <p class="text-lg font-light text-ink">{{ dayLabel() }}</p>
          @if (!isToday()) { <button type="button" (click)="today()" class="text-xs text-calm">jump to today</button> }
        </div>
        <button type="button" (click)="shiftDay(1)" [disabled]="isToday()" class="rounded-lg px-3 py-2 text-ink-soft active:bg-mist disabled:opacity-30">›</button>
      </div>

      @if (loading()) {
        <p class="mt-8 text-ink-faint">…</p>
      } @else if (groups().length === 0) {
        <p class="mt-8 text-ink-soft">nothing logged this day.</p>
      } @else {
        @for (g of groups(); track g.category) {
          <div class="mt-6">
            <h2 class="text-sm uppercase tracking-wide text-ink-faint">{{ g.icon }} {{ g.label }}</h2>
            <ul class="mt-2 flex flex-col gap-2">
              @for (e of g.events; track e.id) {
                <li class="rounded-2xl bg-surface px-3 py-2.5 ring-1 ring-mist">
                  @if (editingId() === e.id) {
                    <div class="flex flex-col gap-2">
                      <input [(ngModel)]="e.label" placeholder="label" class="bg-transparent text-ink outline-none" />
                      <div class="flex gap-2 text-sm">
                        <input [(ngModel)]="e.amount" type="number" placeholder="amt" class="w-16 bg-transparent outline-none" />
                        <input [(ngModel)]="e.unit" placeholder="unit" class="w-16 bg-transparent outline-none" />
                        <input [(ngModel)]="e.note" placeholder="note" class="min-w-0 flex-1 bg-transparent outline-none" />
                      </div>
                      <div class="flex items-center gap-2 text-sm text-ink-faint">
                        <span>🕒</span>
                        <input type="datetime-local" [ngModel]="localTime(e.occurred_at)" (ngModelChange)="e.occurred_at = fromLocalTime($event) ?? e.occurred_at" class="bg-transparent outline-none" />
                      </div>
                      <div class="flex gap-2">
                        <button type="button" (click)="saveEdit(e)" class="rounded-lg bg-calm px-3 py-1.5 text-sm text-white">save</button>
                        <button type="button" (click)="editingId.set(null)" class="rounded-lg px-3 py-1.5 text-sm text-ink-faint">cancel</button>
                        <button type="button" (click)="remove(e)" class="ml-auto rounded-lg px-3 py-1.5 text-sm text-ink-faint">delete</button>
                      </div>
                    </div>
                  } @else {
                    <button type="button" (click)="editingId.set(e.id)" class="flex w-full items-center justify-between text-left">
                      <span class="text-ink">
                        {{ e.label || g.label }}
                        @if (e.amount != null) { <span class="text-ink-soft">· {{ e.amount }}{{ e.unit ? ' ' + e.unit : '' }}</span> }
                        @if (e.note) { <span class="block text-sm text-ink-faint">{{ e.note }}</span> }
                      </span>
                      <span class="text-xs text-ink-faint">{{ time(e.occurred_at) }}@if (e.source === 'ai' && !e.confirmed) { · ai }</span>
                    </button>
                  }
                </li>
              }
            </ul>
          </div>
        }
      }

      <!-- manual add -->
      <details class="mt-8 rounded-2xl bg-surface p-4 ring-1 ring-mist">
        <summary class="cursor-pointer text-sm text-ink-soft">＋ add something</summary>
        <div class="mt-3 flex flex-col gap-2">
          <select [(ngModel)]="newCategory" class="rounded-xl border border-mist bg-canvas px-3 py-2 outline-none focus:border-calm">
            @for (c of categories; track c) { <option [value]="c">{{ meta(c).icon }} {{ c }}</option> }
          </select>
          <input [(ngModel)]="newLabel" placeholder="label (e.g. oatmeal)" class="rounded-xl border border-mist bg-canvas px-3 py-2 outline-none focus:border-calm" />
          <div class="flex gap-2">
            <input [(ngModel)]="newAmount" type="number" placeholder="amount" class="w-24 rounded-xl border border-mist bg-canvas px-3 py-2 outline-none focus:border-calm" />
            <input [(ngModel)]="newUnit" placeholder="unit" class="w-24 rounded-xl border border-mist bg-canvas px-3 py-2 outline-none focus:border-calm" />
          </div>
          <button type="button" (click)="add()" [disabled]="busy()" class="rounded-xl bg-calm px-4 py-2 font-medium text-white disabled:opacity-50">add</button>
        </div>
      </details>

      @if (error()) { <p class="mt-4 text-sm text-ink-soft">{{ error() }}</p> }
    </section>
  `,
})
export class Review implements OnInit {
  private readonly events = inject(EventsService);

  protected readonly categories = Object.keys(CATEGORY_META);
  protected readonly day = signal(this.startOfToday());
  protected readonly all = signal<LogEvent[]>([]);
  protected readonly loading = signal(true);
  protected readonly editingId = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected newCategory = 'food';
  protected newLabel = '';
  protected newAmount: number | null = null;
  protected newUnit = '';

  protected readonly groups = computed<Group[]>(() => {
    const byCat = new Map<string, LogEvent[]>();
    for (const e of this.all()) {
      const list = byCat.get(e.category) ?? [];
      list.push(e);
      byCat.set(e.category, list);
    }
    return [...byCat.entries()].map(([category, events]) => ({
      category,
      icon: categoryMeta(category).icon,
      label: categoryMeta(category).label,
      events,
    }));
  });

  async ngOnInit(): Promise<void> {
    await this.refresh();
  }

  private startOfToday(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  protected meta(c: string) {
    return categoryMeta(c);
  }

  protected localTime(iso: string): string {
    return isoToLocalInput(iso);
  }

  protected fromLocalTime(value: string): string | null {
    return localInputToIso(value);
  }

  protected isToday(): boolean {
    return this.day().getTime() === this.startOfToday().getTime();
  }

  protected dayLabel(): string {
    return this.day().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  }

  protected time(iso: string): string {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  protected async shiftDay(delta: number): Promise<void> {
    const d = new Date(this.day());
    d.setDate(d.getDate() + delta);
    if (d.getTime() > this.startOfToday().getTime()) return;
    this.day.set(d);
    this.editingId.set(null);
    await this.refresh();
  }

  protected async today(): Promise<void> {
    this.day.set(this.startOfToday());
    await this.refresh();
  }

  private async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.all.set(await this.events.listForDay(this.day().toISOString()));
    } catch (e) {
      this.error.set(this.msg(e));
    } finally {
      this.loading.set(false);
    }
  }

  protected async saveEdit(e: LogEvent): Promise<void> {
    try {
      await this.events.update(e.id, {
        label: e.label,
        amount: e.amount == null ? null : Number(e.amount),
        unit: e.unit,
        note: e.note,
        occurred_at: e.occurred_at,
      });
      this.editingId.set(null);
      await this.refresh();
    } catch (err) {
      this.error.set(this.msg(err));
    }
  }

  protected async remove(e: LogEvent): Promise<void> {
    try {
      await this.events.remove(e.id);
      this.editingId.set(null);
      await this.refresh();
    } catch (err) {
      this.error.set(this.msg(err));
    }
  }

  protected async add(): Promise<void> {
    if (!this.newLabel.trim() && !this.newCategory) return;
    this.busy.set(true);
    try {
      // Stamp the event at noon of the viewed day (or now if it's today).
      const when = this.isToday() ? new Date() : new Date(this.day());
      if (!this.isToday()) when.setHours(12, 0, 0, 0);
      await this.events.add({
        category: this.newCategory,
        label: this.newLabel.trim() || null,
        amount: this.newAmount == null ? null : Number(this.newAmount),
        unit: this.newUnit.trim() || null,
        occurred_at: when.toISOString(),
      });
      this.newLabel = '';
      this.newAmount = null;
      this.newUnit = '';
      await this.refresh();
    } catch (e) {
      this.error.set(this.msg(e));
    } finally {
      this.busy.set(false);
    }
  }

  private msg(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
  }
}
