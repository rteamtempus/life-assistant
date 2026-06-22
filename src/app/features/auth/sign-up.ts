import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../core/supabase.service';

@Component({
  selector: 'app-sign-up',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex min-h-screen flex-col justify-center py-16">
      <h1 class="text-3xl font-light text-ink">make it yours</h1>
      <p class="mt-2 text-ink-soft">
        invite-only — you'll need the code from whoever sent you here.
      </p>

      @if (!supabase.isConfigured) {
        <p class="mt-6 rounded-2xl bg-mist p-4 text-sm text-ink-soft">
          Supabase isn't configured yet. Add your project URL and anon key to
          <code>src/environments/environment.development.ts</code>, then reload.
        </p>
      }

      <form class="mt-8 flex flex-col gap-4" (ngSubmit)="submit()">
        <input
          name="code"
          type="text"
          autocomplete="off"
          placeholder="invite code"
          [(ngModel)]="code"
          class="rounded-2xl border border-mist bg-surface px-4 py-3 text-ink outline-none focus:border-calm"
        />
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
          autocomplete="new-password"
          placeholder="password (at least 6 characters)"
          [(ngModel)]="password"
          class="rounded-2xl border border-mist bg-surface px-4 py-3 text-ink outline-none focus:border-calm"
        />
        <button
          type="submit"
          [disabled]="busy()"
          class="rounded-2xl bg-calm px-4 py-3 font-medium text-white transition active:scale-[0.99] disabled:opacity-60"
        >
          {{ busy() ? 'one moment…' : 'create account' }}
        </button>
      </form>

      @if (error()) {
        <p class="mt-4 text-sm text-ink-soft">{{ error() }}</p>
      }

      <p class="mt-6 text-sm text-ink-soft">
        already have an account?
        <a routerLink="/sign-in" class="text-calm underline">sign in</a>
      </p>
    </section>
  `,
})
export class SignUp {
  protected readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);

  protected code = '';
  protected email = '';
  protected password = '';
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async submit(): Promise<void> {
    this.error.set(null);
    this.busy.set(true);
    try {
      const email = this.email.trim();
      // 1. Create the account through the invite-gated Edge Function.
      const { data, error } = await this.supabase.signUpWithInvite(
        email,
        this.password,
        this.code.trim(),
      );
      // Edge Function errors (bad code, duplicate email) come back in the body.
      const bodyError = (data as { error?: string } | null)?.error;
      if (error || bodyError) {
        this.error.set(bodyError ?? error?.message ?? 'Could not create the account.');
        return;
      }
      // 2. The account is confirmed and ready — sign in and go.
      const { error: signInError } = await this.supabase.signInWithPassword(
        email,
        this.password,
      );
      if (signInError) {
        this.error.set(signInError.message);
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
