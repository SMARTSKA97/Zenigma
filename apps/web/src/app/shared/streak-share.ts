import { StreakCardInput } from './share-card';

/** What the share sheet needs to share a streak: the picture's details and the text that goes with it. */
export function streakShare(days: number, name: string | null | undefined, best?: number): { streakCard: StreakCardInput; text: string } {
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const text = `🔥 ${days}-day streak on Zenigma${best && best > days ? ` (best ${best})` : ''}. Daily puzzles and mind games, free and offline: https://zenigma.ska97homelab.uk`;
  return { streakCard: { days, name: name?.trim() ? name.trim() : 'Zenigma player', date, best }, text };
}
