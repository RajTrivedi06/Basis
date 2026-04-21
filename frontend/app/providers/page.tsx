import { ProviderComparisonChart } from "@/components/ProviderComparisonChart";

export default function ProvidersPage() {
  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">
          Provider Comparison
        </h1>
        <p className="mt-2 max-w-3xl text-gray-400">
          Per-provider median price deviation from the all-providers market
          median on the latest observation date, averaged across all GPU SKUs
          that provider covers. Below-market providers are highlighted in the
          negative direction.
        </p>
      </section>

      <section>
        <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-6">
          <ProviderComparisonChart />
        </div>
      </section>

      <section className="max-w-3xl text-sm text-gray-400">
        <h2 className="text-base font-medium text-gray-200">Caveats</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Deviation is averaged across SKUs without weighting — a provider
            with only a few exotic SKUs can look more extreme than its general
            pricing would suggest.
          </li>
          <li>
            The marketplace providers (Vast.ai) aggregate many independent
            sellers; their "deviation" reflects the marketplace median, not a
            single price policy.
          </li>
          <li>
            These are quoted prices only. Enterprise transaction prices
            typically diverge further.
          </li>
        </ul>
      </section>
    </div>
  );
}
