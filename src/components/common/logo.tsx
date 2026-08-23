import { cn } from "@/lib/utils";

/**
 * The Mindraft mark: a brain drawn as a lightbulb, with an "M" of
 * connected nodes inside — the idea, and the structure it takes on.
 *
 * The silhouette is a single open path, so the notch at the top centre
 * reads as the split between the two hemispheres. It is stroked with
 * `currentColor` so the mark inverts in dark mode; the two brand colours
 * stay fixed, because they *are* the brand. The teal node is the same
 * accent used everywhere else to mean "this is the moment of clarity".
 *
 * Geometry traced from the source artwork on a 1240×1240 grid,
 * mirrored around x = 619.
 */
export function Logo({
  className,
  title,
}: {
  className?: string;
  /** Set only when the mark stands alone; otherwise the adjacent text names it. */
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 1240 1240"
      className={cn("size-7 shrink-0 text-ink-900 dark:text-brand-50", className)}
      fill="none"
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}

      {/* Brain silhouette flowing into the bulb */}
      <path
        d="M586 175C573 170 534 146 508 144C482 142 454 149 430 164C406 179 388 208 363 232C338 256 299 284 281 310C263 336 258 362 253 388C248 414 257 440 253 466C249 492 226 518 228 544C230 570 251 596 264 622C277 648 275 671 305 700C335 729 413 767 442 796C471 825 470 855 477 874C484 893 483 904 484 910Q484 941 510 941L728 941Q754 941 754 910C755 904 754 893 761 874C768 855 767 825 796 796C825 767 903 729 933 700C963 671 961 648 974 622C987 596 1008 570 1010 544C1012 518 989 492 985 466C981 440 990 414 985 388C980 362 975 336 957 310C939 284 900 256 875 232C850 208 832 179 808 164C784 149 756 142 730 144C704 146 665 170 652 175"
        stroke="currentColor"
        strokeWidth="46"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Screw base */}
      <path d="M505 1005H734" stroke="currentColor" strokeWidth="48" strokeLinecap="round" />
      <path d="M524 1071H715" stroke="currentColor" strokeWidth="48" strokeLinecap="round" />

      {/* The "M": four segments between five nodes */}
      <path
        d="M363 372L358 632M363 372L619 626L874 372M874 372L881 632"
        stroke="#5B5CE2"
        strokeWidth="40"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <circle cx="363" cy="372" r="53" fill="#5B5CE2" />
      <circle cx="358" cy="632" r="52" fill="#5B5CE2" />
      <circle cx="619" cy="626" r="51" fill="#5B5CE2" />
      <circle cx="881" cy="632" r="52" fill="#5B5CE2" />
      <rect x="820" y="318" width="109" height="108" rx="26" fill="#2DD4BF" />
    </svg>
  );
}
