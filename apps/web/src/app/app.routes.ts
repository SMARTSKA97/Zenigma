import { Routes } from '@angular/router';

const wordGuess = () => import('./games/word-guess/word-guess').then((m) => m.WordGuess);
const puzzle = () => import('./games/puzzle/puzzle-page').then((m) => m.PuzzlePage);

export const routes: Routes = [
  { path: 'games/word-guess', loadComponent: wordGuess, data: { mode: 'practice' } },
  { path: 'games/:game', loadComponent: puzzle, data: { mode: 'practice' } },
  { path: 'daily/word-guess', loadComponent: wordGuess, data: { mode: 'daily' } },
  { path: 'daily/:game', loadComponent: puzzle, data: { mode: 'daily' } },
  { path: 'daily', loadComponent: () => import('./features/daily/daily-hub').then((m) => m.DailyHub) },
  { path: 'ranks/circles', loadComponent: () => import('./features/circles/circles').then((m) => m.Circles) },
  { path: 'ranks', loadComponent: () => import('./features/ranks/ranks').then((m) => m.Ranks) },
  { path: 'stats', loadComponent: () => import('./features/stats/stats').then((m) => m.StatsPage) },
  { path: 'changelog', loadComponent: () => import('./features/changelog/changelog').then((m) => m.Changelog) },
  { path: '', pathMatch: 'full', loadComponent: () => import('./features/home/home').then((m) => m.Home) },
  { path: 'sync-test', loadComponent: () => import('./features/sync-test/sync-test').then((m) => m.SyncTest) },
  { path: 'account', loadComponent: () => import('./features/account/account').then((m) => m.Account) },
  { path: 'settings', loadComponent: () => import('./features/settings/settings').then((m) => m.Settings) },
  { path: '**', redirectTo: '' },
];
