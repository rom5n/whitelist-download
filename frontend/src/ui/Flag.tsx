/** A country flag emoji. On Windows the flag font is added by the polyfill in main.tsx. */
export default function Flag({ emoji, className = 'text-xl' }: { emoji: string; className?: string }) {
  return (
    <span aria-hidden="true" className={`flag inline-block shrink-0 ${className}`}>
      {emoji || '🏳️'}
    </span>
  );
}
