import type { PlateSpec } from "@/lib/plates";

/**
 * A photographic frame. Server-rendered: the image is in the initial HTML, and
 * the only client involvement is the parallax shift StoryMotion applies to
 * `[data-parallax]`. With JS off, or under prefers-reduced-motion, the frame is
 * simply a still.
 *
 * `depth` is the parallax travel as a fraction of the frame's height; phones
 * get half of it (StoryMotion), because a tall plate on a short viewport
 * travels further for the same number.
 */
export function PlateFrame({
  plate,
  depth = 0.12,
  priority = false,
  showSlate = true,
  className = "",
}: {
  plate: PlateSpec;
  depth?: number;
  /** The cold open's plate is above the fold and must not lazy-load. */
  priority?: boolean;
  showSlate?: boolean;
  className?: string;
}) {
  return (
    <div className={`fc-plate ${className}`.trim()} aria-hidden>
      <div
        className="fc-plate__shift"
        data-parallax=""
        style={{ "--fc-depth": depth } as React.CSSProperties}
      >
        <picture>
          {/* Keyed by position, not by srcSet: a plate may legitimately point
              two breakpoints at the same derivative (STAKES_FLOOR does), and
              that duplicated a React key. The list is static and never
              reorders, so the index is a stable identity. */}
          {plate.sources.map((source, index) => (
            <source
              key={index}
              media={source.media}
              srcSet={source.srcSet}
              type="image/webp"
            />
          ))}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="fc-plate__img"
            src={plate.src}
            alt=""
            width={plate.width}
            height={plate.height}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            style={
              {
                "--fc-pos": plate.position ?? "50% 50%",
                "--fc-pos-mobile":
                  plate.positionMobile ?? plate.position ?? "50% 50%",
              } as React.CSSProperties
            }
          />
        </picture>
      </div>
      {showSlate ? <span className="fc-plate__slate">{plate.slate}</span> : null}
    </div>
  );
}
