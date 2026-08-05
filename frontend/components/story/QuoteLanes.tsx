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
import { providerLabel } from "@/lib/providerLabel";

interface Cursor {
  lane: number;
  dot: number;
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
}: {
  exhibit: QuoteExhibit;
  boundLow: number | null;
  boundHigh: number | null;
  sku: string;
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

  const at = (price: number) => logPosition(price, exhibit.lo, exhibit.hi);
  const showLow =
    boundLow !== null && boundLow > exhibit.lo && boundLow < exhibit.hi;
  const showHigh =
    boundHigh !== null && boundHigh > exhibit.lo && boundHigh < exhibit.hi;

  return (
    <div className="fc-quotes">
      <div className="fc-quotes__plot">
        <div className="fc-quotes__slate">
          <span>Quoted price · log scale · USD per GPU-hour</span>
          <span>
            n = {exhibit.total}
            {exhibit.recorded > exhibit.total
              ? ` of ${exhibit.recorded} recorded`
              : ""}
          </span>
        </div>

        <div className="fc-quotes__grid">
          {showLow ? (
            <span
              className="fc-quotes__bound"
              style={{ left: `${at(boundLow) * 100}%` }}
              aria-hidden
            >
              <span className="fc-quotes__bound-tag">p5 {usd(boundLow)}</span>
            </span>
          ) : null}
          {showHigh ? (
            <span
              className="fc-quotes__bound fc-quotes__bound--high"
              style={{ left: `${at(boundHigh) * 100}%` }}
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
                    {providerLabel(lane.provider)}
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
                  aria-label={`${providerLabel(lane.provider)}: ${
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
                style={{ left: `${at(tick) * 100}%` }}
              >
                {usd(tick)}
              </span>
            ))}
          </div>
        </div>

        <p className="fc-quotes__note">
          Percentiles, never a mean. One mispriced listing would drag an average
          somewhere no buyer could actually transact.
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
              <dt>Provider</dt>
              <dd>
                {selected === null
                  ? `median of ${exhibit.total}`
                  : providerLabel(selected.provider)}
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
              : selected.price > dayMedian
                ? `Above the day median of ${usd(dayMedian)}.`
                : `At or below the day median of ${usd(dayMedian)}.`}
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
          aria-label={`${usd(dot.price)} per GPU-hour, ${providerLabel(
            dot.provider
          )}, ${regionLabel(dot.region)}, ${commitmentLabel(dot.commitment)}`}
          style={{ left: `${dot.x * 100}%`, top: `${18 + dot.y * 64}%` }}
          onFocus={() => onSelect(laneIndex, dotIndex)}
        />
      ))}
    </>
  );
});
