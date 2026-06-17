import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { PwaUpdateService } from './core/pwa-update.service';
import { SupabaseService } from './core/supabase.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly pwa = inject(PwaUpdateService);
  protected readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);

  protected readonly menuOpen = signal(false);

  constructor() {
    this.pwa.init();
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
