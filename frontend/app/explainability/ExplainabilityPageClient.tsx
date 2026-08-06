"use client";

import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMlExplainability } from "@/lib/mlExplainability";
import {
  ExplainabilityContent,
  ExplainabilityEmptyState,
  ExplainabilityLoadingState,
} from "@/components/ml/ExplainabilityContent";

export function ExplainabilityPageClient() {
  const query = useQuery({
    queryKey: ["ml-explainability"],
    queryFn: getMlExplainability,
  });
  const [howOpen, setHowOpen] = useState(false);
  const howId = useId();

  // Holdout length is structural from the artifact when present; fall back to
  // the design's protocol wording without inventing a day count.
  const holdoutDays = query.data?.metrics.holdout.n_days;

  return (
    <div className="page-wide fade-up expl-page">
      <header className="expl-head">
        <div className="expl-head__row">
          <div>
            <div className="expl-head__eyebrow">
              Explainability · a bound, not proof about unobservables
            </div>
            <h1 className="expl-head__title">
              Two exhibits. Neither one closes the file.
            </h1>
          </div>
          <button
            type="button"
            className="expl-head__how"
            aria-expanded={howOpen}
            aria-controls={howId}
            onClick={() => setHowOpen((v) => !v)}
          >
            {howOpen ? "−" : "+"} SHOW ME HOW THE BOUND IS TESTED
          </button>
        </div>

        {howOpen ? (
          <p className="expl-head__protocol" id={howId}>
            Protocol: the last {holdoutDays != null ? holdoutDays : "N"}{" "}
            distinct UTC days are held out and never tuned on; both scores are
            read on those same days. The four-factor share is the rule-based
            in-sample decomposition; it flatters itself. The GBM is
            day-demeaned, so nothing is credited for explaining market drift.
            Host IDs are banned as model features, but the model finds the
            machines anyway through hardware fingerprints (mobo_name leads its
            SHAP tally), which is why these two exhibits are one picture, not
            two independent confirmations.
          </p>
        ) : null}
      </header>

      {query.isLoading ? (
        <ExplainabilityLoadingState />
      ) : query.data ? (
        <ExplainabilityContent artifact={query.data} />
      ) : (
        <ExplainabilityEmptyState />
      )}
    </div>
  );
}
