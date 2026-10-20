// localStorage can throw (private mode, blocked site data). Never let that crash the app.
export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable. The value lives only for this page view.
  }
}
