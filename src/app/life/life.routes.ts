import { Routes } from '@angular/router';

// Routes are relative to the '/life' prefix declared in app.routes.ts.
export const LIFE_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./home/home').then((m) => m.Home) },
  { path: 'dump/from/:dumpId', loadComponent: () => import('./dump/dump').then((m) => m.Dump) },
  { path: 'dump/:kind', loadComponent: () => import('./dump/dump').then((m) => m.Dump) },
  { path: 'urges', loadComponent: () => import('./urges/urges').then((m) => m.Urges) },
  { path: 'entries', loadComponent: () => import('./entries/entries').then((m) => m.Entries) },
  { path: 'entries/:id', loadComponent: () => import('./entries/entry-detail').then((m) => m.EntryDetail) },
  { path: 'review', loadComponent: () => import('./review/review').then((m) => m.Review) },
  { path: 'analysis', loadComponent: () => import('./analysis/analysis').then((m) => m.AnalysisPage) },
  { path: 'experiments', loadComponent: () => import('./experiments/experiments').then((m) => m.Experiments) },
];
