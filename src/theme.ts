import { getState, setState, THEME_KEY, type ThemeId } from './store';

export const THEMES: { id: ThemeId; label: string }[] = [
  { id: 'lunatic', label: 'Lunatic' },
  { id: 'classic', label: 'Classic dark' },
  { id: 'light', label: 'Light' },
];

const apply = (id: ThemeId) => {
  document.documentElement.dataset.theme = id;
};

/** Switch the interface theme and remember the choice on this computer. */
export function setTheme(id: ThemeId) {
  setState({ theme: id });
  apply(id);
  try {
    localStorage.setItem(THEME_KEY, id);
  } catch {
    // the theme still changes for this session
  }
}

/** Apply the saved theme before the first paint. */
export const initTheme = () => apply(getState().theme);
