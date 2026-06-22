import { Routes } from '@angular/router';

// Routes are relative to the '/work' prefix declared in app.routes.ts.
export const WORK_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./home/home').then((m) => m.WorkHome) },
];
