"use client";

import Link from "next/link";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import {
  commitmentLabel,
  logPosition,
  regionLabel,
  usd,
  type QuoteDot,
  type QuoteExhibit,
} from "@/lib/fileCopy";
import { catalogLabel, providerLabel } from "@/lib/providerLabel";

interface Cursor {
  lane: number;
  dot: number;
}

function medianComparison(price: number, dayMedian: number): string {
  if (dayMedian <= 0) return "";
  const delta = price - dayMedian;
  const pct = Math.round(Math.abs((delta / dayMedian) * 100));
  const sign = delta >= 0 ? "+" : "−";
  const direction = delta >= 0 ? "above" : "below";
  return `${sign}${usd(Math.abs(delta))} · ${pct}% ${direction} day median (${usd(dayMedian)})`;
}

/**
 * One collection day of real quotes, one lane per provider on a shared log
 * price axis.
 *
 * Colour encodes nothing here: lanes are separated by position and labelled in
 * type. That keeps a five-way categorical palette off a page already spending
 * colour on factor shares, and keeps the exhibit readable to anyone who cannot
 * separate five muted hues (WCAG 1.4.1). The selected quote is the only mark
 * that takes the accent, and it is also ringed, so colour is never the sole
 * signal.
 *
 * Reading it:
 *  - pointer: hover a lane and the nearest quote to the cursor is read out
 *  - touch: tap a lane; the nearest quote to your thumb fills the slip
 *  - keyboard: Tab reaches each lane, then arrow keys walk the quotes
 *
 * The slip is a fixed-height panel, so selecting never reflows the page under
 * the reader's thumb (the 1h inline-receipt rider).
 */
