import { ChartColumn, QrCode, ScrollText, Settings2, type LucideIcon } from 'lucide-react';

/**
 * A dot next to a section in the navigation: `busy` — something is running there (an accent dot that sends
 * out rings), `action` — something there needs the user (a warning dot).
 */
export type Attention = 'busy' | 'action';

export type Mode = 'details' | 'settings' | 'logs' | 'update' | 'statistics';

export interface NavItem {
  mode: Mode;
  labelKey: string;
  icon: LucideIcon;
}

/** Sections shown in the navigation; the update view is opened from the header badge. */
export const navItems: NavItem[] = [
  { mode: 'details', labelKey: 'nav.subscription', icon: QrCode },
  { mode: 'statistics', labelKey: 'control.statistics', icon: ChartColumn },
  { mode: 'logs', labelKey: 'control.logs', icon: ScrollText },
  { mode: 'settings', labelKey: 'control.settings', icon: Settings2 },
];
