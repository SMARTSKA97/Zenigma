import { CanMatchFn, Routes } from '@angular/router';
import { leaveGuard } from './core/leave';
import { leafIds, MIND_LIVE, variantsOf } from './games/catalog';

const wordGuess = () => import('./games/word-guess/word-guess').then((m) => m.WordGuess);
const puzzle = () => import('./games/puzzle/puzzle-page').then((m) => m.PuzzlePage);

const variantPlayable: CanMatchFn = (_route, segments) => leafIds(segments[1]?.path ?? '').includes(segments[2]?.path ?? '');
const tieredKind: CanMatchFn = (_route, segments) => variantsOf(segments[1]?.path ?? '').some((v) => v.id === segments[2]?.path && v.tiered);
const mindPlayable: CanMatchFn = (_route, segments) => MIND_LIVE.includes((segments[1]?.path ?? '') as never);
const hasVariants: CanMatchFn = (_route, segments) => variantsOf(segments[1]?.path ?? '').length > 0;

export const routes: Routes = [
  { path: 'games/word-guess', loadComponent: wordGuess, data: { mode: 'practice' } },
  { path: 'mind/:game', canDeactivate: [leaveGuard], canMatch: [mindPlayable], loadComponent: () => import('./games/mind/mind-page').then((m) => m.MindPage) },
  { path: 'speed/:game', canDeactivate: [leaveGuard], loadComponent: () => import('./features/speed/speed-round').then((m) => m.SpeedRound) },
  { path: 'games/:game/levels', loadComponent: () => import('./features/levels/level-map').then((m) => m.LevelMap) },
  { path: 'games/:game/:variant/levels', canMatch: [variantPlayable], loadComponent: () => import('./features/levels/level-map').then((m) => m.LevelMap) },
  { path: 'games/:game/:variant', canMatch: [variantPlayable], canDeactivate: [leaveGuard], loadComponent: puzzle, data: { mode: 'practice' } },
  { path: 'games/:game/:kind', canMatch: [tieredKind], loadComponent: () => import('./features/practice/tier-picker').then((m) => m.TierPicker) },
  { path: 'games/:game', canMatch: [hasVariants], loadComponent: () => import('./features/practice/variant-picker').then((m) => m.VariantPicker) },
  { path: 'games/:game', loadComponent: puzzle, canDeactivate: [leaveGuard], data: { mode: 'practice' } },
  { path: 'mind', loadComponent: () => import('./features/mind/mind-home').then((m) => m.MindHome) },
  { path: 'practice', loadComponent: () => import('./features/practice/practice').then((m) => m.Practice) },
  { path: 'daily-word/:game', loadComponent: () => import('./features/daily/word-daily-page').then((m) => m.WordDailyPage) },
  { path: 'daily/word-guess', loadComponent: wordGuess, data: { mode: 'daily' } },
  { path: 'daily/:game', loadComponent: puzzle, canDeactivate: [leaveGuard], data: { mode: 'daily' } },
  { path: 'daily', pathMatch: 'full', redirectTo: 'challenges' },
  { path: 'ranks/circles', loadComponent: () => import('./features/circles/circles').then((m) => m.Circles) },
  { path: 'ranks', loadComponent: () => import('./features/ranks/ranks').then((m) => m.Ranks) },
  { path: 'challenges', loadComponent: () => import('./features/challenges/challenges-hub').then((m) => m.ChallengesHub) },
  { path: 'badges', loadComponent: () => import('./features/badges/badges').then((m) => m.Badges) },
  { path: 'stats', loadComponent: () => import('./features/stats/stats').then((m) => m.StatsPage) },
  { path: 'rules/:game', loadComponent: () => import('./features/rules/rule-page').then((m) => m.RulePage) },
  { path: 'rules', loadComponent: () => import('./features/rules/rules').then((m) => m.Rules) },
  { path: 'about', loadComponent: () => import('./features/about/about').then((m) => m.About) },
  { path: 'privacy', loadComponent: () => import('./features/about/privacy').then((m) => m.Privacy) },
  { path: 'changelog', loadComponent: () => import('./features/changelog/changelog').then((m) => m.Changelog) },
  { path: '', pathMatch: 'full', loadComponent: () => import('./features/home/home').then((m) => m.Home) },
  { path: 'sync-test', loadComponent: () => import('./features/sync-test/sync-test').then((m) => m.SyncTest) },
  { path: 'account', loadComponent: () => import('./features/account/account').then((m) => m.Account) },
  { path: 'settings', loadComponent: () => import('./features/settings/settings').then((m) => m.Settings) },
  { path: '**', redirectTo: '' },
];
