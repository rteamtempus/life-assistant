import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'sign-in',
    loadComponent: () => import('./features/auth/sign-in').then((m) => m.SignIn),
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
        path: 'dump/:kind',
        loadComponent: () => import('./features/dump/dump').then((m) => m.Dump),
      },
      {
        path: 'urges',
        loadComponent: () => import('./features/urges/urges').then((m) => m.Urges),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
