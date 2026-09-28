/**
 * Product lockup for the Review Auto-Reply dashboard: a magenta tile with a
 * reply glyph next to the wordmark. `tone` flips the wordmark colour for dark
 * (sidebar, login panel) vs light backgrounds.
 */
export function BrandMark({
  tone = "dark",
  size = "md",
}: {
  tone?: "dark" | "light";
  size?: "sm" | "md";
}) {
  const tile = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const word = size === "sm" ? "text-sm" : "text-lg";
  const glyph = size === "sm" ? 15 : 19;
  const wordColor = tone === "dark" ? "text-white" : "text-brand-navy";

  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`relative flex ${tile} flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-pink to-brand-pinkDark shadow-sm`}
        aria-hidden
      >
        <svg
          width={glyph}
          height={glyph}
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      </span>
      <span className={`${word} font-extrabold tracking-tight ${wordColor}`}>Review Auto-Reply</span>
    </div>
  );
}
