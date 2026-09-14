const KEY = "mattayom:save:v1";

export function save<T>(data: T): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(data)); return true; }
  catch { return false; }
}
export function load<T>(): T | null {
  try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as T) : null; }
  catch { return null; }
}
export function wipe() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
