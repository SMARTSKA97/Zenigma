import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./features/home/home').then((m) => m.Home) },
  { path: 'sync-test', loadComponent: () => import('./features/sync-test/sync-test').then((m) => m.SyncTest) },
  { path: 'account', loadComponent: () => import('./features/account/account').then((m) => m.Account) },
  { path: 'settings', loadComponent: () => import('./features/settings/settings').then((m) => m.Settings) },
  { path: '**', redirectTo: '' },
];
