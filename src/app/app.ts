import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { PwaUpdateService } from './core/pwa-update.service';
import { SupabaseService } from './core/supabase.service';
import { CurrentAppService } from './core/current-app.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly pwa = inject(PwaUpdateService);
  protected readonly supabase = inject(SupabaseService);
  protected readonly appNav = inject(CurrentAppService);
  private readonly router = inject(Router);

  /** The active mini-app — drives the title, menu, and theme. */
  protected readonly current = this.appNav.current;
  protected readonly menuOpen = signal(false);

  constructor() {
    this.pwa.init();
  }

  /** Top-left icon/title: cycle to the next mini-app and go to its Home. */
  protected cycleApp(): void {
    this.close();
    this.appNav.cycle();
  }

  protected toggle(): void {
    this.menuOpen.update((v) => !v);
  }

  protected close(): void {
    this.menuOpen.set(false);
  }

  protected async signOut(): Promise<void> {
    this.close();
    await this.supabase.signOut();
    this.router.navigateByUrl('/sign-in');
  }
}
