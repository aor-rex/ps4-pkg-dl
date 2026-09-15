import {
  Folder01Icon,
  Sword01Icon,
  Sword02Icon,
  AdventureIcon,
  Shield01Icon,
  Target01Icon,
  ZapIcon,
  PuzzleIcon,
  Car01Icon,
  TrophyIcon,
  GhostIcon,
  StrategyIcon,
  Rocket01Icon,
  Rocket02Icon,
  DiceFaces01Icon,
  DiceFaces02Icon,
  Cards01Icon,
  GameboyIcon,
  BalloonIcon,
  Music01Icon,
  InformationCircleIcon,
} from '@hugeicons/core-free-icons';

/** Genre name → Hugeicons icon. First matching keyword wins; fallback Folder01Icon. */
export function genreIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes('action')) return Sword01Icon;
  if (n.includes('adventure')) return AdventureIcon;
  if (n.includes('rpg') || n.includes('role-playing') || n.includes('role playing')) return Shield01Icon;
  if (n.includes('shooter')) return Target01Icon;
  if (n.includes('fight')) return ZapIcon;
  if (n.includes('puzzle')) return PuzzleIcon;
  if (n.includes('rac') || n.includes('driv') || n.includes('car')) return Car01Icon;
  if (n.includes('sport')) return TrophyIcon;
  if (n.includes('horror')) return GhostIcon;
  if (n.includes('strateg')) return StrategyIcon;
  if (n.includes('simul')) return Rocket01Icon;
  if (n.includes('platform')) return Rocket02Icon;
  if (n.includes('board')) return DiceFaces02Icon;
  if (n.includes('card')) return Cards01Icon;
  if (n.includes('casual')) return DiceFaces01Icon;
  if (n.includes('arcade')) return GameboyIcon;
  if (n.includes('family')) return BalloonIcon;
  if (n.includes('music')) return Music01Icon;
  if (n.includes('educ')) return InformationCircleIcon;
  if (n.includes('indie')) return Sword02Icon;
  return Folder01Icon;
}

/** Parse anything date-like to epoch ms; unparseable → 0 (sorts last). */
export function timeOf(d: unknown): number {
  const t = new Date(String(d || '')).getTime();
  return Number.isFinite(t) ? t : 0;
}
