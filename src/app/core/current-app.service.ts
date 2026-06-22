import { effect, inject, Injectable, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { APPS, AppDef, appForUrl, DEFAULT_APP, nextApp } from './apps.config';

const STORAGE_KEY = 'currentApp';

/**
 * Tracks which mini-app is active (derived from the URL), persists the
 * last-used app for the landing redirect, drives the per-app theme (sets
 * `data-app` on <body>), and cycles to the next app.
 */
@Injectable({ providedIn: 'root' })
export class CurrentAppService {
  private readonly router = inject(Router);

  /** The active app — drives the title, the hamburger menu, and the theme. */
  readonly current = signal<AppDef>(appForUrl(this.router.url));

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        const url = e.urlAfterRedirects;
        const app = appForUrl(url);
        this.current.set(app);
        if (this.isAppUrl(url)) {
          try {
            localStorage.setItem(STORAGE_KEY, app.id);
          } catch {
            /* private mode / storage disabled — fall back to default next load */
          }
        }
      });

    // Per-app theme: swap the palette by tagging <body data-app="...">.
    effect(() => {
      document.body.setAttribute('data-app', this.current().id);
    });
  }

  private isAppUrl(url: string): boolean {
    const seg = url.split(/[/?#]/).filter(Boolean)[0];
    return APPS.some((a) => a.id === seg);
  }

  /** Last-used app id (for redirecting the bare '/' route). */
  lastAppId(): string {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_APP.id;
    } catch {
      return DEFAULT_APP.id;
    }
  }

  /** Cycle to the next app and navigate to its Home. */
  cycle(): void {
    this.router.navigateByUrl(nextApp(this.current().id).home);
  }
}
