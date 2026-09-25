import { flagEmojiToCode, getCountryCode } from '../countryFlags';

// Round SVG flags (circle-flags, MIT), bundled so they work offline and look the same on every OS.
// Each flag is a separate small file, fetched only when it is shown.
const flagUrls = import.meta.glob<string>('../../node_modules/circle-flags/flags/??.svg', {
  eager: true,
  query: '?url',
  import: 'default',
});

const urlByCode = new Map(
  Object.entries(flagUrls).map(([path, url]) => [path.slice(-6, -4), url]),
);

interface FlagProps {
  /** A flag emoji, as in the config names ("🇩🇪") */
  emoji?: string;
  /** Or a country name, as the backend reports it ("Germany") */
  country?: string;
  /** Size classes; the flag is a circle */
  className?: string;
}

/** A round country flag. An unknown flag falls back to its country code as text, or to a question mark. */
export default function Flag({ emoji, country, className = 'size-5' }: FlagProps) {
  const code = emoji ? flagEmojiToCode(emoji) : country ? getCountryCode(country) : null;
  const url = code ? urlByCode.get(code) : undefined;

  if (url) {
    return (
      <img
        src={url}
        alt=""
        aria-hidden="true"
        draggable={false}
        decoding="async"
        className={`inline-block shrink-0 rounded-full object-cover shadow-[0_0_0_1px_var(--line)] ${className}`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-raised text-[0.625rem] leading-none font-semibold uppercase text-fg-2
                  shadow-[0_0_0_1px_var(--line)] ${className}`}
    >
      {code ?? '?'}
    </span>
  );
}
