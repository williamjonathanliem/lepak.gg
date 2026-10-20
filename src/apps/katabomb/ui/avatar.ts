// Each player gets a stable colour from their id, so people are easy to tell apart.
// All colours keep black text readable (contrast 7:1 or better).
export const AVATAR_COLORS = [
  '#ff7a45', // orange
  '#ffd23f', // yellow
  '#7ee081', // lime
  '#4fd1e8', // cyan
  '#ff8fd0', // pink
  '#b9a2ff', // lilac
  '#f5f5f5', // white
  '#ffb86b', // apricot
] as const;

/** The player's chosen colour, or a stable one picked from their id. */
export function playerColor(p: { id: string; color: number | null }): string {
  return p.color !== null ? (AVATAR_COLORS[p.color] ?? avatarColor(p.id)) : avatarColor(p.id);
}

export function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length]!;
}
