/** A placeholder with a light sweeping across it (a transform animation, cheap to draw). */
export default function Skeleton({ className = '' }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`relative block overflow-hidden rounded-sm bg-raised ${className}`}>
      <span className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-fg/[0.06] to-transparent" />
    </span>
  );
}