export function QuoteLanes({
  exhibit,
  boundLow,
  boundHigh,
  sku,
  skuDisplay,
}: {
  exhibit: QuoteExhibit;
  boundLow: number | null;
  boundHigh: number | null;
  sku: string;
  skuDisplay: string;
}) {
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const laneRefs = useRef<(HTMLDivElement | null)[]>([]);

  const dayMedian = useMemo(() => {
    const prices = exhibit.lanes
      .flatMap((lane) => lane.dots.map((d) => d.price))
      .sort((a, b) => a - b);
    return prices[Math.floor(prices.length / 2)] ?? 0;
  }, [exhibit]);

  const selected: QuoteDot | null =
    cursor === null ? null : (exhibit.lanes[cursor.lane]?.dots[cursor.dot] ?? null);

  const select = useCallback((lane: number, dot: number) => {
    setCursor((prev) =>
      prev !== null && prev.lane === lane && prev.dot === dot
        ? prev
        : { lane, dot }
    );
  }, []);

  const moveFocus = useCallback(
    (laneIndex: number, dotIndex: number) => {
      const lane = exhibit.lanes[laneIndex];
      if (lane === undefined || lane.dots.length === 0) return;
      const clamped = Math.max(0, Math.min(lane.dots.length - 1, dotIndex));
      select(laneIndex, clamped);
      laneRefs.current[laneIndex]
        ?.querySelector<HTMLElement>(`[data-dot="${clamped}"]`)
        ?.focus({ preventScroll: true });
    },
    [exhibit.lanes, select]
  );

  /** Pointer or touch anywhere in a lane picks the quote nearest that x. */
  const pickNearest = useCallback(
    (laneIndex: number, clientX: number, track: HTMLDivElement) => {
      const lane = exhibit.lanes[laneIndex];
      if (lane === undefined || lane.dots.length === 0) return;
      const box = track.getBoundingClientRect();
      if (box.width === 0) return;
      const at = (clientX - box.left) / box.width;
      let best = 0;
      let bestGap = Infinity;
      lane.dots.forEach((dot, i) => {
        const gap = Math.abs(dot.x - at);
        if (gap < bestGap) {
          bestGap = gap;
          best = i;
        }
      });
      select(laneIndex, best);
    },
    [exhibit.lanes, select]
  );

  const onLaneKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    laneIndex: number
  ) => {
    const lane = exhibit.lanes[laneIndex];
    if (lane === undefined) return;
    const at = cursor?.lane === laneIndex ? cursor.dot : -1;
    const moves: Record<string, () => void> = {
      ArrowRight: () => moveFocus(laneIndex, at + 1),
      ArrowLeft: () => moveFocus(laneIndex, Math.max(0, at - 1)),
      Home: () => moveFocus(laneIndex, 0),
      End: () => moveFocus(laneIndex, lane.dots.length - 1),
      ArrowDown: () =>
        moveFocus(Math.min(exhibit.lanes.length - 1, laneIndex + 1), 0),
      ArrowUp: () => moveFocus(Math.max(0, laneIndex - 1), 0),
    };
    const run = moves[event.key];
    if (run === undefined) return;
    event.preventDefault();
    run();
  };

  /**
   * Percent along the axis, rounded before it reaches the DOM.
   *
   * `logPosition` runs Math.log, which the spec does not require to be
   * correctly rounded — Node and the browser can differ in the last ULP. Left
   * raw, that put `left:51.9041448694803%` in the server HTML against
   * `51.904144869480305%` on the client and tripped a hydration mismatch. Three
   * decimals is still sub-pixel at any width the axis is drawn at.
   */
  const pct = (price: number) =>
    (logPosition(price, exhibit.lo, exhibit.hi) * 100).toFixed(3);

  const at = (price: number) => logPosition(price, exhibit.lo, exhibit.hi);
  const showLow =
    boundLow !== null && boundLow > exhibit.lo && boundLow < exhibit.hi;
  const showHigh =
    boundHigh !== null && boundHigh > exhibit.lo && boundHigh < exhibit.hi;
  const bandLeft = showLow ? pct(boundLow) : "0";
  const bandWidth =
    showLow && showHigh
      ? ((at(boundHigh) - at(boundLow)) * 100).toFixed(3)
      : "0";

  return (
    <div className="fc-quotes">
      <div className="fc-quotes__plot">
        <div className="fc-quotes__slate">
          <span>
            Raw quoted dispersion · log scale · USD per GPU-hour · before
            controls
          </span>
          <span>
            n = {exhibit.total}
            {exhibit.recorded > exhibit.total
              ? ` of ${exhibit.recorded} recorded`
              : ""}
          </span>
        </div>

        <div className="fc-quotes__grid">
          {showLow && showHigh ? (
            <span
              className="fc-quotes__band"
              style={{ left: `${bandLeft}%`, width: `${bandWidth}%` }}
              aria-hidden
            />
          ) : null}
          {showLow ? (
            <span
              className="fc-quotes__bound"
              style={{ left: `${pct(boundLow)}%` }}
              aria-hidden
            >
              <span className="fc-quotes__bound-tag">p5 {usd(boundLow)}</span>
            </span>
          ) : null}
          {showHigh ? (
            <span
              className="fc-quotes__bound fc-quotes__bound--high"
              style={{ left: `${pct(boundHigh)}%` }}
              aria-hidden
            >
              <span className="fc-quotes__bound-tag">p95 {usd(boundHigh)}</span>
            </span>
          ) : null}

          {exhibit.lanes.map((lane, laneIndex) => {
            const active = cursor?.lane === laneIndex ? selected : null;
            return (
              <div className="fc-lane" key={lane.provider}>
                <div className="fc-lane__key">
                  <span className="fc-lane__name">
                    {catalogLabel(lane.provider)}
                  </span>
                  <span className="fc-lane__count">{lane.dots.length}</span>
                </div>
                <div
                  className="fc-lane__track"
                  data-dots
                  ref={(node) => {
                    laneRefs.current[laneIndex] = node;
                  }}
                  role="group"
                  aria-label={`${catalogLabel(lane.provider)}: ${
                    lane.dots.length
                  } quotes, ${usd(lane.low)} to ${usd(
                    lane.high
                  )} per GPU-hour. Arrow keys read individual quotes.`}
                  tabIndex={0}
                  onKeyDown={(event) => onLaneKeyDown(event, laneIndex)}
                  onPointerDown={(event) =>
                    pickNearest(laneIndex, event.clientX, event.currentTarget)
                  }
                  onPointerMove={(event) => {
                    if (event.pointerType !== "mouse") return;
                    pickNearest(laneIndex, event.clientX, event.currentTarget);
                  }}
                  onPointerLeave={(event) => {
                    if (event.pointerType !== "mouse") return;
                    setCursor(null);
                  }}
                >
                  <span className="fc-lane__rule" aria-hidden />
                  <Dots
                    dots={lane.dots}
                    laneIndex={laneIndex}
                    onSelect={select}
                  />
                  {active !== null ? (
                    <span
                      className="fc-lane__marker"
                      aria-hidden
                      style={{
                        left: `${active.x * 100}%`,
                        top: `${18 + active.y * 64}%`,
                      }}
                    />
                  ) : null}
                </div>
              </div>
            );
          })}

          <div className="fc-quotes__axis" aria-hidden>
            {exhibit.ticks.map((tick) => (
              <span
                key={tick}
                className="fc-quotes__tick"
                style={{ left: `${pct(tick)}%` }}
              >
                {usd(tick)}
              </span>
            ))}
          </div>
        </div>

        <p className="fc-quotes__note">
          We report the middle 90% (p5–p95), not the mean — the quote
          distribution is skewed, and outliers can distort an average without
          describing the market.
        </p>
      </div>

      <div className="fc-slip">
        <div className="fc-slip__head">
          <span>Quote slip</span>
          <span className="fc-slip__tag">
            {selected === null ? "day summary" : "one quote"}
          </span>
        </div>
        <div className="fc-slip__body" aria-live="polite">
          <div className="fc-slip__price">
            {selected === null ? usd(dayMedian) : usd(selected.price)}
            <span>/hr</span>
          </div>
          <dl className="fc-slip__rows">
            <div>
              <dt>Canonical SKU</dt>
              <dd translate="no">{skuDisplay}</dd>
            </div>
            <div>
              <dt>Provider</dt>
              <dd>
                {selected === null
                  ? `median of ${exhibit.total}`
                  : catalogLabel(selected.provider)}
              </dd>
            </div>
            <div>
              <dt>Region</dt>
              <dd>
                {selected === null ? "all countries" : regionLabel(selected.region)}
              </dd>
            </div>
            <div>
              <dt>Commitment</dt>
              <dd>
                {selected === null
                  ? "all types"
                  : commitmentLabel(selected.commitment)}
              </dd>
            </div>
            <div>
              <dt>Recorded</dt>
              <dd>{exhibit.day}</dd>
            </div>
          </dl>
          <p className="fc-slip__note">
            {selected === null
              ? "Pick a quote to read the one behind it."
              : medianComparison(selected.price, dayMedian)}
          </p>
        </div>
        <Link
          className="fc-slip__pull"
          href={`/basis?sku=${encodeURIComponent(sku)}`}
        >
          <span>Pull the raw observation</span>
          <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}

/**
 * The dot layer never re-renders on selection: a hover that reconciled several
 * hundred buttons would cost frames. The active quote is drawn by a marker
 * that moves instead, and each dot stays programmatically focusable for the
 * keyboard path.
 */
const Dots = memo(function Dots({
  dots,
  laneIndex,
  onSelect,
}: {
  dots: QuoteDot[];
  laneIndex: number;
  onSelect: (lane: number, dot: number) => void;
}) {
  return (
    <>
      {dots.map((dot, dotIndex) => (
        <button
          type="button"
          key={dot.id}
          data-dot={dotIndex}
          className="fc-dot"
          tabIndex={-1}
          aria-label={`${usd(dot.price)} per GPU-hour, ${catalogLabel(
            dot.provider
          )}, ${regionLabel(dot.region)}, ${commitmentLabel(dot.commitment)}`}
          style={{ left: `${dot.x * 100}%`, top: `${18 + dot.y * 64}%` }}
          onFocus={() => onSelect(laneIndex, dotIndex)}
        />
      ))}
    </>
  );
});
