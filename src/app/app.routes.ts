import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'sign-in',
    loadComponent: () =>
      import('./features/auth/sign-in').then((m) => m.SignIn),
  },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./features/home/home').then((m) => m.Home),
      },
      {
        path: 'capture',
        loadComponent: () =>
          import('./features/capture/capture').then((m) => m.Capture),
      },
      {
        path: 'tools',
        loadComponent: () =>
          import('./features/tools/tools').then((m) => m.Tools),
      },
      {
        path: 'check-in',
        loadComponent: () =>
          import('./features/check-in/check-in').then((m) => m.CheckIn),
      },
      {
        path: 'surface',
        loadComponent: () =>
          import('./features/surface/surface').then((m) => m.Surface),
      },
      {
        path: 'urge',
        loadComponent: () =>
          import('./features/urge/urge').then((m) => m.Urge),
      },
      {
        path: 'memos',
        loadComponent: () =>
          import('./features/self-memos/self-memos').then((m) => m.SelfMemos),
      },
      {
        path: 'export',
        loadComponent: () =>
          import('./features/export/export').then((m) => m.Export),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
