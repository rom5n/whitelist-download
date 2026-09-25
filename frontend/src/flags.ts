/**
 * Country flags as local SVG files (flag-icons package).
 *
 * Why not emoji: flags are regional-indicator emoji pairs, and Windows ships no flag glyphs,
 * so browsers there render them as two letters ("DE"). SVGs look the same on every OS and work offline.
 */

// Only URLs are bundled here; each SVG is a separate static file, loaded when a flag is shown
const flagModules = import.meta.glob<string>('/node_modules/flag-icons/flags/4x3/*.svg', {
  query: '?url',
  import: 'default',
  eager: true,
});

const flagUrls: Record<string, string> = {};
for (const [path, url] of Object.entries(flagModules)) {
  const code = path.slice(path.lastIndexOf('/') + 1, -'.svg'.length).toUpperCase();
  flagUrls[code] = url;
}

const REGIONAL_INDICATOR_A = 0x1f1e6;

/** Converts a flag emoji ("🇩🇪") to its ISO 3166-1 alpha-2 code ("DE"). Returns null for anything else */
export function emojiToCountryCode(emoji: string): string | null {
  const points = Array.from(emoji.trim(), ch => ch.codePointAt(0) ?? 0);
  if (points.length !== 2) return null;
  const letters = points.map(p => p - REGIONAL_INDICATOR_A);
  if (letters.some(l => l < 0 || l > 25)) return null;
  return String.fromCharCode(...letters.map(l => l + 65));
}

/** URL of the local SVG flag for an ISO code, or null if the set has no such flag */
export function flagUrl(code: string | null | undefined): string | null {
  if (!code) return null;
  return flagUrls[code.toUpperCase()] ?? null;
}
