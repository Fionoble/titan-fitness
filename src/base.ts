const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Strip the Vite base path from a full pathname, returning a root-relative path. */
export function stripBase(pathname: string): string {
  if (BASE && pathname.startsWith(BASE)) {
    const stripped = pathname.slice(BASE.length);
    return stripped.startsWith('/') ? stripped : '/' + stripped;
  }
  return pathname || '/';
}

/** Prepend the Vite base path to a root-relative route. */
export function withBase(route: string): string {
  if (!BASE) return route;
  return BASE + route;
}
