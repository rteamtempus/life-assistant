import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../core/supabase.service';

@Component({
  selector: 'app-sign-in',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex min-h-screen flex-col justify-center py-16">
      <h1 class="text-3xl font-light text-ink">welcome back</h1>
      <p class="mt-2 text-ink-soft">this is just for you, and it's private.</p>

      @if (!supabase.isConfigured) {
        <p class="mt-6 rounded-2xl bg-mist p-4 text-sm text-ink-soft">
          Supabase isn't configured yet. Add your project URL and anon key to
          <code>src/environments/environment.development.ts</code>, then reload.
        </p>
      }

      <form class="mt-8 flex flex-col gap-4" (ngSubmit)="submit()">
        <input
          name="email"
          type="email"
          autocomplete="email"
          placeholder="email"
          [(ngModel)]="email"
          class="rounded-2xl border border-mist bg-surface px-4 py-3 text-ink outline-none focus:border-calm"
        />
        <input
          name="password"
          type="password"
          autocomplete="current-password"
          placeholder="password"
          [(ngModel)]="password"
          class="rounded-2xl border border-mist bg-surface px-4 py-3 text-ink outline-none focus:border-calm"
        />
        <button
          type="submit"
          [disabled]="busy()"
          class="rounded-2xl bg-calm px-4 py-3 font-medium text-white transition active:scale-[0.99] disabled:opacity-60"
        >
          {{ busy() ? 'one moment…' : 'come in' }}
        </button>
      </form>

      @if (error()) {
        <p class="mt-4 text-sm text-ink-soft">{{ error() }}</p>
      }

      <p class="mt-6 text-sm text-ink-soft">
        new here?
        <a routerLink="/sign-up" class="text-calm underline">create an account</a>
      </p>
    </section>
  `,
})
export class SignIn {
  protected readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);

  protected email = '';
  protected password = '';
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async submit(): Promise<void> {
    this.error.set(null);
    this.busy.set(true);
    try {
      const { error } = await this.supabase.signInWithPassword(
        this.email.trim(),
        this.password,
      );
      if (error) {
        this.error.set(error.message);
        return;
      }
      await this.router.navigateByUrl('/');
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      this.busy.set(false);
    }
  }
}
