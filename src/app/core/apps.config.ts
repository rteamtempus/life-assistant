/**
 * The "super-app" registry. Life Assistant is one of several mini-apps that
 * share this shell, one auth session, and one Supabase database. Clicking the
 * top-left icon cycles to the next app (in this order) and lands on its Home;
 * the hamburger then shows that app's menu. Menus never link across apps.
 *
 * Adding a new mini-app = one entry here + its `*.routes.ts` + a theme block in
 * styles.css (`body[data-app="<id>"]`).
 */
export interface AppMenuItem {
  label: string;
  /** Absolute route within the app, e.g. '/life/review'. */
  path: string;
}

export interface AppDef {
  /** URL segment AND theme key (`body[data-app="<id>"]`). */
  id: string;
  title: string;
  /** The app's Home route, e.g. '/life'. */
  home: string;
  /** Hamburger items for this app (Home first). */
  menu: AppMenuItem[];
}

export const APPS: AppDef[] = [
  {
    id: 'life',
    title: 'Life Assistant',
    home: '/life',
    menu: [
      { label: 'Home', path: '/life' },
      { label: 'Entries', path: '/life/entries' },
      { label: 'Review your data', path: '/life/review' },
      { label: 'Analysis', path: '/life/analysis' },
      { label: 'Experiments', path: '/life/experiments' },
      { label: 'Urges', path: '/life/urges' },
    ],
  },
  {
    id: 'work',
    title: 'Work Assistant',
    home: '/work',
    menu: [{ label: 'Home', path: '/work' }],
  },
  {
    id: 'tarot',
    title: 'Tarot Assistant',
    home: '/tarot',
    menu: [{ label: 'Home', path: '/tarot' }],
  },
];

export const DEFAULT_APP = APPS[0];

/** Which app a URL belongs to (by first path segment), defaulting to the first. */
export function appForUrl(url: string): AppDef {
  const seg = url.split(/[/?#]/).filter(Boolean)[0];
  return APPS.find((a) => a.id === seg) ?? DEFAULT_APP;
}

/** The next app in the cycle (wraps around). */
export function nextApp(id: string): AppDef {
  const i = APPS.findIndex((a) => a.id === id);
  return APPS[(i + 1) % APPS.length];
}
