import { Routes } from '@angular/router';

// Routes are relative to the '/tarot' prefix declared in app.routes.ts.
export const TAROT_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./home/home').then((m) => m.TarotHome) },
];
