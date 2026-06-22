import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { CurrentAppService } from './core/current-app.service';

export const routes: Routes = [
  // Shared auth (pre-app).
  {
    path: 'sign-in',
    loadComponent: () => import('./auth/sign-in').then((m) => m.SignIn),
  },
  {
    path: 'sign-up',
    loadComponent: () => import('./auth/sign-up').then((m) => m.SignUp),
  },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      // Bare '/' -> the last-used mini-app's home.
      {
        path: '',
        pathMatch: 'full',
        redirectTo: () => '/' + inject(CurrentAppService).lastAppId(),
      },
      {
        path: 'life',
        loadChildren: () => import('./life/life.routes').then((m) => m.LIFE_ROUTES),
      },
      {
        path: 'work',
        loadChildren: () => import('./work/work.routes').then((m) => m.WORK_ROUTES),
      },
      {
        path: 'tarot',
        loadChildren: () => import('./tarot/tarot.routes').then((m) => m.TAROT_ROUTES),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
